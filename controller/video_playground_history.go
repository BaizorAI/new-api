package controller

import (
	"bytes"
	"encoding/base64"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/dto"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

const videoPlaygroundDir = "video-playground"

const (
	// videoPollInterval is the delay between upstream poll requests.
	videoPollInterval = 15 * time.Second
	// videoPollTimeout is the maximum wall-clock time a poll loop runs.
	videoPollTimeout = 2 * time.Hour
	// videoPollMaxConsecutiveErrors is the number of consecutive HTTP errors
	// before giving up (transient failures are expected during restarts).
	videoPollMaxConsecutiveErrors = 10
)

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

// RecoverVideoPlaygroundHistories restores in-flight video generation after
// a gateway restart. Records that already received an upstream job ID are
// resumed via pollVideoPlaygroundResult; the rest are marked failed.
func RecoverVideoPlaygroundHistories() {
	if model.DB == nil {
		return
	}
	// Resume poll loops for records that were already submitted upstream.
	records, err := model.GetPendingVideoPlaygroundWithUpstreamJob()
	if err != nil {
		common.SysError("video playground: failed to query recoverable records: " + err.Error())
	} else {
		for _, r := range records {
			common.SysLog(fmt.Sprintf("video playground: recovering poll for record %d (upstream_job_id=%s, channel_id=%d)", r.Id, r.UpstreamJobId, r.ChannelId))
			go pollVideoPlaygroundResult(r.Id, r.UpstreamJobId, r.ChannelId)
		}
	}
	// Mark remaining pending records (never submitted) as failed.
	if err := model.MarkStaleVideoPlaygroundHistoriesWithoutUpstream(); err != nil {
		common.SysError("video playground: failed to mark stale entries: " + err.Error())
		return
	}
	common.SysLog("video playground: recovery complete")
}

// ── Background generation (async submit + poll) ──────────────────

// videoSubmitResult carries the relay response along with the selected channel
// ID so the caller can persist it and later poll upstream directly.
type videoSubmitResult struct {
	ResponseBody []byte
	StatusCode   int
	ChannelId    int
}

func runVideoPlaygroundGeneration(recordId int) {
	record, err := model.GetVideoPlaygroundHistoryById(recordId)
	if err != nil || record == nil {
		if err != nil {
			common.SysError("video playground: failed to load record: " + err.Error())
		}
		return
	}

	result, err := executeVideoPlaygroundGeneration(record)
	if err != nil {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, err.Error())
		return
	}

	// ── Async 202 path: upstream accepted the job ──
	if result.StatusCode == http.StatusAccepted {
		jobId := extractUpstreamJobId(result.ResponseBody)
		if jobId == "" {
			_ = model.UpdateVideoPlaygroundHistoryError(recordId, "upstream returned 202 but no job id")
			return
		}
		if err := model.UpdateVideoPlaygroundUpstreamInfo(recordId, jobId, result.ChannelId); err != nil {
			common.SysError("video playground: failed to save upstream info: " + err.Error())
			_ = model.UpdateVideoPlaygroundHistoryError(recordId, "failed to save upstream info: "+err.Error())
			return
		}
		common.SysLog(fmt.Sprintf("video playground: record %d submitted async (job_id=%s, channel_id=%d)", recordId, jobId, result.ChannelId))
		pollVideoPlaygroundResult(recordId, jobId, result.ChannelId)
		return
	}

	// ── Sync 200 path: response already contains the video ──
	if result.StatusCode < 200 || result.StatusCode >= 300 {
		errMsg := extractVideoPlaygroundError(result.ResponseBody, result.StatusCode)
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, errMsg)
		return
	}

	var resp dto.ImageResponse
	if err := common.Unmarshal(result.ResponseBody, &resp); err != nil {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, "failed to parse video response: "+err.Error())
		return
	}
	if len(resp.Data) == 0 {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, "no video data in response")
		return
	}

	saveVideoFromImageResponse(recordId, resp.Data[0])
}

