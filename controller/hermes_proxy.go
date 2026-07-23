package controller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/middleware"

	"github.com/gin-gonic/gin"
)

// applyHermesPlaygroundHeaderOverride injects Hermes attribution headers into
// the channel header override map when the request is a Hermes playground chat
// completion.
func applyHermesPlaygroundHeaderOverride(c *gin.Context, userId int) {
	if c == nil || c.Request == nil {
		return
	}
	// NOTE: Use the PlaygroundContextKey instead of checking the URL path here,
	// because PlaygroundPathRewrite middleware rewrites /pg/… to /v1/… before
	// we run, so c.Request.URL.Path no longer contains the original /pg/ prefix.
	if !c.GetBool(middleware.PlaygroundContextKey) {
		return
	}
	if !strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Baizor-Playground")), "hermes") {
		return
	}

	headerOverride := common.GetContextKeyStringMap(c, constant.ContextKeyChannelHeaderOverride)
	merged := make(map[string]any, len(headerOverride)+3)
	for key, value := range headerOverride {
		merged[key] = value
	}

	for key, value := range buildHermesPlaygroundAttributionHeaders(c, userId) {
		merged[key] = value
	}

	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, merged)
}

// buildHermesPlaygroundAttributionHeaders constructs the headers that identify
// the calling user, team, session, and billing scope to the Hermes sidecar.
func buildHermesPlaygroundAttributionHeaders(c *gin.Context, userId int) map[string]string {
	teamID := common.GetContextKeyInt(c, constant.ContextKeyTeamId)
	workspace := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Baizor-Hermes-Workspace")))
	sessionID := scopedHermesSessionID(userId, c.GetHeader("X-Baizor-Hermes-Session"))
	if teamID > 0 && workspace == "team_workspace" {
		sessionID = scopedHermesTeamSessionID(teamID, c.GetHeader("X-Baizor-Hermes-Session"))
	}
	teamName := common.GetContextKeyString(c, constant.ContextKeyTeamName)
	billingScope := common.HermesBillingScopeUser
	if teamID > 0 {
		billingScope = common.HermesBillingScopeTeam
	}

	headers := map[string]string{
		"X-Hermes-User-Id":       strconv.Itoa(userId),
		"X-Hermes-Source":        "baizor-web-playground",
		"X-Hermes-Session-Id":    sessionID,
		"X-Hermes-Billing-Scope": billingScope,
	}

	activeSkill := strings.TrimSpace(c.GetHeader("X-Baizor-Hermes-Skill-Activate"))
	if activeSkill != "" {
		headers["X-Hermes-Active-Skill"] = activeSkill
	}

	smartRoute := strings.TrimSpace(c.GetHeader("X-Baizor-Smart-Route"))
	if smartRoute != "" {
		headers["X-Hermes-Smart-Route"] = smartRoute
	}

	if teamID > 0 {
		headers["X-Hermes-Team-Id"] = strconv.Itoa(teamID)
		if teamName != "" {
			headers["X-Hermes-Team-Name"] = teamName
		}
	}

	secret := common.GetHermesConfig().APIKey
	delegationHeaders := common.BuildHermesDelegationHeaders(secret, common.HermesDelegationContext{
		UserID:    userId,
		TeamID:    teamID,
		TeamName:  teamName,
		Scope:     billingScope,
		SessionID: sessionID,
		ExpiresAt: time.Now().Add(6 * time.Hour).Unix(),
	})
	for key, value := range delegationHeaders {
		headers[key] = value
	}
	return headers
}

// proxyHermesPlayground forwards a request to the Hermes sidecar and writes
// the response back to the Gin context.
func proxyHermesPlayground(c *gin.Context, method string, path string, body []byte) hermesProxyResult {
	return proxyHermesPlaygroundWithQuery(c, method, path, nil, body)
}

