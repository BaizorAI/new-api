package oauth

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/i18n"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/gin-gonic/gin"
)

func init() {
	Register("wechat_open", &WeChatProvider{})
}

// WeChatProvider implements OAuth for WeChat Open Platform (QR code login).
// WeChat OAuth flow is unique: the access_token endpoint returns the openid
// together with the token, so ExchangeToken stores the openid on the provider
// temporarily for GetUserInfo to consume.
type WeChatProvider struct {
	// lastOpenId is set by ExchangeToken and consumed by GetUserInfo.
	// It is NOT goroutine-safe; the controller guarantees sequential calls
	// per request (ExchangeToken -> GetUserInfo on the same goroutine).
	lastOpenId  string
	lastUnionId string
}

type wechatTokenResponse struct {
	AccessToken  string `json:"access_token"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
	OpenId       string `json:"openid"`
	Scope        string `json:"scope"`
	UnionId      string `json:"unionid"`
	ErrCode      int    `json:"errcode"`
	ErrMsg       string `json:"errmsg"`
}

type wechatUserInfo struct {
	OpenId     string `json:"openid"`
	Nickname   string `json:"nickname"`
	Sex        int    `json:"sex"`
	Province   string `json:"province"`
	City       string `json:"city"`
	Country    string `json:"country"`
	HeadImgUrl string `json:"headimgurl"`
	UnionId    string `json:"unionid"`
	ErrCode    int    `json:"errcode"`
	ErrMsg     string `json:"errmsg"`
}

func (p *WeChatProvider) GetName() string {
	return "WeChat"
}

func (p *WeChatProvider) IsEnabled() bool {
	return common.WeChatOAuthEnabled
}

// GetRedirectURI builds the redirect URI for the OAuth callback.
func (p *WeChatProvider) GetRedirectURI(c *gin.Context) string {
	serverAddress := common.GetEnvOrDefaultString("FRONTEND_URL", "")
	if serverAddress == "" {
		serverAddress = "https://" + c.Request.Host
	}
	return serverAddress + "/oauth/wechat_open"
}

// GetAuthorizeURL builds the WeChat Open Platform QR connect URL.
func (p *WeChatProvider) GetAuthorizeURL(c *gin.Context, state string) string {
	redirectURI := url.QueryEscape(p.GetRedirectURI(c))
	return fmt.Sprintf(
		"https://open.weixin.qq.com/connect/qrconnect?appid=%s&redirect_uri=%s&response_type=code&scope=snsapi_login&state=%s#wechat_redirect",
		common.WeChatAppId,
		redirectURI,
		url.QueryEscape(state),
	)
}

func (p *WeChatProvider) ExchangeToken(ctx context.Context, code string, c *gin.Context) (*OAuthToken, error) {
	if code == "" {
		return nil, NewOAuthError(i18n.MsgOAuthInvalidCode, nil)
	}

	logger.LogDebug(ctx, "[OAuth-WeChat] ExchangeToken: code=%s...", code[:min(len(code), 10)])

	tokenURL := fmt.Sprintf(
		"https://api.weixin.qq.com/sns/oauth2/access_token?appid=%s&secret=%s&code=%s&grant_type=authorization_code",
		common.WeChatAppId,
		common.WeChatAppSecret,
		url.QueryEscape(code),
	)

	req, err := http.NewRequestWithContext(ctx, "GET", tokenURL, nil)
	if err != nil {
		return nil, err
	}

	client := http.Client{Timeout: 20 * time.Second}
	res, err := client.Do(req)
	if err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChat] ExchangeToken error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "WeChat"}, err.Error())
	}
	defer res.Body.Close()

	var tokenResp wechatTokenResponse
	if err := json.NewDecoder(res.Body).Decode(&tokenResp); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChat] ExchangeToken decode error: %s", err.Error()))
		return nil, err
	}

	if tokenResp.ErrCode != 0 {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChat] ExchangeToken failed: errcode=%d, errmsg=%s", tokenResp.ErrCode, tokenResp.ErrMsg))
		return nil, NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "WeChat"})
	}

	if tokenResp.AccessToken == "" || tokenResp.OpenId == "" {
		logger.LogError(ctx, "[OAuth-WeChat] ExchangeToken failed: empty access_token or openid")
		return nil, NewOAuthError(i18n.MsgOAuthTokenFailed, map[string]any{"Provider": "WeChat"})
	}

	// Store openid/unionid for GetUserInfo (called sequentially on same provider instance)
	p.lastOpenId = tokenResp.OpenId
	p.lastUnionId = tokenResp.UnionId

	logger.LogDebug(ctx, "[OAuth-WeChat] ExchangeToken success: openid=%s, scope=%s", tokenResp.OpenId, tokenResp.Scope)

	return &OAuthToken{
		AccessToken:  tokenResp.AccessToken,
		RefreshToken: tokenResp.RefreshToken,
		ExpiresIn:    tokenResp.ExpiresIn,
		Scope:        tokenResp.Scope,
	}, nil
}

func (p *WeChatProvider) GetUserInfo(ctx context.Context, token *OAuthToken) (*OAuthUser, error) {
	openid := p.lastOpenId
	unionid := p.lastUnionId

	if openid == "" {
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "WeChat"})
	}

	logger.LogDebug(ctx, "[OAuth-WeChat] GetUserInfo: fetching user info for openid=%s", openid)

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
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChat] GetUserInfo error: %s", err.Error()))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthConnectFailed, map[string]any{"Provider": "WeChat"}, err.Error())
	}
	defer res.Body.Close()

	if res.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(res.Body)
		bodyStr := string(body)
		if len(bodyStr) > 500 {
			bodyStr = bodyStr[:500] + "..."
		}
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChat] GetUserInfo failed: status=%d, body=%s", res.StatusCode, bodyStr))
		return nil, NewOAuthErrorWithRaw(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "WeChat"}, fmt.Sprintf("status %d", res.StatusCode))
	}

	var userInfo wechatUserInfo
	if err := json.NewDecoder(res.Body).Decode(&userInfo); err != nil {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChat] GetUserInfo decode error: %s", err.Error()))
		return nil, err
	}

	if userInfo.ErrCode != 0 {
		logger.LogError(ctx, fmt.Sprintf("[OAuth-WeChat] GetUserInfo failed: errcode=%d, errmsg=%s", userInfo.ErrCode, userInfo.ErrMsg))
		return nil, NewOAuthError(i18n.MsgOAuthGetUserErr, map[string]any{"Provider": "WeChat"})
	}

	if userInfo.OpenId == "" {
		logger.LogError(ctx, "[OAuth-WeChat] GetUserInfo failed: empty openid")
		return nil, NewOAuthError(i18n.MsgOAuthUserInfoEmpty, map[string]any{"Provider": "WeChat"})
	}

	displayName := userInfo.Nickname
	if displayName == "" {
		displayName = "WeChat User"
	}

	logger.LogDebug(ctx, "[OAuth-WeChat] GetUserInfo success: openid=%s, nickname=%s", userInfo.OpenId, userInfo.Nickname)

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

func (p *WeChatProvider) IsUserIDTaken(providerUserID string) bool {
	return model.IsWeChatIdAlreadyTaken(providerUserID)
}

func (p *WeChatProvider) FillUserByProviderID(user *model.User, providerUserID string) error {
	user.WeChatId = providerUserID
	return user.FillUserByWeChatId()
}

func (p *WeChatProvider) SetProviderUserID(user *model.User, providerUserID string) {
	user.WeChatId = providerUserID
}

func (p *WeChatProvider) GetProviderPrefix() string {
	return "wechat_"
}
