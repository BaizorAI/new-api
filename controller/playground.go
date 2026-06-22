package controller

import (
	"errors"
	"fmt"
	"strconv"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/BaizorAI/new-api/model"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	"github.com/BaizorAI/new-api/types"

	"github.com/gin-gonic/gin"
)

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
