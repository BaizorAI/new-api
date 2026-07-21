package controller

import (
	"fmt"
	"strconv"
	"strings"
	"sync"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

// hermesSkillCreateRequest is the shared shape for skill create/update requests.
type hermesSkillCreateRequest struct {
	Name     string `json:"name"`
	Content  string `json:"content"`
	Category string `json:"category,omitempty"`
	Scope    string `json:"scope,omitempty"`
}

// hermesProxyResult captures the outcome of proxying a request to the Hermes
// sidecar so that audit loggers can inspect the response without re-parsing.
type hermesProxyResult struct {
	StatusCode int
	Body       []byte
}

// hermesWeixinStatusAuditResponse is the subset of the Hermes weixin status
// response needed for audit logging.
type hermesWeixinStatusAuditResponse struct {
	Status       string      `json:"status"`
	AccountLabel string      `json:"account_label"`
	ConnectedAt  interface{} `json:"connected_at"`
}

var (
	hermesWeixinConnectedAuditMu   sync.Mutex
	hermesWeixinConnectedAuditKeys = map[string]int64{}
)

const hermesWeixinConnectedAuditTTLSeconds int64 = 24 * 60 * 60

// resolveHermesSkillWriteScope determines the storage scope for a Hermes skill
// write (create/update/delete) and enforces team management permission when the
// request targets a team. Without an explicit scope the Hermes sidecar defaults
// to the personal ("user") space, so team-scoped writes must set scope to "team".
func resolveHermesSkillWriteScope(c *gin.Context) (string, error) {
	rawTeamID := strings.TrimSpace(c.GetHeader("X-Baizor-Team-Id"))
	if rawTeamID == "" || rawTeamID == "0" {
		return "user", nil
	}

	teamID, err := strconv.Atoi(rawTeamID)
	if err != nil || teamID <= 0 {
		return "", fmt.Errorf("team context is required")
	}

	team, err := model.GetTeamByIdForUser(teamID, c.GetInt("id"))
	if err != nil || !model.CanManageTeamRole(team.Role) {
		return "", fmt.Errorf("no permission to manage skills for this team")
	}

	return "team", nil
}

// applyHermesRequestedBillingContext sets the team billing context when the
// request explicitly asks to bill a team. It is used by the generic Playground
// endpoints as well as the Hermes proxy path.
func applyHermesRequestedBillingContext(c *gin.Context, userId int) error {
	if c == nil || c.Request == nil {
		return nil
	}

	rawTeamID := strings.TrimSpace(c.GetHeader("X-Baizor-Team-Id"))
	if rawTeamID == "" || rawTeamID == "0" {
		return nil
	}

	teamID, err := strconv.Atoi(rawTeamID)
	if err != nil || teamID <= 0 {
		return fmt.Errorf("invalid team billing account")
	}

	team, _, err := model.GetTeamForToken(teamID, userId)
	if err != nil {
		return fmt.Errorf("team billing account is unavailable")
	}

	common.SetContextKey(c, constant.ContextKeyTeamId, team.Id)
	common.SetContextKey(c, constant.ContextKeyTeamName, team.Name)
	common.SetContextKey(c, constant.ContextKeyTeamQuota, team.Quota)
	return nil
}

// hermesBoundedQueryInt parses a query parameter as a non-negative integer and
// caps it at the provided maximum.
func hermesBoundedQueryInt(value string, fallback int, maximum int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		return fallback
	}
	if parsed > maximum {
		return maximum
	}
	return parsed
}

// sanitizeHermesSessionID validates a session identifier. Allowed characters
// are ASCII letters, digits, and a small set of separators.
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

// scopedHermesSessionID prefixes a user-scoped session id to avoid collisions.
func scopedHermesSessionID(userID int, sessionID string) string {
	cleanSessionID := sanitizeHermesSessionID(sessionID)
	if cleanSessionID == "" {
		return "user-" + strconv.Itoa(userID)
	}
	return "user-" + strconv.Itoa(userID) + "-" + cleanSessionID
}

// scopedHermesTeamSessionID prefixes a team-scoped session id to avoid collisions.
func scopedHermesTeamSessionID(teamID int, sessionID string) string {
	cleanSessionID := sanitizeHermesSessionID(sessionID)
	if cleanSessionID == "" {
		return "team-" + strconv.Itoa(teamID)
	}
	return "team-" + strconv.Itoa(teamID) + "-" + cleanSessionID
}

// sanitizeHermesPathSegment validates a single path segment used in Hermes
// proxy URLs. It is stricter than sanitizeHermesSessionID because path
// segments should not contain ':' characters.
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

// recordHermesWeixinAudit writes a security audit entry for a WeChat platform
// operation, using a success action when the proxied request succeeded.
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

// recordHermesWeixinConnectedAudit records the first successful WeChat
// connection for a user/request combination, deduplicated within the TTL.
func recordHermesWeixinConnectedAudit(c *gin.Context, requestID string, result hermesProxyResult) {
	if result.StatusCode < 200 || result.StatusCode >= 300 || len(result.Body) == 0 {
		return
	}

	var response hermesWeixinStatusAuditResponse
	if err := common.Unmarshal(result.Body, &response); err != nil {
		return
	}
	if response.Status != "connected" {
		return
	}

	userID := c.GetInt("id")
	auditKey := fmt.Sprintf("user:%d:request:%s", userID, requestID)
	if requestID == "" {
		auditKey = fmt.Sprintf("user:%d:account:%s:connected:%v", userID, response.AccountLabel, response.ConnectedAt)
	}
	if !markHermesWeixinConnectedAuditOnce(auditKey) {
		return
	}

	params := map[string]interface{}{
		"operation":   "connect",
		"status_code": result.StatusCode,
	}
	if requestID != "" {
		params["request_id"] = requestID
	}
	if response.AccountLabel != "" {
		params["account_label"] = response.AccountLabel
	}
	if response.ConnectedAt != nil {
		params["connected_at"] = response.ConnectedAt
	}
	recordUserSecurityAudit(c, userID, "hermes.weixin_connected", params)
}

// markHermesWeixinConnectedAuditOnce records the audit key and returns true
// only if it has not been seen within the TTL.
func markHermesWeixinConnectedAuditOnce(key string) bool {
	now := common.GetTimestamp()

	hermesWeixinConnectedAuditMu.Lock()
	defer hermesWeixinConnectedAuditMu.Unlock()

	for auditKey, timestamp := range hermesWeixinConnectedAuditKeys {
		if now-timestamp > hermesWeixinConnectedAuditTTLSeconds {
			delete(hermesWeixinConnectedAuditKeys, auditKey)
		}
	}

	if _, ok := hermesWeixinConnectedAuditKeys[key]; ok {
		return false
	}
	hermesWeixinConnectedAuditKeys[key] = now
	return true
}