// proxyHermesPlaygroundWithQuery forwards a request to the Hermes sidecar with
// optional query parameters and writes the response back to the Gin context.
func proxyHermesPlaygroundWithQuery(c *gin.Context, method string, path string, query url.Values, body []byte) hermesProxyResult {
	// ComfyUI skill requests bypass the Hermes agent entirely — they are
	// routed to a dedicated service that executes workflow scripts directly.
	if strings.Contains(path, "/chat/completions") && isComfyuiSkillActivated(c) {
		return handleComfyuiSkill(c, body)
	}

	baseURL := strings.TrimRight(common.GetHermesConfig().APIURL, "/")
	apiKey := strings.TrimSpace(common.GetHermesConfig().APIKey)
	if apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "HERMES_API_SERVER_KEY is not configured"})
		return hermesProxyResult{StatusCode: http.StatusServiceUnavailable}
	}

	parsedURL, err := url.Parse(baseURL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "HERMES_API_SERVER_URL is invalid"})
		return hermesProxyResult{StatusCode: http.StatusServiceUnavailable}
	}
	parsedURL.Path = strings.TrimRight(parsedURL.Path, "/") + path
	parsedURL.RawQuery = query.Encode()

	var reader io.Reader
	if len(body) > 0 {
		reader = bytes.NewReader(body)
	}

	reqCtx := c.Request.Context()
	// Chat completions and generation requests can run for several minutes.
	// Use a background context so the request survives even if the
	// browser's HTTP connection drops (e.g. network hiccup, tab switch).
	if strings.Contains(path, "/chat/completions") || strings.Contains(path, "/generate") {
		reqCtx = context.Background()
	}
	req, err := http.NewRequestWithContext(reqCtx, method, parsedURL.String(), reader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create hermes request"})
		return hermesProxyResult{StatusCode: http.StatusInternalServerError}
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	userId := c.GetInt("id")
	if err := applyHermesRequestedBillingContext(c, userId); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return hermesProxyResult{StatusCode: http.StatusForbidden}
	}
	for key, value := range buildHermesPlaygroundAttributionHeaders(c, userId) {
		req.Header.Set(key, value)
	}

	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "failed to reach hermes sidecar"})
		return hermesProxyResult{StatusCode: http.StatusBadGateway}
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "failed to read hermes response"})
		return hermesProxyResult{StatusCode: http.StatusBadGateway}
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}
	c.Data(resp.StatusCode, contentType, respBody)
	return hermesProxyResult{StatusCode: resp.StatusCode, Body: respBody}
}

// ── ComfyUI Skill Direct Routing ──────────────────────────────────────────

const comfyuiServiceBase = "http://baizor-hermes:8650"

type comfyuiGenerateRequest struct {
	Prompt   string          `json:"prompt"`
	Width    int             `json:"width"`
	Height   int             `json:"height"`
	Frames   int             `json:"frames"`
	Steps    int             `json:"steps"`
	Workflow json.RawMessage `json:"workflow,omitempty"`
}

type comfyuiGenerateResponse struct {
	Status   string        `json:"status"`
	PromptID string        `json:"prompt_id"`
	Files    []comfyuiFile `json:"files"`
	Error    string        `json:"error"`
}

type comfyuiFile struct {
	Filename   string `json:"filename"`
	URL        string `json:"url"`
	ComfyUIURL string `json:"comfyui_url"`
	LocalPath  string `json:"local_path"`
	LocalURL   string `json:"local_url"`
	SCPOk      bool   `json:"scp_ok"`
	SCPError   string `json:"scp_error"`
	NodeID     string `json:"node_id"`
}

// ComfyuiSkillBypass is a Gin middleware that intercepts Hermes playground
// chat completion requests and routes them to the appropriate backend before
// they reach the channel distribution middleware:
//
//   - ComfyUI skill (X-Baizor-Hermes-Skill-Activate: comfyui): forwarded to
//     the comfyui execution service directly.
//   - Generic Hermes playground (X-Baizor-Playground: hermes, no skill):
//     forwarded to the Hermes sidecar's chat completions endpoint.
//
// Both paths bypass Distribute, so no database channel is required.
func ComfyuiSkillBypass() func(c *gin.Context) {
	return func(c *gin.Context) {
		if isComfyuiSkillActivated(c) {
			body, _ := io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
			handleComfyuiSkill(c, body)
			c.Abort()
			return
		}
		if strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Baizor-Playground")), "hermes") {
			body, _ := io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(body))
			proxyHermesPlayground(c, http.MethodPost, "/v1/chat/completions", body)
			c.Abort()
			return
		}
		c.Next()
	}
}

// isComfyuiSkillActivated checks whether the comfyui skill is active based on
// both the client request header and the already-built Hermes headers.
func isComfyuiSkillActivated(c *gin.Context) bool {
	activeSkill := strings.TrimSpace(c.GetHeader("X-Baizor-Hermes-Skill-Activate"))
	return strings.EqualFold(activeSkill, "comfyui")
}

type comfyuiChatRequest struct {
	Model    string `json:"model"`
	Messages []struct {
		Role    string `json:"role"`
		Content string `json:"content"`
	} `json:"messages"`
	Width    int             `json:"width"`
	Height   int             `json:"height"`
	Frames   int             `json:"frames"`
	Steps    int             `json:"steps"`
	Workflow json.RawMessage `json:"workflow,omitempty"`
}

// extractComfyuiParams extracts the prompt and optional generation parameters
// from a chat-completion style request body. Parameters that are unspecified
// (zero value) are left as zero, and the caller applies defaults.
func extractComfyuiParams(body []byte) (prompt string, width, height, frames, steps int, workflow json.RawMessage) {
	var req comfyuiChatRequest
	if err := common.Unmarshal(body, &req); err != nil {
		return
	}
	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			prompt = req.Messages[i].Content
			break
		}
	}
	width = req.Width
	height = req.Height
	frames = req.Frames
	steps = req.Steps
	workflow = req.Workflow
	return
}

