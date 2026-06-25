package controller

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strconv"
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
	t.Setenv("HERMES_API_SERVER_KEY", "test-secret")

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
	assert.Equal(t, "user-42-session_123", headers["X-Hermes-Session-Id"])
	assert.Equal(t, "baizor-web-playground", headers["X-Hermes-Source"])
	assert.Equal(t, "user", headers["X-Hermes-Billing-Scope"])
	assert.Equal(t, "42", headers[common.HermesDelegatedUserIDHeader])
	assert.Equal(t, "user", headers[common.HermesBillingScopeHeader])
	assert.Equal(t, "keep", headers["X-Other"])
}

func TestApplyHermesPlaygroundHeaderOverrideAddsTeamAttribution(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("HERMES_API_SERVER_KEY", "test-secret")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/chat/completions", nil)
	c.Request.Header.Set("X-Baizor-Playground", "hermes")
	c.Request.Header.Set("X-Baizor-Hermes-Session", "session_team")
	common.SetContextKey(c, constant.ContextKeyTeamId, 7)
	common.SetContextKey(c, constant.ContextKeyTeamName, "research")

	applyHermesPlaygroundHeaderOverride(c, 42)

	headers := common.GetContextKeyStringMap(c, constant.ContextKeyChannelHeaderOverride)
	require.NotNil(t, headers)
	assert.Equal(t, "7", headers["X-Hermes-Team-Id"])
	assert.Equal(t, "research", headers["X-Hermes-Team-Name"])
	assert.Equal(t, "team", headers["X-Hermes-Billing-Scope"])
	assert.Equal(t, "7", headers[common.HermesDelegatedTeamIDHeader])
	assert.Equal(t, "research", headers[common.HermesDelegatedTeamNameHeader])
	assert.Equal(t, "team", headers[common.HermesBillingScopeHeader])

	header := http.Header{}
	for key, value := range headers {
		if text, ok := value.(string); ok {
			header.Set(key, text)
		}
	}
	delegation, ok, err := common.VerifyHermesDelegationHeaders(header, "test-secret", common.GetTimestamp())
	require.NoError(t, err)
	require.True(t, ok)
	assert.Equal(t, 42, delegation.UserID)
	assert.Equal(t, 7, delegation.TeamID)
	assert.Equal(t, "team", delegation.Scope)
	assert.Equal(t, "user-42-session_team", delegation.SessionID)
}

func TestApplyHermesPlaygroundHeaderOverrideUsesTeamScopedSessionForTeamWorkspace(t *testing.T) {
	gin.SetMode(gin.TestMode)
	t.Setenv("HERMES_API_SERVER_KEY", "test-secret")

	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/chat/completions", nil)
	c.Request.Header.Set("X-Baizor-Playground", "hermes")
	c.Request.Header.Set("X-Baizor-Hermes-Workspace", "team_workspace")
	c.Request.Header.Set("X-Baizor-Hermes-Session", "team_workspace_7_default")
	common.SetContextKey(c, constant.ContextKeyTeamId, 7)

	applyHermesPlaygroundHeaderOverride(c, 42)

	headers := common.GetContextKeyStringMap(c, constant.ContextKeyChannelHeaderOverride)
	require.NotNil(t, headers)
	assert.Equal(t, "team-7-team_workspace_7_default", headers["X-Hermes-Session-Id"])
	assert.Equal(t, "team-7-team_workspace_7_default", headers[common.HermesDelegatedSessionIDHeader])
}

func TestApplyHermesRequestedBillingContextValidatesTeamMembership(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Team{}, &model.TeamMember{}))
	require.NoError(t, db.Create(&model.Team{Id: 7, Name: "research", OwnerId: 42, Quota: 1000, Status: model.TeamStatusEnabled}).Error)
	require.NoError(t, db.Create(&model.TeamMember{TeamId: 7, UserId: 42, Role: model.TeamRoleOwner, Status: model.TeamStatusEnabled}).Error)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/pg/chat/completions", nil)
	c.Request.Header.Set("X-Baizor-Team-Id", "7")

	require.NoError(t, applyHermesRequestedBillingContext(c, 42))
	assert.Equal(t, 7, common.GetContextKeyInt(c, constant.ContextKeyTeamId))
	assert.Equal(t, "research", common.GetContextKeyString(c, constant.ContextKeyTeamName))
	assert.Equal(t, 1000, common.GetContextKeyInt(c, constant.ContextKeyTeamQuota))

	otherRecorder := httptest.NewRecorder()
	otherContext, _ := gin.CreateTestContext(otherRecorder)
	otherContext.Request = httptest.NewRequest(http.MethodPost, "/pg/chat/completions", nil)
	otherContext.Request.Header.Set("X-Baizor-Team-Id", "7")

	require.Error(t, applyHermesRequestedBillingContext(otherContext, 43))
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

