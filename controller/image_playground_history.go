package controller

import (
	"bytes"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/dto"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

const imagePlaygroundDir = "data/image-playground"

func init() {
	if err := os.MkdirAll(imagePlaygroundDir, 0o755); err != nil {
		panic(fmt.Sprintf("cannot create image playground directory %s: %v", imagePlaygroundDir, err))
	}
}

// ── Request types ──────────────────────────────────────────────

type imagePlaygroundGenerateRequest struct {
	Prompt  string `json:"prompt"`
	Model   string `json:"model"`
	Size    string `json:"size"`
	Quality string `json:"quality"`
	Group   string `json:"group"`
}

// ── Handlers ───────────────────────────────────────────────────

func ListImagePlaygroundHistory(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	records, total, err := model.GetUserImagePlaygroundHistory(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

// SubmitImagePlaygroundGeneration creates a pending history entry and
// launches a background goroutine to generate the image, following the
// same async pattern as HermesExecutionTask.
func SubmitImagePlaygroundGeneration(c *gin.Context) {
	userId := c.GetInt("id")
	var req imagePlaygroundGenerateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	if req.Prompt == "" || req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "prompt and model are required"})
		return
	}

	record := &model.ImagePlaygroundHistory{
		UserId:  userId,
		Prompt:  req.Prompt,
		Model:   req.Model,
		Size:    req.Size,
		Quality: req.Quality,
		Group:   req.Group,
		Status:  model.ImagePlaygroundStatusPending,
	}
	if err := model.CreateImagePlaygroundHistory(record); err != nil {
		common.ApiError(c, err)
		return
	}

	go runImagePlaygroundGeneration(record.Id)

	common.ApiSuccess(c, record)
}

func DeleteImagePlaygroundHistoryEntry(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := model.DeleteImagePlaygroundHistory(userId, id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ClearImagePlaygroundHistoryEntries(c *gin.Context) {
	userId := c.GetInt("id")
	if err := model.ClearImagePlaygroundHistory(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// RecoverImagePlaygroundHistories marks any pending records as failed on startup.
// Unlike HermesExecutionTask which re-fires goroutines, image generation is not
// retried to avoid double-billing. Users can retry manually from the UI.
func RecoverImagePlaygroundHistories() {
	if model.DB == nil {
		return
	}
	if err := model.MarkStaleImagePlaygroundHistories(); err != nil {
		common.SysError("failed to recover image playground histories: " + err.Error())
		return
	}
	common.SysLog("image playground: marked stale pending entries as failed")
}

// ── Background generation ──────────────────────────────────────

// runImagePlaygroundGeneration executes image generation in a background
// goroutine, following the same synthetic-context pattern as
// executeHermesCompletionTask in hermes_execution_task.go.
func runImagePlaygroundGeneration(recordId int) {
	record, err := model.GetImagePlaygroundHistoryById(recordId)
	if err != nil || record == nil {
		if err != nil {
			common.SysError("image playground: failed to load record: " + err.Error())
		}
		return
	}

	responseBody, statusCode, err := executeImagePlaygroundGeneration(record)
	if err != nil {
		_ = model.UpdateImagePlaygroundHistoryError(recordId, err.Error())
		return
	}
	if statusCode < 200 || statusCode >= 300 {
		errMsg := extractImagePlaygroundError(responseBody, statusCode)
		_ = model.UpdateImagePlaygroundHistoryError(recordId, errMsg)
		return
	}

	// Parse the image response to extract URL and revised prompt
	var imgResp dto.ImageResponse
	if err := common.Unmarshal(responseBody, &imgResp); err != nil {
		_ = model.UpdateImagePlaygroundHistoryError(recordId, "failed to parse image response: "+err.Error())
		return
	}
	if len(imgResp.Data) == 0 {
		_ = model.UpdateImagePlaygroundHistoryError(recordId, "no image data in response")
		return
	}

	upstreamURL := imgResp.Data[0].Url
	revisedPrompt := imgResp.Data[0].RevisedPrompt

	// Download the image from upstream and save to local data directory
	localPath, err := downloadAndSaveImage(recordId, upstreamURL)
	if err != nil {
		common.SysError("image playground: failed to save image locally: " + err.Error())
		// Fall back to upstream URL if local save fails
		localPath = upstreamURL
	}

	if err := model.UpdateImagePlaygroundHistoryResult(recordId, localPath, revisedPrompt); err != nil {
		common.SysError("image playground: failed to save result: " + err.Error())
	}
}

// downloadAndSaveImage fetches an image from the upstream URL and saves it
// to the local data/image-playground/ directory. Returns the serving path
// (e.g. "/image-playground/123.png") for use as image_url in the DB.
func downloadAndSaveImage(recordId int, upstreamURL string) (string, error) {
	if upstreamURL == "" {
		return "", fmt.Errorf("empty upstream URL")
	}

	resp, err := http.Get(upstreamURL)
	if err != nil {
		return "", fmt.Errorf("download failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("download returned status %d", resp.StatusCode)
	}

	// Determine file extension from Content-Type
	ext := ".png"
	ct := resp.Header.Get("Content-Type")
	switch {
	case strings.Contains(ct, "jpeg") || strings.Contains(ct, "jpg"):
		ext = ".jpg"
	case strings.Contains(ct, "webp"):
		ext = ".webp"
	case strings.Contains(ct, "gif"):
		ext = ".gif"
	}

	filename := fmt.Sprintf("%d%s", recordId, ext)
	diskPath := filepath.Join(imagePlaygroundDir, filename)

	dst, err := os.Create(diskPath)
	if err != nil {
		return "", fmt.Errorf("create file failed: %w", err)
	}

	if _, err := io.Copy(dst, resp.Body); err != nil {
		dst.Close()
		os.Remove(diskPath)
		return "", fmt.Errorf("write file failed: %w", err)
	}
	dst.Close()

	// Return the URL path for serving via router.Static
	return "/image-playground/" + filename, nil
}

func executeImagePlaygroundGeneration(record *model.ImagePlaygroundHistory) ([]byte, int, error) {
	// Build the image generation request body
	payload := map[string]any{
		"model":   record.Model,
		"prompt":  record.Prompt,
		"size":    record.Size,
		"quality": record.Quality,
		"n":       1,
	}
	if record.Group != "" {
		payload["group"] = record.Group
	}
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	// Build synthetic HTTP request (same pattern as executeHermesCompletionTask)
	request := httptest.NewRequest(http.MethodPost, "/v1/images/generations", bytes.NewReader(payloadBytes))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("New-Api-User", strconv.Itoa(record.UserId))

	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = request

	// Set playground flag so Distribute reads group from body
	c.Set(middleware.PlaygroundContextKey, true)

	// Set auth context manually (mirrors executeHermesCompletionTask)
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

	// Run channel selection then image generation
	middleware.Distribute()(c)
	if c.IsAborted() {
		common.CleanupBodyStorage(c)
		return response.Body.Bytes(), response.Code, nil
	}

	PlaygroundImage(c)
	common.CleanupBodyStorage(c)
	return response.Body.Bytes(), response.Code, nil
}

func extractImagePlaygroundError(body []byte, statusCode int) string {
	var resp struct {
		Error struct {
			Message string `json:"message"`
			Type    string `json:"type"`
		} `json:"error"`
	}
	if err := common.Unmarshal(body, &resp); err == nil && resp.Error.Message != "" {
		return resp.Error.Message
	}
	return "image generation failed with status " + strconv.Itoa(statusCode)
}
