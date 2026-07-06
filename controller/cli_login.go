package controller

import (
	"net/http"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/setting/model_setting"

	"github.com/gin-gonic/gin"
)

// CliLoginSubmitRequest is the request body for submitting a key.
type CliLoginSubmitRequest struct {
	Token string `json:"token"`
	Key   string `json:"key"`
}

// CliLoginPollResponse is the response for polling a session.
type CliLoginPollResponse struct {
	Status string `json:"status"`
	Key    string `json:"key,omitempty"`

	// Shared default model
	Model string `json:"model,omitempty"`

	// Legacy tier aliases
	HaikuModel  string `json:"haiku_model,omitempty"`
	SonnetModel string `json:"sonnet_model,omitempty"`
	OpusModel   string `json:"opus_model,omitempty"`

	// Codex parameters
	CodexModel           string `json:"codex_model,omitempty"`
	CodexFullAuto        bool   `json:"codex_full_auto"`
	CodexReasoningEffort string `json:"codex_reasoning_effort,omitempty"`

	// Claude parameters
	ClaudeModel          string `json:"claude_model,omitempty"`
	ClaudeMaxTurns       int    `json:"claude_max_turns"`
	ClaudePermissionMode string `json:"claude_permission_mode,omitempty"`

	// Model metadata: maps model name → {context_window, max_output_tokens}.
	// The CLI uses this to populate tool config files (e.g. codex [model_info]).
	ModelInfo map[string]model_setting.CliModelInfo `json:"model_info,omitempty"`
}

// SubmitCliKey handles POST /api/cli/submit — called by the frontend after a key is revealed.
func SubmitCliKey(c *gin.Context) {
	var req CliLoginSubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}

	if req.Token == "" || req.Key == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "token and key are required",
		})
		return
	}

	store := common.GetCliLoginStore()
	store.SubmitKey(req.Token, req.Key)

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
	})
}

// PollCliSession handles GET /api/cli/poll — called by the CLI to check if a key is ready.
func PollCliSession(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "token is required",
		})
		return
	}

	store := common.GetCliLoginStore()
	session := store.PollSession(token)

	resp := CliLoginPollResponse{
		Status: session.Status,
		Key:    session.Key,
	}

	// Include all tool settings when session is done
	if session.Status == "done" {
		cfg := model_setting.GetCliDefaultModelSettings()
		resp.Model = cfg.Model
		resp.HaikuModel = cfg.HaikuModel
		resp.SonnetModel = cfg.SonnetModel
		resp.OpusModel = cfg.OpusModel

		resp.CodexModel = cfg.CodexModel
		resp.CodexFullAuto = cfg.CodexFullAuto
		resp.CodexReasoningEffort = cfg.CodexReasoningEffort

		resp.ClaudeModel = cfg.ClaudeModel
		resp.ClaudeMaxTurns = cfg.ClaudeMaxTurns
		resp.ClaudePermissionMode = cfg.ClaudePermissionMode

		resp.ModelInfo = cfg.ModelInfo
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data":    resp,
	})
}
