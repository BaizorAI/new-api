package controller

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestApplyHermesPlaygroundHeaderOverride(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/chat/completions", nil)
	c.Request.Header.Set("X-Baizor-Playground", "hermes")
	c.Request.Header.Set("X-Baizor-Hermes-Session", "session_123")

	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{
		"X-Hermes-User-Id": "spoofed",
		"X-Other":          "keep",
	})

	applyHermesPlaygroundHeaderOverride(c, 42)

	headers := common.GetContextKeyStringMap(c, constant.ContextKeyChannelHeaderOverride)
	require.NotNil(t, headers)
	assert.Equal(t, "42", headers["X-Hermes-User-Id"])
	assert.Equal(t, "session_123", headers["X-Hermes-Session-Id"])
	assert.Equal(t, "baizor-web-playground", headers["X-Hermes-Source"])
	assert.Equal(t, "keep", headers["X-Other"])
}

func TestApplyHermesPlaygroundHeaderOverrideIgnoresOtherPlaygrounds(t *testing.T) {
	gin.SetMode(gin.TestMode)

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/chat/completions", nil)

	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, map[string]any{
		"X-Other": "keep",
	})

	applyHermesPlaygroundHeaderOverride(c, 42)

	headers := common.GetContextKeyStringMap(c, constant.ContextKeyChannelHeaderOverride)
	require.NotNil(t, headers)
	assert.Equal(t, map[string]any{"X-Other": "keep"}, headers)
}

func TestSanitizeHermesSessionID(t *testing.T) {
	assert.Equal(t, "abc-123._:xyz", sanitizeHermesSessionID(" abc-123._:xyz "))
	assert.Empty(t, sanitizeHermesSessionID("abc\r\nx-bad: 1"))
	assert.Empty(t, sanitizeHermesSessionID(strings.Repeat("a", 129)))
}
