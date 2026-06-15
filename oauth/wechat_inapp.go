package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/i18n"
	"github.com/BaizorAI/new-api/logger"
	"github.com/BaizorAI/new-api/model"
	"github.com/gin-gonic/gin"
)

func init() {
	Register("wechat_inapp", &WeChatInAppProvider{})
}

// WeChatInAppProvider implements OAuth for WeChat in-app browser login.
// When a user visits the site inside the WeChat built-in browser, this
// provider authenticates them via WeChat's service account OAuth flow.
// It follows the same pattern as WeChatProvider but uses different app
// credentials and the snsapi_userinfo (or snsapi_base) scope.
type WeChatInAppProvider struct {
	lastOpenId  string
	lastUnionId string
}

func (p *WeChatInAppProvider) GetName() string {
	return "WeChat In-App"
}

func (p *WeChatInAppProvider) IsEnabled() bool {
	return common.WeChatInAppOAuthEnabled
}

// GetRedirectURI builds the redirect URI for the in-app OAuth callback.
func (p *WeChatInAppProvider) GetRedirectURI(c *gin.Context) string {
	serverAddress := common.GetEnvOrDefaultString("FRONTEND_URL", "")
	if serverAddress == "" {
		serverAddress = "https://" + c.Request.Host
	}
	return serverAddress + "/oauth/wechat_inapp"
}

// GetAuthorizeURL builds the WeChat service account OAuth authorize URL.
func (p *WeChatInAppProvider) GetAuthorizeURL(c *gin.Context, state string) string {
	redirectURI := url.QueryEscape(p.GetRedirectURI(c))
	scope := common.WeChatInAppScope
	if scope == "" {
		scope = "snsapi_userinfo"
	}
	return fmt.Sprintf(
		"https://open.weixin.qq.com/connect/oauth2/authorize?appid=%s&redirect_uri=%s&response_type=code&scope=%s&state=%s#wechat_redirect",
		common.WeChatInAppAppId,
		redirectURI,
		scope,
		url.QueryEscape(state),
	)
}

// IsWeChatBrowser checks whether the request comes from WeChat's built-in browser.
func IsWeChatBrowser(userAgent string) bool {
	return userAgent != "" && regexp.MustCompile(`MicroMessenger`).MatchString(userAgent)
}

func (p *WeChatInAppProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	logger.LogDebug(ctx, "[OAuth-WeChatInApp] ExchangeToken: code=%s...", code[:min(len(code), 10)])

	tokenURL := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/oauth2/access_token?appid=%s&secret=%s&code=%s&grant_type=authorization_code",
		common.WeChatInAppAppId,
		common.WeChatInAppSecret,
		url.QueryEscape(code),
	)

	req, err := http.NewRequestWithContext(ctx, "GET", tokenURL, nil)
	if err != nil {
		return nil, err
	}

	client := http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChatInApp] ExchangeToken error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "WeChat"}, err.Error())
	}
	defer res.Body.Close()

	var tokenResp wechatTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&tokenResp); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChatInApp] ExchangeToken decode error: %s", err.Error()))
		return nil, err
	}

	if tokenResp.ErrCode != 0 {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChatInApp] ExchangeToken failed: errcode=%d, errmsg=%s", tokenResp.ErrCode, tokenResp.ErrMsg))
		return nil, NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "WeChat"})
	}

	if tokenResp.AccessToken == "" || tokenResp.OpenId == "" {
		logger.LogError(ctx, "[OAuth-WeChatInApp] ExchangeToken failed: empty access_token or openid")
		return nil, NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "WeChat"})
	}

	p.lastOpenId = tokenResp.OpenId
	p.lastUnionId = tokenResp.UnionId

	logger.LogDebug(ctx, "[OAuth-WeChatInApp] ExchangeToken success: openid=%s, scope=%s", tokenResp.OpenId, tokenResp.Scope)

	return &OAuthToken{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresIn:    tokenResp.ExpiresIn,
		Scope:        tokenResp.Scope,
	}, nil
}

func (p *WeChatInAppProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	openid := p.lastOpenId
	unionid := p.lastUnionId

	if openid == "" {
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "WeChat"})
	}

	// If scope is snsapi_base, skip userinfo API (it would fail) and use openid only
	scope := common.WeChatInAppScope
	if scope == "snsapi_base" || token.Scope == "snsapi_base" {
		logger.LogDebug(ctx, "[OAuth-WeChatInApp] GetUserInfo: snsapi_base scope, using openid only")
		return &OAuthUser{
			ProviderUserID: openid,
			Username:       "wechat_" + openid[:min(len(openid), 12)],
			DisplayName:    "WeChat User",
			Extra: map[string]any{
				"openid":    openid,
				"unionid":   unionid,
				"legacy_id": openid,
			},
		}, nil
	}

	logger.LogDebug(ctx, "[OAuth-WeChatInApp] GetUserInfo: fetching user info for openid=%s", openid)

	userInfoURL := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/userinfo?access_token=%s&openid=%s&lang=zh_CN",
		url.QueryEscape(token.AccessToken),
		url.QueryEscape(openid),
	)

	req, err := http.NewRequestWithContext(ctx, "GET", userInfoURL, nil)
	if err != nil {
		return nil, err
	}

	client := http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChatInApp] GetUserInfo error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "WeChat"}, err.Error())
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChatInApp] GetUserInfo failed: status=%d, body=%s", res.StatusCode, bodyStr))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "WeChat"}, fmt.Sprintf("status %d", res.StatusCode))
	}

	var userInfo wechatUserInfo
	if err := json.NewDecoder(res.Body).Decode(&userInfo); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChatInApp] GetUserInfo decode error: %s", err.Error()))
		return nil, err
	}

	if userInfo.ErrCode != 0 {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChatInApp] GetUserInfo failed: errcode=%d, errmsg=%s", userInfo.ErrCode, userInfo.ErrMsg))
		return nil, NewOAuthError(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "WeChat"})
	}

	if userInfo.OpenId == "" {
		logger.LogError(ctx, "[OAuth-WeChatInApp] GetUserInfo failed: empty openid")
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "WeChat"})
	}

	displayName := userInfo.Nickname
	if displayName == "" {
		displayName = "WeChat User"
	}

	logger.LogDebug(ctx, "[OAuth-WeChatInApp] GetUserInfo success: openid=%s, nickname=%s", userInfo.OpenId, userInfo.Nickname)

	return &OAuthUser{
		ProviderUserID: userInfo.OpenId,
		Username:       "wechat_" + userInfo.OpenId[:min(len(userInfo.OpenId), 12)],
		DisplayName:    displayName,
		Extra: map[string]any{
			"unionid":   unionid,
			"headimg":   userInfo.HeadImgUrl,
			"openid":    userInfo.OpenId,
			"legacy_id": userInfo.OpenId,
		},
	}, nil
}

func (p *WeChatInAppProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsWeChatIdAlreadyTaken(providerUserID)
}

func (p *WeChatInAppProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.WeChatId = providerUserID
	return user.FillUserByWeChatId()
}

func (p *WeChatInAppProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.WeChatId = providerUserID
}

func (p *WeChatInAppProvider) GetProviderPrefix() string {
	return "wechat_"
}
