package controller

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/dto"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

const videoPlaygroundDir = "video-playground"

func init() {
	if err := os.MkdirAll(videoPlaygroundDir, 0o755); err != nil {
		panic(fmt.Sprintf("cannot create video playground directory %s: %v", videoPlaygroundDir, err))
	}
}

// ── Request types ──────────────────────────────────────────────

type videoPlaygroundGenerateRequest struct {
	Prompt         string  `json:"prompt"`
	Model          string  `json:"model"`
	Size           string  `json:"size"`
	NegativePrompt string  `json:"negative_prompt"`
	NumFrames      int     `json:"num_frames"`
	Fps            int     `json:"fps"`
	GuidanceScale  float64 `json:"guidance_scale"`
	Seed           int64   `json:"seed"`
	Group          string  `json:"group"`
}

// ── Handlers ───────────────────────────────────────────────────

func ListVideoPlaygroundHistory(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	records, total, err := model.GetUserVideoPlaygroundHistory(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

// SubmitVideoPlaygroundGeneration creates a pending history entry and
// launches a background goroutine to generate the video, following the
// same async pattern as image playground.
func SubmitVideoPlaygroundGeneration(c *gin.Context) {
	userId := c.GetInt("id")
	var req videoPlaygroundGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	if req.Prompt == "" || req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "prompt and model are required"})
		return
	}

	record := &model.VideoPlaygroundHistory{
		UserId:         userId,
		Prompt:         req.Prompt,
		Model:          req.Model,
		Size:           req.Size,
		NegativePrompt: req.NegativePrompt,
		NumFrames:      req.NumFrames,
		Fps:            req.Fps,
		GuidanceScale:  req.GuidanceScale,
		Seed:           req.Seed,
		Group:          req.Group,
		Status:         model.VideoPlaygroundStatusPending,
	}
	if err := model.CreateVideoPlaygroundHistory(record); err != nil {
		common.ApiError(c, err)
		return
	}

	go runVideoPlaygroundGeneration(record.Id)

	common.ApiSuccess(c, record)
}

func DeleteVideoPlaygroundHistoryEntry(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := model.DeleteVideoPlaygroundHistory(userId, id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ClearVideoPlaygroundHistoryEntries(c *gin.Context) {
	userId := c.GetInt("id")
	if err := model.ClearVideoPlaygroundHistory(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// RecoverVideoPlaygroundHistories marks any pending records as failed on startup.
func RecoverVideoPlaygroundHistories() {
	if model.DB == nil {
		return
	}
	if err := model.MarkStaleVideoPlaygroundHistories(); err != nil {
		common.SysError("failed to recover video playground histories: " + err.Error())
		return
	}
	common.SysLog("video playground: marked stale pending entries as failed")
}

// ── Background generation ──────────────────────────────────────

func runVideoPlaygroundGeneration(recordId int) {
	record, err := model.GetVideoPlaygroundHistoryById(recordId)
	if err != nil || record == nil {
		if err != nil {
			common.SysError("video playground: failed to load record: " + err.Error())
		}
		return
	}

	responseBody, statusCode, err := executeVideoPlaygroundGeneration(record)
	if err != nil {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, err.Error())
		return
	}
	if statusCode < 200 || statusCode >= 300 {
		errMsg := extractVideoPlaygroundError(responseBody, statusCode)
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, errMsg)
		return
	}

	// Parse the response — the upstream returns the same format as image API:
	// { "created": <ts>, "data": [{ "b64_json": "<base64-mp4>" }] }
	var resp dto.ImageResponse
	if err := common.Unmarshal(responseBody, &resp); err != nil {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, "failed to parse video response: "+err.Error())
		return
	}
	if len(resp.Data) == 0 {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, "no video data in response")
		return
	}

	videoData := resp.Data[0]

	// Save video locally — sulphur2 always returns b64_json
	if videoData.B64Json != "" {
		localPath, err := saveBase64Video(recordId, videoData.B64Json)
		if err != nil {
			common.SysError("video playground: failed to save base64 video: " + err.Error())
			_ = model.UpdateVideoPlaygroundHistoryError(recordId, "failed to save video: "+err.Error())
			return
		}
		if err := model.UpdateVideoPlaygroundHistoryResult(recordId, localPath); err != nil {
			common.SysError("video playground: failed to save result: " + err.Error())
		}
	} else if videoData.Url != "" {
		// Fallback: if upstream returns a URL instead of base64
		if err := model.UpdateVideoPlaygroundHistoryResult(recordId, videoData.Url); err != nil {
			common.SysError("video playground: failed to save result: " + err.Error())
		}
	} else {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, "no video url or base64 data in response")
	}
}

func saveBase64Video(recordId int, b64data string) (string, error) {
	if b64data == "" {
		return "", fmt.Errorf("empty base64 data")
	}

	decoded, err := base64.StdEncoding.DecodeString(b64data)
	if err != nil {
		return "", fmt.Errorf("base64 decode failed: %w", err)
	}

	filename := fmt.Sprintf("%d.mp4", recordId)
	diskPath := filepath.Join(videoPlaygroundDir, filename)

	if err := os.WriteFile(diskPath, decoded, 0o644); err != nil {
		return "", fmt.Errorf("write file failed: %w", err)
	}

	return "/video-playground/" + filename, nil
}

func executeVideoPlaygroundGeneration(record *model.VideoPlaygroundHistory) ([]byte, int, error) {
	payload := map[string]any{
		"model":  record.Model,
		"prompt": record.Prompt,
		"n":      1,
	}
	if record.Size != "" {
		payload["size"] = record.Size
	}
	if record.NegativePrompt != "" {
		payload["negative_prompt"] = record.NegativePrompt
	}
	if record.NumFrames > 0 {
		payload["num_frames"] = record.NumFrames
	}
	if record.Fps > 0 {
		payload["fps"] = record.Fps
	}
	if record.GuidanceScale > 0 {
		payload["guidance_scale"] = record.GuidanceScale
	}
	if record.Seed != 0 {
		payload["seed"] = record.Seed
	}
	if record.Group != "" {
		payload["group"] = record.Group
	}
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	// Build synthetic HTTP request (same pattern as image playground)
	request := httptest.NewRequest(http.MethodPost, "/v1/videos/generations", bytes.NewReader(payloadBytes))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("New-Api-User", strconv.Itoa(record.UserId))

	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = request

	// Set playground flag so Distribute reads group from body
	c.Set(middleware.PlaygroundContextKey, true)

	// Set auth context manually (mirrors image playground)
	c.Set("id", record.UserId)
	c.Set("use_access_token", false)

	userCache, err := model.GetUserCache(record.UserId)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	c.Set("username", userCache.Username)
	c.Set("role", userCache.Role)
	c.Set("group", userCache.Group)
	c.Set("user_group", userCache.Group)
	userCache.WriteContext(c)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, userCache.Group)

	// Run channel selection then video generation
	middleware.Distribute()(c)
	if c.IsAborted() {
		common.CleanupBodyStorage(c)
		return response.Body.Bytes(), response.Code, nil
	}

	PlaygroundVideo(c)
	common.CleanupBodyStorage(c)
	return response.Body.Bytes(), response.Code, nil
}

func extractVideoPlaygroundError(body []byte, statusCode int) string {
	var resp struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
		} `json:"error"`
	}
	if err := common.Unmarshal(body, &resp); err == nil && resp.Error.Message != "" {
		return resp.Error.Message
	}
	return "video generation failed with status " + strconv.Itoa(statusCode)
}
