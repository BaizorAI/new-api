package controller

import (
	"bytes"
	"errors"
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
	"github.com/BaizorAI/new-api/model"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	"github.com/BaizorAI/new-api/types"

	"github.com/gin-gonic/gin"
)

type hermesSkillCreateRequest struct {
	Name     string `json:"name"`
	Content  string `json:"content"`
	Category string `json:"category,omitempty"`
}

type hermesProxyResult struct {
	StatusCode int
	Body       []byte
}

func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	applyHermesPlaygroundHeaderOverride(c, userId)

	Relay(c, types.RelayFormatOpenAI)
}

func HermesPlaygroundSkills(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	switch c.Request.Method {
	case http.MethodGet:
		proxyHermesPlayground(c, http.MethodGet, "/v1/skills", nil)
	case http.MethodPost:
		var request hermesSkillCreateRequest
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
			return
		}

		request.Name = strings.TrimSpace(request.Name)
		request.Category = strings.TrimSpace(request.Category)
		if request.Name == "" || strings.TrimSpace(request.Content) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "name and content are required"})
			return
		}

		body, err := common.Marshal(request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to encode request"})
			return
		}
		proxyHermesPlayground(c, http.MethodPost, "/v1/skills", body)
	default:
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
	}
}

func HermesPlaygroundToolsets(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	proxyHermesPlayground(c, http.MethodGet, "/v1/toolsets", nil)
}

func HermesPlaygroundWeixinStatus(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	proxyHermesPlayground(c, http.MethodGet, "/v1/platforms/weixin/status", nil)
}

func HermesPlaygroundWeixinQR(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodPost {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	result := proxyHermesPlayground(c, http.MethodPost, "/v1/platforms/weixin/qr", nil)
	recordHermesWeixinAudit(c, "hermes.weixin_qr_create", "create_qr", result)
}

func HermesPlaygroundWeixinQRStatus(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	requestID := sanitizeHermesPathSegment(c.Param("request_id"))
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request_id"})
		return
	}

	proxyHermesPlayground(c, http.MethodGet, "/v1/platforms/weixin/qr/"+url.PathEscape(requestID), nil)
}

func HermesPlaygroundWeixinDisconnect(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodPost {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	result := proxyHermesPlayground(c, http.MethodPost, "/v1/platforms/weixin/disconnect", nil)
	recordHermesWeixinAudit(c, "hermes.weixin_disconnect", "disconnect", result)
}

func applyHermesPlaygroundHeaderOverride(c *gin.Context, userId int) {
	if c == nil || c.Request == nil || !strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") {
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

	merged["X-Hermes-User-Id"] = strconv.Itoa(userId)
	merged["X-Hermes-Source"] = "baizor-web-playground"

	sessionId := sanitizeHermesSessionID(c.GetHeader("X-Baizor-Hermes-Session"))
	if sessionId == "" {
		sessionId = "user-" + strconv.Itoa(userId)
	}
	merged["X-Hermes-Session-Id"] = sessionId

	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, merged)
}

func proxyHermesPlayground(c *gin.Context, method string, path string, body []byte) hermesProxyResult {
	baseURL := strings.TrimRight(common.GetEnvOrDefaultString("HERMES_API_SERVER_URL", "http://baizor-hermes:8642"), "/")
	apiKey := strings.TrimSpace(common.GetEnvOrDefaultString("HERMES_API_SERVER_KEY", ""))
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
	parsedURL.RawQuery = ""

	var reader io.Reader
	if len(body) > 0 {
		reader = bytes.NewReader(body)
	}

	req, err := http.NewRequestWithContext(c.Request.Context(), method, parsedURL.String(), reader)
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
	req.Header.Set("X-Hermes-User-Id", strconv.Itoa(userId))
	req.Header.Set("X-Hermes-Source", "baizor-web-playground")
	sessionId := sanitizeHermesSessionID(c.GetHeader("X-Baizor-Hermes-Session"))
	if sessionId == "" {
		sessionId = "user-" + strconv.Itoa(userId)
	}
	req.Header.Set("X-Hermes-Session-Id", sessionId)

	client := &http.Client{Timeout: 30 * time.Second}
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

func sanitizeHermesSessionID(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 128 {
		return ""
	}

	for _, char := range value {
		if char >= 'a' && char <= 'z' {
			continue
		}
		if char >= 'A' && char <= 'Z' {
			continue
		}
		if char >= '0' && char <= '9' {
			continue
		}
		if strings.ContainsRune("._:-", char) {
			continue
		}
		return ""
	}

	return value
}

func sanitizeHermesPathSegment(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 128 {
		return ""
	}

	for _, char := range value {
		if char >= 'a' && char <= 'z' {
			continue
		}
		if char >= 'A' && char <= 'Z' {
			continue
		}
		if char >= '0' && char <= '9' {
			continue
		}
		if strings.ContainsRune("._-", char) {
			continue
		}
		return ""
	}

	return value
}

func recordHermesWeixinAudit(c *gin.Context, successAction string, operation string, result hermesProxyResult) {
	params := map[string]interface{}{
		"operation":   operation,
		"status_code": result.StatusCode,
	}
	if result.StatusCode >= 200 && result.StatusCode < 300 {
		recordUserSecurityAudit(c, c.GetInt("id"), successAction, params)
		return
	}
	recordUserSecurityAudit(c, c.GetInt("id"), "hermes.weixin_error", params)
}
