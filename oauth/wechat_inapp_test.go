package oauth

import (
	"context"
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestWeChatInAppGetUserInfoUsesTokenOpenIDForBaseScope(t *testing.T) {
	originalScope := common.WeChatInAppScope
	common.WeChatInAppScope = "snsapi_base"
	t.Cleanup(func() {
		common.WeChatInAppScope = originalScope
	})

	provider := &WeChatInAppProvider{}
	user, err := provider.GetUserInfo(context.Background(), &OAuthToken{
		OpenID:  "openid-from-this-login",
		UnionID: "union-from-this-login",
		Scope:   "snsapi_base",
	})

	require.NoError(t, err)
	require.NotNil(t, user)
	assert.Equal(t, "openid-from-this-login", user.ProviderUserID)
	assert.Equal(t, "wechat_openid-from-", user.Username)
	assert.Equal(t, "openid-from-this-login", user.Extra["openid"])
	assert.Equal(t, "union-from-this-login", user.Extra["unionid"])
}

func TestWeChatInAppGetUserInfoRequiresTokenOpenID(t *testing.T) {
	originalScope := common.WeChatInAppScope
	common.WeChatInAppScope = "snsapi_base"
	t.Cleanup(func() {
		common.WeChatInAppScope = originalScope
	})

	provider := &WeChatInAppProvider{}
	user, err := provider.GetUserInfo(context.Background(), &OAuthToken{
		Scope: "snsapi_base",
	})

	require.Error(t, err)
	assert.Nil(t, user)
}
