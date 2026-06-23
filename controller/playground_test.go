package controller

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/model"

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

func TestHermesPlaygroundToolsetsProxiesWithUserHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var receivedPath string
	var receivedAuth string
	var receivedUser string
	var receivedSession string
	var receivedSource string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		receivedAuth = r.Header.Get("Authorization")
		receivedUser = r.Header.Get("X-Hermes-User-Id")
		receivedSession = r.Header.Get("X-Hermes-Session-Id")
		receivedSource = r.Header.Get("X-Hermes-Source")
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"object":"list","data":[{"name":"shell","enabled":true}]}`))
	}))
	defer server.Close()

	t.Setenv("HERMES_API_SERVER_URL", server.URL+"/api")
	t.Setenv("HERMES_API_SERVER_KEY", "test-key")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/toolsets", nil)
	c.Request.Header.Set("X-Baizor-Hermes-Session", "session-456")
	c.Set("id", 42)

	HermesPlaygroundToolsets(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.JSONEq(t, `{"object":"list","data":[{"name":"shell","enabled":true}]}`, recorder.Body.String())
	assert.Equal(t, "/api/v1/toolsets", receivedPath)
	assert.Equal(t, "Bearer test-key", receivedAuth)
	assert.Equal(t, "42", receivedUser)
	assert.Equal(t, "session-456", receivedSession)
	assert.Equal(t, "baizor-web-playground", receivedSource)
}

func TestHermesPlaygroundSkillsPostForwardsBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var receivedBody string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, err := io.ReadAll(r.Body)
		require.NoError(t, err)
		receivedBody = string(body)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"success":true}`))
	}))
	defer server.Close()

	t.Setenv("HERMES_API_SERVER_URL", server.URL)
	t.Setenv("HERMES_API_SERVER_KEY", "test-key")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(
		http.MethodPost,
		"/pg/hermes/skills",
		strings.NewReader(`{"name":"demo","category":"work","content":"---\nname: demo\n---\nbody"}`),
	)
	c.Set("id", 42)

	HermesPlaygroundSkills(c)

	require.Equal(t, http.StatusCreated, recorder.Code)
	assert.JSONEq(t, `{"success":true}`, recorder.Body.String())
	assert.JSONEq(t, `{"name":"demo","category":"work","content":"---\nname: demo\n---\nbody"}`, receivedBody)
}

func TestHermesPlaygroundWeixinQRProxiesWithServerKeyAndAudits(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Create(&model.User{Id: 42, Username: "alice", Password: "password123"}).Error)

	var receivedPath string
	var receivedAuth string
	var receivedUser string
	var receivedSource string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		receivedAuth = r.Header.Get("Authorization")
		receivedUser = r.Header.Get("X-Hermes-User-Id")
		receivedSource = r.Header.Get("X-Hermes-Source")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusCreated)
		_, _ = w.Write([]byte(`{"platform":"weixin","status":"qr_ready","enabled":true,"request_id":"req_1"}`))
	}))
	defer server.Close()

	t.Setenv("HERMES_API_SERVER_URL", server.URL)
	t.Setenv("HERMES_API_SERVER_KEY", "test-key")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/hermes/platforms/weixin/qr", nil)
	c.Set("id", 42)

	HermesPlaygroundWeixinQR(c)

	require.Equal(t, http.StatusCreated, recorder.Code)
	assert.JSONEq(t, `{"platform":"weixin","status":"qr_ready","enabled":true,"request_id":"req_1"}`, recorder.Body.String())
	assert.Equal(t, "/v1/platforms/weixin/qr", receivedPath)
	assert.Equal(t, "Bearer test-key", receivedAuth)
	assert.Equal(t, "42", receivedUser)
	assert.Equal(t, "baizor-web-playground", receivedSource)

	var log model.Log
	require.NoError(t, db.Where("user_id = ? AND type = ?", 42, model.LogTypeManage).First(&log).Error)
	assert.Equal(t, "Started Hermes WeChat QR connection", log.Content)
	assert.Contains(t, log.Other, "hermes.weixin_qr_create")
}

func TestHermesPlaygroundWeixinQRStatusRejectsInvalidRequestID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/platforms/weixin/qr/bad%2Fid", nil)
	c.Params = gin.Params{{Key: "request_id", Value: "bad/id"}}
	c.Set("id", 42)

	HermesPlaygroundWeixinQRStatus(c)

	require.Equal(t, http.StatusBadRequest, recorder.Code)
	assert.JSONEq(t, `{"message":"invalid request_id"}`, recorder.Body.String())
}

func TestHermesPlaygroundProxyRequiresAPIKey(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("HERMES_API_SERVER_KEY", "")

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/toolsets", nil)
	c.Set("id", 42)

	HermesPlaygroundToolsets(c)

	require.Equal(t, http.StatusServiceUnavailable, recorder.Code)
	assert.JSONEq(t, `{"message":"HERMES_API_SERVER_KEY is not configured"}`, recorder.Body.String())
}