func TestScopedHermesSessionID(t *testing.T) {
	assert.Equal(t, "user-42-session_123", scopedHermesSessionID(42, "session_123"))
	assert.Equal(t, "user-42", scopedHermesSessionID(42, ""))
	assert.Equal(t, "user-42", scopedHermesSessionID(42, "bad\r\nid"))
}

func TestHermesPlaygroundToolsetsProxiesWithUserHeaders(t *testing.T) {
	gin.SetMode(gin.TestMode)

	var receivedPath string
	var receivedAuth string
	var receivedUser string
	var receivedSession string
	var receivedSource string
	var receivedBillingScope string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		receivedPath = r.URL.Path
		receivedAuth = r.Header.Get("Authorization")
		receivedUser = r.Header.Get("X-Hermes-User-Id")
		receivedSession = r.Header.Get("X-Hermes-Session-Id")
		receivedSource = r.Header.Get("X-Hermes-Source")
		receivedBillingScope = r.Header.Get("X-Hermes-Billing-Scope")
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
	assert.Equal(t, "user-42-session-456", receivedSession)
	assert.Equal(t, "baizor-web-playground", receivedSource)
	assert.Equal(t, "user", receivedBillingScope)
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

func TestHermesPlaygroundSkillsAreScopedByCurrentUserHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	receivedUsers := make([]string, 0, 2)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		userID := r.Header.Get("X-Hermes-User-Id")
		receivedUsers = append(receivedUsers, userID)
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"object":"list","data":[{"name":"skill_user_` + userID + `"}]}`))
	}))
	defer server.Close()

	t.Setenv("HERMES_API_SERVER_URL", server.URL)
	t.Setenv("HERMES_API_SERVER_KEY", "test-key")

	for _, userID := range []int{42, 43} {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/skills", nil)
		c.Set("id", userID)

		HermesPlaygroundSkills(c)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.JSONEq(t, `{"object":"list","data":[{"name":"skill_user_`+strconv.Itoa(userID)+`"}]}`, recorder.Body.String())
	}

	assert.Equal(t, []string{"42", "43"}, receivedUsers)
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

func TestHermesPlaygroundWeixinQRStatusAuditsConnectedOnce(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Create(&model.User{Id: 42, Username: "alice", Password: "password123"}).Error)

	hermesWeixinConnectedAuditMu.Lock()
	hermesWeixinConnectedAuditKeys = map[string]int64{}
	hermesWeixinConnectedAuditMu.Unlock()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"platform":"weixin","status":"connected","enabled":true,"request_id":"req_1","account_label":"wx***","connected_at":123}`))
	}))
	defer server.Close()

	t.Setenv("HERMES_API_SERVER_URL", server.URL)
	t.Setenv("HERMES_API_SERVER_KEY", "test-key")

	for i := 0; i < 2; i++ {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/platforms/weixin/qr/req_1", nil)
		c.Params = gin.Params{{Key: "request_id", Value: "req_1"}}
		c.Set("id", 42)

		HermesPlaygroundWeixinQRStatus(c)

		require.Equal(t, http.StatusOK, recorder.Code)
		assert.JSONEq(t, `{"platform":"weixin","status":"connected","enabled":true,"request_id":"req_1","account_label":"wx***","connected_at":123}`, recorder.Body.String())
	}

	var count int64
	require.NoError(t, db.Model(&model.Log{}).Where("user_id = ? AND type = ? AND content = ?", 42, model.LogTypeManage, "Connected Hermes WeChat account").Count(&count).Error)
	assert.Equal(t, int64(1), count)
}

func TestHermesPlaygroundWeixinConnectedAuditIsScopedByUser(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Log{}))
	require.NoError(t, db.Create(&model.User{Id: 42, Username: "alice", Password: "password123", AffCode: "a042"}).Error)
	require.NoError(t, db.Create(&model.User{Id: 43, Username: "bob", Password: "password123", AffCode: "b043"}).Error)

	hermesWeixinConnectedAuditMu.Lock()
	hermesWeixinConnectedAuditKeys = map[string]int64{}
	hermesWeixinConnectedAuditMu.Unlock()

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"platform":"weixin","status":"connected","enabled":true,"request_id":"req_shared","account_label":"wx***"}`))
	}))
	defer server.Close()

	t.Setenv("HERMES_API_SERVER_URL", server.URL)
	t.Setenv("HERMES_API_SERVER_KEY", "test-key")

	for _, userID := range []int{42, 43} {
		recorder := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(recorder)
		c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/platforms/weixin/qr/req_shared", nil)
		c.Params = gin.Params{{Key: "request_id", Value: "req_shared"}}
		c.Set("id", userID)

		HermesPlaygroundWeixinQRStatus(c)

		require.Equal(t, http.StatusOK, recorder.Code)
	}

	for _, userID := range []int{42, 43} {
		var count int64
		require.NoError(t, db.Model(&model.Log{}).Where("user_id = ? AND type = ? AND content = ?", userID, model.LogTypeManage, "Connected Hermes WeChat account").Count(&count).Error)
		assert.Equal(t, int64(1), count)
	}
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
