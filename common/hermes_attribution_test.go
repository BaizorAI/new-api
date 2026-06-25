package common

import (
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHermesDelegationHeadersVerify(t *testing.T) {
	headers := BuildHermesDelegationHeaders("secret", HermesDelegationContext{
		UserID:    42,
		TeamID:    7,
		TeamName:  "research",
		Scope:     HermesBillingScopeTeam,
		SessionID: "user-42-session",
		ExpiresAt: 200,
	})

	httpHeaders := http.Header{}
	for key, value := range headers {
		httpHeaders.Set(key, value)
	}

	ctx, ok, err := VerifyHermesDelegationHeaders(httpHeaders, "secret", 100)
	require.NoError(t, err)
	require.True(t, ok)
	assert.Equal(t, 42, ctx.UserID)
	assert.Equal(t, 7, ctx.TeamID)
	assert.Equal(t, "team", ctx.Scope)
	assert.Equal(t, "user-42-session", ctx.SessionID)
}

func TestHermesDelegationHeadersIgnoreTeamNameForSignature(t *testing.T) {
	headers := BuildHermesDelegationHeaders("secret", HermesDelegationContext{
		UserID:    42,
		TeamID:    7,
		TeamName:  "\u6708\u4eae\u88ab\u5403\u4e86",
		Scope:     HermesBillingScopeTeam,
		SessionID: "team-7-session",
		ExpiresAt: 200,
	})

	httpHeaders := http.Header{}
	for key, value := range headers {
		httpHeaders.Set(key, value)
	}
	httpHeaders.Set(HermesDelegatedTeamNameHeader, "")

	ctx, ok, err := VerifyHermesDelegationHeaders(httpHeaders, "secret", 100)
	require.NoError(t, err)
	require.True(t, ok)
	assert.Equal(t, 42, ctx.UserID)
	assert.Equal(t, 7, ctx.TeamID)
	assert.Equal(t, HermesBillingScopeTeam, ctx.Scope)
	assert.Empty(t, ctx.TeamName)
}

func TestHermesDelegationHeadersRejectTampering(t *testing.T) {
	headers := BuildHermesDelegationHeaders("secret", HermesDelegationContext{
		UserID:    42,
		Scope:     HermesBillingScopeUser,
		SessionID: "user-42",
		ExpiresAt: 200,
	})

	httpHeaders := http.Header{}
	for key, value := range headers {
		httpHeaders.Set(key, value)
	}
	httpHeaders.Set(HermesDelegatedUserIDHeader, "43")

	_, ok, err := VerifyHermesDelegationHeaders(httpHeaders, "secret", 100)
	require.Error(t, err)
	assert.True(t, ok)
}
