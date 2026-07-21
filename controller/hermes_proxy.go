package controller

import (
	"bytes"
	"context"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"

	"github.com/gin-gonic/gin"
)

// applyHermesPlaygroundHeaderOverride injects Hermes attribution headers into
// the channel header override map when the request is a Hermes playground chat
// completion.
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