// pollVideoPlaygroundResult polls the upstream sulphur2 endpoint until the
// job reaches a terminal state (completed/failed) or the poll times out.
func pollVideoPlaygroundResult(recordId int, upstreamJobId string, channelId int) {
	channel, err := model.GetChannelById(channelId, true)
	if err != nil {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, "channel not found: "+err.Error())
		return
	}

	baseURL := strings.TrimSuffix(channel.GetBaseURL(), "/")
	apiKey := channel.Key
	pollURL := fmt.Sprintf("%s/v1/videos/generations/%s", baseURL, upstreamJobId)

	client := &http.Client{Timeout: 30 * time.Second}
	deadline := time.Now().Add(videoPollTimeout)
	consecutiveErrors := 0

	for {
		time.Sleep(videoPollInterval)

		if time.Now().After(deadline) {
			_ = model.UpdateVideoPlaygroundHistoryError(recordId, "video generation timed out after "+videoPollTimeout.String())
			return
		}

		req, _ := http.NewRequest(http.MethodGet, pollURL, nil)
		req.Header.Set("Authorization", "Bearer "+apiKey)
		resp, err := client.Do(req)
		if err != nil {
			consecutiveErrors++
			common.SysError(fmt.Sprintf("video playground: poll error for record %d (%d/%d): %v", recordId, consecutiveErrors, videoPollMaxConsecutiveErrors, err))
			if consecutiveErrors >= videoPollMaxConsecutiveErrors {
				_ = model.UpdateVideoPlaygroundHistoryError(recordId, "too many poll errors: "+err.Error())
				return
			}
			continue
		}
		body, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		consecutiveErrors = 0

		if resp.StatusCode == http.StatusNotFound {
			// Job vanished (sulphur2 restarted and lost state before SQLite
			// persistence was added, or job was cleaned up).
			_ = model.UpdateVideoPlaygroundHistoryError(recordId, "upstream job not found (may have been lost during restart)")
			return
		}
		if resp.StatusCode != http.StatusOK {
			common.SysError(fmt.Sprintf("video playground: poll status %d for record %d", resp.StatusCode, recordId))
			continue
		}

		// Parse upstream job status.
		var jobResp struct {
			Status string `json:"status"`
			Data   []struct {
				B64Json string `json:"b64_json"`
				Url     string `json:"url"`
			} `json:"data"`
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		if err := common.Unmarshal(body, &jobResp); err != nil {
			common.SysError(fmt.Sprintf("video playground: failed to parse poll response for record %d: %v", recordId, err))
			continue
		}

		switch jobResp.Status {
		case "completed":
			if len(jobResp.Data) == 0 {
				_ = model.UpdateVideoPlaygroundHistoryError(recordId, "upstream completed but no video data")
				return
			}
			saveVideoFromPollData(recordId, jobResp.Data[0].B64Json, jobResp.Data[0].Url)
			return
		case "failed":
			errMsg := jobResp.Error.Message
			if errMsg == "" {
				errMsg = "upstream video generation failed"
			}
			_ = model.UpdateVideoPlaygroundHistoryError(recordId, errMsg)
			return
		default:
			// "queued" / "processing" — keep polling
		}
	}
}

// extractUpstreamJobId parses the async 202 response body to find the job id.
func extractUpstreamJobId(body []byte) string {
	var resp struct {
		Id string `json:"id"`
	}
	if err := common.Unmarshal(body, &resp); err != nil {
		return ""
	}
	return resp.Id
}

// saveVideoFromImageResponse handles saving a completed video from the sync
// (200) code path where the upstream already returned data in ImageResponse format.
func saveVideoFromImageResponse(recordId int, videoData dto.ImageData) {
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
		if err := model.UpdateVideoPlaygroundHistoryResult(recordId, videoData.Url); err != nil {
			common.SysError("video playground: failed to save result: " + err.Error())
		}
	} else {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, "no video url or base64 data in response")
	}
}

// saveVideoFromPollData handles saving a completed video from the async poll path.
func saveVideoFromPollData(recordId int, b64Json string, url string) {
	if b64Json != "" {
		localPath, err := saveBase64Video(recordId, b64Json)
		if err != nil {
			common.SysError("video playground: failed to save polled video: " + err.Error())
			_ = model.UpdateVideoPlaygroundHistoryError(recordId, "failed to save video: "+err.Error())
			return
		}
		if err := model.UpdateVideoPlaygroundHistoryResult(recordId, localPath); err != nil {
			common.SysError("video playground: failed to save result: " + err.Error())
		}
	} else if url != "" {
		if err := model.UpdateVideoPlaygroundHistoryResult(recordId, url); err != nil {
			common.SysError("video playground: failed to save result: " + err.Error())
		}
	} else {
		_ = model.UpdateVideoPlaygroundHistoryError(recordId, "no video url or base64 data in poll response")
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

func executeVideoPlaygroundGeneration(record *model.VideoPlaygroundHistory) (*videoSubmitResult, error) {
	payload := map[string]any{
		"model":  record.Model,
		"prompt": record.Prompt,
		"n":      1,
		"async":  true, // Tell sulphur2 to return 202 immediately with a job ID
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
		return nil, err
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
		return nil, err
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
		return &videoSubmitResult{
			ResponseBody: response.Body.Bytes(),
			StatusCode:   response.Code,
		}, nil
	}

	// Capture the selected channel ID before relay runs.
	channelId, _ := c.Get(string(constant.ContextKeyChannelId))
	selectedChannelId, _ := channelId.(int)

	PlaygroundVideo(c)
	common.CleanupBodyStorage(c)
	return &videoSubmitResult{
		ResponseBody: response.Body.Bytes(),
		StatusCode:   response.Code,
		ChannelId:    selectedChannelId,
	}, nil
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
