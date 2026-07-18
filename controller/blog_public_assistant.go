/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
package controller

import (
	"bytes"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

const (
	blogPublicAssistantEnabledEnv             = "BLOG_PUBLIC_ASSISTANT_ENABLED"
	blogPublicAssistantAccessTokenEnv         = "BLOG_PUBLIC_ASSISTANT_ACCESS_TOKEN"
	blogPublicAssistantRateLimitEnv           = "BLOG_PUBLIC_ASSISTANT_RATE_LIMIT"
	blogPublicAssistantRateLimitWindowEnv     = "BLOG_PUBLIC_ASSISTANT_RATE_LIMIT_WINDOW_SECONDS"
	blogPublicAssistantModelEnv               = "BLOG_PUBLIC_ASSISTANT_MODEL"
	blogPublicAssistantMaxContextChars        = 8000
	blogPublicAssistantDefaultRateLimit       = 5
	blogPublicAssistantDefaultRateLimitWindow = 60
)

var (
	blogPublicAssistantLimiter    common.InMemoryRateLimiter
	blogPublicAssistantConfigOnce sync.Once
	blogPublicAssistantEnabled    bool
	blogPublicAssistantUser       *model.User
	blogPublicAssistantInitErr    error
)

// blogPublicAssistantProxyWriter forwards Playground output to the original
// response writer so the anonymous assistant endpoint can stream SSE chunks.
type blogPublicAssistantProxyWriter struct {
	http.ResponseWriter
}

func (w *blogPublicAssistantProxyWriter) WriteHeader(code int) {
	w.ResponseWriter.WriteHeader(code)
}

func (w *blogPublicAssistantProxyWriter) Write(p []byte) (int, error) {
	return w.ResponseWriter.Write(p)
}

func (w *blogPublicAssistantProxyWriter) Header() http.Header {
	return w.ResponseWriter.Header()
}

func (w *blogPublicAssistantProxyWriter) Flush() {
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

func loadBlogPublicAssistantConfig() {
	blogPublicAssistantConfigOnce.Do(func() {
		blogPublicAssistantEnabled = common.GetEnvOrDefaultBool(blogPublicAssistantEnabledEnv, false)
		if !blogPublicAssistantEnabled {
			return
		}

		token := strings.TrimSpace(common.GetEnvOrDefaultString(blogPublicAssistantAccessTokenEnv, ""))
		if token == "" {
			blogPublicAssistantInitErr = fmt.Errorf("%s is required when %s is true", blogPublicAssistantAccessTokenEnv, blogPublicAssistantEnabledEnv)
			return
		}

		user, err := model.ValidateAccessToken(token)
		if err != nil {
			blogPublicAssistantInitErr = fmt.Errorf("failed to validate public assistant access token: %w", err)
			return
		}
		if user == nil {
			blogPublicAssistantInitErr = errors.New("public assistant access token is invalid")
			return
		}
		blogPublicAssistantUser = user
	})
}

func isBlogPublicAssistantEnabled() bool {
	loadBlogPublicAssistantConfig()
	return blogPublicAssistantEnabled && blogPublicAssistantUser != nil && blogPublicAssistantInitErr == nil
}

func checkBlogPublicAssistantRateLimit(clientIP string) bool {
	limit := common.GetEnvOrDefault(blogPublicAssistantRateLimitEnv, blogPublicAssistantDefaultRateLimit)
	window := common.GetEnvOrDefault(blogPublicAssistantRateLimitWindowEnv, blogPublicAssistantDefaultRateLimitWindow)
	if limit <= 0 || window <= 0 {
		return true
	}
	blogPublicAssistantLimiter.Init(time.Duration(window) * time.Second)
	key := fmt.Sprintf("blog_public_assistant:%s", clientIP)
	return blogPublicAssistantLimiter.Request(key, limit, int64(window))
}

func buildBlogPublicAssistantContext(article *model.BlogArticle) string {
	parts := make([]string, 0, 4)
	if article.Title != "" {
		parts = append(parts, fmt.Sprintf("标题：%s", article.Title))
	}
	if article.Summary != "" {
		parts = append(parts, fmt.Sprintf("摘要：%s", article.Summary))
	}
	content := article.Content
	if len(content) > blogPublicAssistantMaxContextChars {
		content = content[:blogPublicAssistantMaxContextChars] + "\n\n[...truncated]"
	}
	parts = append(parts, "", "--- 文章内容 ---", content, "---")
	return strings.Join(parts, "\n")
}

// BlogPublicAssistant handles anonymous AI reading assistant requests for a
// published article. It applies an IP-based rate limit, validates the article,
// builds the article context, and relays the request through the internal
// playground chat completion path using a configured service access token.
func BlogPublicAssistant(c *gin.Context) {
	loadBlogPublicAssistantConfig()
	if !blogPublicAssistantEnabled {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": "Public AI reading assistant is not enabled",
		})
		return
	}
	if blogPublicAssistantInitErr != nil {
		c.JSON(http.StatusServiceUnavailable, gin.H{
			"success": false,
			"message": blogPublicAssistantInitErr.Error(),
		})
		return
	}

	if !checkBlogPublicAssistantRateLimit(c.ClientIP()) {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"success": false,
			"message": "Rate limit exceeded. Please try again later.",
		})
		return
	}

	guid := strings.TrimSpace(c.Param("guid"))
	if guid == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "无效的 GUID",
		})
		return
	}

	var article *model.BlogArticle
	var err error
	if id, parseErr := strconv.Atoi(guid); parseErr == nil && id > 0 {
		article, err = model.GetBlogArticleById(id)
	} else {
		article, err = model.GetBlogArticleByGuid(guid)
	}
	if err != nil || article == nil {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "文章不存在",
		})
		return
	}
	if article.Status != model.BlogArticleStatusPublished {
		c.JSON(http.StatusNotFound, gin.H{
			"success": false,
			"message": "文章不存在或尚未发布",
		})
		return
	}

	var req struct {
		Messages []struct {
			Role    string `json:"role"`
			Content string `json:"content"`
		} `json:"messages"`
		Stream bool `json:"stream"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"success": false,
			"message": "请求体解析失败",
		})
		return
	}

	sysContext := buildBlogPublicAssistantContext(article)
	messages := []map[string]string{
		{"role": "system", "content": sysContext},
	}
	for _, m := range req.Messages {
		if m.Role == "system" {
			continue
		}
		messages = append(messages, map[string]string{
			"role":    m.Role,
			"content": m.Content,
		})
	}

	modelName := common.GetEnvOrDefaultString(blogPublicAssistantModelEnv, "huayu-v2")
	payload := map[string]any{
		"model":    modelName,
		"messages": messages,
		"stream":   req.Stream,
	}
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to build request",
		})
		return
	}

	request := httptest.NewRequest(http.MethodPost, "/pg/chat/completions", bytes.NewReader(payloadBytes))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("X-Baizor-Playground", "hermes")
	request.Header.Set("X-Baizor-Hermes-Skill-Activate", "/blog-reader-v1")
	request.Header.Set("X-Baizor-Hermes-Session", "blog_reader_public_"+article.Guid)

	proxyWriter := &blogPublicAssistantProxyWriter{ResponseWriter: c.Writer}
	sc, _ := gin.CreateTestContext(proxyWriter)
	sc.Request = request
	sc.Set(middleware.PlaygroundContextKey, true)
	sc.Set("id", blogPublicAssistantUser.Id)
	sc.Set("use_access_token", false)
	sc.Set("username", blogPublicAssistantUser.Username)
	sc.Set("role", blogPublicAssistantUser.Role)
	sc.Set("group", blogPublicAssistantUser.Group)
	sc.Set("user_group", blogPublicAssistantUser.Group)

	userCache, err := model.GetUserCache(blogPublicAssistantUser.Id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to load service user",
		})
		return
	}
	userCache.WriteContext(sc)
	common.SetContextKey(sc, constant.ContextKeyUsingGroup, userCache.Group)

	tempToken := &model.Token{
		UserId:         blogPublicAssistantUser.Id,
		Name:           "blog-public-assistant",
		Group:          userCache.Group,
		UnlimitedQuota: true,
	}
	if err := middleware.SetupContextForToken(sc, tempToken); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"success": false,
			"message": "failed to setup token context",
		})
		return
	}

	applyHermesPlaygroundHeaderOverride(sc, blogPublicAssistantUser.Id)

	middleware.Distribute()(sc)
	defer common.CleanupBodyStorage(sc)
	if sc.IsAborted() {
		return
	}

	Playground(sc)
}
