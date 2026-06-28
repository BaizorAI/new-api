package controller

import (
	"net/http"
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeHermesExecutionWorkspaceMode(t *testing.T) {
	tests := []struct {
		name     string
		value    string
		expected string
	}{
		{name: "team", value: "team", expected: "team_workspace"},
		{name: "team workspace", value: " team_workspace ", expected: "team_workspace"},
		{name: "one person company", value: "one_person_company", expected: "one_person_company"},
		{name: "wechat", value: "WeChat", expected: "weixin"},
		{name: "default", value: "", expected: "personal"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.expected, normalizeHermesExecutionWorkspaceMode(tt.value))
		})
	}
}

func TestDeriveHermesExecutionTaskTitleUsesLastUserText(t *testing.T) {
	payload := map[string]any{
		"messages": []any{
			map[string]any{"role": "user", "content": "old title"},
			map[string]any{"role": "assistant", "content": "reply"},
			map[string]any{"role": "user", "content": []any{
				map[string]any{"type": "text", "text": "new"},
				map[string]any{"type": "text", "text": "title"},
			}},
		},
	}

	assert.Equal(t, "new title", deriveHermesExecutionTaskTitle(payload))
}

func TestExtractHermesExecutionTaskErrorPrefersOpenAIError(t *testing.T) {
	body, err := common.Marshal(gin.H{
		"message": "outer message",
		"error": gin.H{
			"message": "inner message",
			"code":    "bad_request",
		},
	})
	require.NoError(t, err)

	assert.Equal(t, "inner message", extractHermesExecutionTaskError(body, http.StatusBadRequest))
	assert.Equal(t, "plain failure", extractHermesExecutionTaskError([]byte("plain failure"), http.StatusBadGateway))
}
