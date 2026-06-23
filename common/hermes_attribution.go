package common

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"strings"
)

const (
	HermesDelegatedUserIDHeader     = "X-Baizor-Delegated-User-Id"
	HermesDelegatedTeamIDHeader     = "X-Baizor-Delegated-Team-Id"
	HermesDelegatedTeamNameHeader   = "X-Baizor-Delegated-Team-Name"
	HermesBillingScopeHeader        = "X-Baizor-Billing-Scope"
	HermesDelegatedSessionIDHeader  = "X-Baizor-Hermes-Session-Id"
	HermesDelegationExpiresHeader   = "X-Baizor-Delegation-Expires-At"
	HermesDelegationSignatureHeader = "X-Baizor-Delegation-Signature"
)

const (
	HermesBillingScopeUser = "user"
	HermesBillingScopeTeam = "team"
)

type HermesDelegationContext struct {
	UserID    int
	TeamID    int
	TeamName  string
	Scope     string
	SessionID string
	ExpiresAt int64
}

func BuildHermesDelegationHeaders(secret string, ctx HermesDelegationContext) map[string]string {
	secret = strings.TrimSpace(secret)
	if secret == "" || ctx.UserID <= 0 {
		return map[string]string{}
	}
	ctx.Scope = NormalizeHermesBillingScope(ctx.Scope, ctx.TeamID)

	headers := map[string]string{
		HermesDelegatedUserIDHeader:    strconv.Itoa(ctx.UserID),
		HermesDelegatedTeamIDHeader:    strconv.Itoa(ctx.TeamID),
		HermesDelegatedTeamNameHeader:  ctx.TeamName,
		HermesBillingScopeHeader:       ctx.Scope,
		HermesDelegatedSessionIDHeader: ctx.SessionID,
		HermesDelegationExpiresHeader:  strconv.FormatInt(ctx.ExpiresAt, 10),
	}
	headers[HermesDelegationSignatureHeader] = signHermesDelegation(secret, ctx)
	return headers
}

func VerifyHermesDelegationHeaders(headers http.Header, secret string, now int64) (HermesDelegationContext, bool, error) {
	var ctx HermesDelegationContext
	secret = strings.TrimSpace(secret)
	if secret == "" {
		return ctx, false, nil
	}

	rawUserID := strings.TrimSpace(headers.Get(HermesDelegatedUserIDHeader))
	if rawUserID == "" {
		return ctx, false, nil
	}
	userID, err := strconv.Atoi(rawUserID)
	if err != nil || userID <= 0 {
		return ctx, true, fmt.Errorf("invalid delegated user id")
	}

	teamID := 0
	rawTeamID := strings.TrimSpace(headers.Get(HermesDelegatedTeamIDHeader))
	if rawTeamID != "" {
		teamID, err = strconv.Atoi(rawTeamID)
		if err != nil || teamID < 0 {
			return ctx, true, fmt.Errorf("invalid delegated team id")
		}
	}

	expiresAt, err := strconv.ParseInt(strings.TrimSpace(headers.Get(HermesDelegationExpiresHeader)), 10, 64)
	if err != nil || expiresAt <= 0 {
		return ctx, true, fmt.Errorf("invalid delegation expiry")
	}
	if now > expiresAt {
		return ctx, true, fmt.Errorf("delegation expired")
	}

	ctx = HermesDelegationContext{
		UserID:    userID,
		TeamID:    teamID,
		TeamName:  strings.TrimSpace(headers.Get(HermesDelegatedTeamNameHeader)),
		Scope:     NormalizeHermesBillingScope(headers.Get(HermesBillingScopeHeader), teamID),
		SessionID: strings.TrimSpace(headers.Get(HermesDelegatedSessionIDHeader)),
		ExpiresAt: expiresAt,
	}

	expected := signHermesDelegation(secret, ctx)
	actual := strings.TrimSpace(headers.Get(HermesDelegationSignatureHeader))
	if actual == "" || !hmac.Equal([]byte(expected), []byte(actual)) {
		return ctx, true, fmt.Errorf("invalid delegation signature")
	}
	return ctx, true, nil
}

func NormalizeHermesBillingScope(scope string, teamID int) string {
	switch strings.ToLower(strings.TrimSpace(scope)) {
	case HermesBillingScopeTeam:
		if teamID > 0 {
			return HermesBillingScopeTeam
		}
		return HermesBillingScopeUser
	default:
		return HermesBillingScopeUser
	}
}

func signHermesDelegation(secret string, ctx HermesDelegationContext) string {
	message := strings.Join([]string{
		strconv.Itoa(ctx.UserID),
		strconv.Itoa(ctx.TeamID),
		ctx.TeamName,
		NormalizeHermesBillingScope(ctx.Scope, ctx.TeamID),
		ctx.SessionID,
		strconv.FormatInt(ctx.ExpiresAt, 10),
	}, "\n")
	mac := hmac.New(sha256.New, []byte(secret))
	_, _ = mac.Write([]byte(message))
	return hex.EncodeToString(mac.Sum(nil))
}
