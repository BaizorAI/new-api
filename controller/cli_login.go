package controller

import (
	"net/http"

	"github.com/BaizorAI/new-api/common"

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
	if !store.SubmitKey(req.Token, req.Key) {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "session not found or expired",
		})
		return
	}

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
	if session == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "session not found or expired",
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": CliLoginPollResponse{
			Status: session.Status,
			Key:    session.Key,
		},
	})
}