// handleComfyuiSkill forwards the request to the dedicated comfyui service
// running inside the baizor-hermes container and returns a chat-completion
// formatted response.
func handleComfyuiSkill(c *gin.Context, body []byte) hermesProxyResult {
	prompt, width, height, frames, steps, workflow := extractComfyuiParams(body)
	if prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "No user prompt found in messages"})
		return hermesProxyResult{StatusCode: http.StatusBadRequest}
	}

	// Apply sensible defaults when user doesn't specify a value.
	if width <= 0 {
		width = 512
	}
	if height <= 0 {
		height = 512
	}
	if frames <= 0 {
		frames = 33
	}
	if steps <= 0 {
		steps = 30
	}

	genReq := comfyuiGenerateRequest{
		Prompt:   prompt,
		Width:    width,
		Height:   height,
		Frames:   frames,
		Steps:    steps,
		Workflow: workflow,
	}

	reqBody, err := common.Marshal(genReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "Failed to marshal request"})
		return hermesProxyResult{StatusCode: http.StatusInternalServerError}
	}

	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Post(comfyuiServiceBase+"/generate", "application/json", bytes.NewReader(reqBody))
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "Failed to reach comfyui service"})
		return hermesProxyResult{StatusCode: http.StatusBadGateway}
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)

	var genResp comfyuiGenerateResponse
	if err := common.Unmarshal(respBody, &genResp); err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "Failed to parse comfyui response"})
		return hermesProxyResult{StatusCode: http.StatusBadGateway}
	}

	if genResp.Error != "" {
		c.JSON(http.StatusInternalServerError, gin.H{"message": genResp.Error})
		return hermesProxyResult{StatusCode: http.StatusInternalServerError}
	}

	// Build a chat-completion response
	content := fmt.Sprintf("Video generated successfully.\nPrompt ID: %s\n", genResp.PromptID)
	for _, f := range genResp.Files {
		url := f.LocalURL
		if url == "" {
			url = f.ComfyUIURL
		}
		content += fmt.Sprintf("- %s\n  %s\n", f.Filename, url)
	}

	promptID := genResp.PromptID
	if len(promptID) > 8 {
		promptID = promptID[:8]
	}
	chatResp := map[string]interface{}{
		"id":      "chatcmpl-" + promptID,
		"object":  "chat.completion",
		"created": time.Now().Unix(),
		"model":   "comfyui-sulphur",
		"choices": []map[string]interface{}{
			{
				"index": 0,
				"message": map[string]interface{}{
					"role":    "assistant",
					"content": content,
				},
				"finish_reason": "stop",
			},
		},
		"usage": map[string]interface{}{
			"prompt_tokens":     0,
			"completion_tokens": 0,
			"total_tokens":      0,
		},
	}

	chatRespBody, _ := common.Marshal(chatResp)
	c.Data(http.StatusOK, "application/json", chatRespBody)
	return hermesProxyResult{StatusCode: http.StatusOK, Body: chatRespBody}
}

// HermesComfyuiFileProxy forwards file requests to the comfyui service
// running inside the hermes container. Access via:
//
//	GET /pg/hermes/files/comfyui/<filename>
func HermesComfyuiFileProxy(c *gin.Context) {
	filename := c.Param("path")
	if filename == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "missing filename"})
		return
	}

	fileURL := comfyuiServiceBase + "/files/" + filename
	req, err := http.NewRequestWithContext(c.Request.Context(), http.MethodGet, fileURL, nil)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create proxy request"})
		return
	}

	client := &http.Client{Timeout: 5 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "failed to reach comfyui service"})
		return
	}
	defer resp.Body.Close()

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	c.DataFromReader(resp.StatusCode, resp.ContentLength, contentType, resp.Body, nil)
}

// HermesComfyuiWorkflows proxies GET /pg/hermes/comfyui-workflows to the
// comfyui service's workflow listing endpoint.
func HermesComfyuiWorkflows(c *gin.Context) {
	resp, err := http.Get(comfyuiServiceBase + "/workflows")
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "Failed to reach comfyui service"})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}

// HermesComfyuiWorkflow proxies GET /pg/hermes/comfyui-workflows/:name to
// the comfyui service's workflow retrieval endpoint.
func HermesComfyuiWorkflow(c *gin.Context) {
	name := c.Param("name")
	resp, err := http.Get(comfyuiServiceBase + "/workflows/" + name)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "Failed to reach comfyui service"})
		return
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	c.Data(resp.StatusCode, "application/json", body)
}
