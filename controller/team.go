package controller

import (
	"fmt"
	"strconv"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/i18n"
	"github.com/BaizorAI/new-api/model"
	"github.com/BaizorAI/new-api/setting/operation_setting"
	"github.com/gin-gonic/gin"
)

type createTeamRequest struct {
	Name string `json:"name"`
}

type addTeamMemberRequest struct {
	UsernameOrEmail string `json:"username_or_email"`
	Role            string `json:"role"`
}

type updateTeamMemberRoleRequest struct {
	Role string `json:"role"`
}

type teamQuotaTransferRequest struct {
	Quota int `json:"quota"`
}

func GetTeams(c *gin.Context) {
	teams, err := model.GetUserTeams(c.GetInt("id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, teams)
}

func CreateTeam(c *gin.Context) {
	req := createTeamRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	team, err := model.CreateTeam(c.GetInt("id"), req.Name)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, team)
}

func GetTeam(c *gin.Context) {
	team, err := getTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	members, err := model.ListTeamMembers(team.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tokens, err := model.ListTeamTokens(team.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{
		"team":    team,
		"members": members,
		"tokens":  buildMaskedTokenResponses(tokens),
	})
}

func AddTeamMember(c *gin.Context) {
	team, err := getManageableTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req := addTeamMemberRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	member, err := model.AddTeamMemberByUsernameOrEmail(team.Id, req.UsernameOrEmail, req.Role)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, member)
}

func SearchTeamMemberCandidates(c *gin.Context) {
	team, err := getManageableTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	candidates, err := model.SearchTeamMemberCandidates(team.Id, c.Query("keyword"), 10)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, candidates)
}

func UpdateTeamMemberRole(c *gin.Context) {
	team, err := getOwnedTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req := updateTeamMemberRoleRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	member, err := model.UpdateTeamMemberRole(team.Id, userId, req.Role)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, member)
}

func RemoveTeamMember(c *gin.Context) {
	team, err := getManageableTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId, err := strconv.Atoi(c.Param("user_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if userId == c.GetInt("id") {
		common.ApiErrorMsg(c, "cannot remove yourself from the team")
		return
	}
	if err := model.RemoveTeamMember(team.Id, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func TransferQuotaToTeam(c *gin.Context) {
	team, err := getManageableTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	req := teamQuotaTransferRequest{}
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.TransferUserQuotaToTeam(c.GetInt("id"), team.Id, req.Quota); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetTeamTokens(c *gin.Context) {
	team, err := getTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tokens, err := model.ListTeamTokens(team.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildMaskedTokenResponses(tokens))
}

func CreateTeamToken(c *gin.Context) {
	team, err := getManageableTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token := model.Token{}
	if err := c.ShouldBindJSON(&token); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := int(1000000000 * common.QuotaPerUnit)
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}
	count, err := model.CountTeamTokens(team.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	maxTokens := operation_setting.GetMaxUserTokens()
	if int(count) >= maxTokens {
		common.ApiErrorMsg(c, fmt.Sprintf("已达到最大令牌数量限制 (%d)", maxTokens))
		return
	}
	key, err := common.GenerateKey()
	if err != nil {
		common.ApiErrorI18n(c, i18n.MsgTokenGenerateFailed)
		common.SysLog("failed to generate team token key: " + err.Error())
		return
	}
	cleanToken := model.Token{
		UserId:             c.GetInt("id"),
		TeamId:             team.Id,
		Name:               strings.TrimSpace(token.Name),
		Key:                key,
		CreatedTime:        common.GetTimestamp(),
		AccessedTime:       common.GetTimestamp(),
		ExpiredTime:        token.ExpiredTime,
		RemainQuota:        token.RemainQuota,
		UnlimitedQuota:     token.UnlimitedQuota,
		ModelLimitsEnabled: token.ModelLimitsEnabled,
		ModelLimits:        token.ModelLimits,
		AllowIps:           token.AllowIps,
		Group:              token.Group,
		CrossGroupRetry:    token.CrossGroupRetry,
	}
	if cleanToken.Name == "" {
		cleanToken.Name = team.Name + " Team Key"
	}
	if err := cleanToken.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildMaskedTokenResponse(&cleanToken))
}

func UpdateTeamToken(c *gin.Context) {
	team, err := getManageableTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tokenId, err := strconv.Atoi(c.Param("token_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token := model.Token{}
	if err := c.ShouldBindJSON(&token); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(token.Name) > 50 {
		common.ApiErrorI18n(c, i18n.MsgTokenNameTooLong)
		return
	}
	if !token.UnlimitedQuota {
		if token.RemainQuota < 0 {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaNegative)
			return
		}
		maxQuotaValue := int(1000000000 * common.QuotaPerUnit)
		if token.RemainQuota > maxQuotaValue {
			common.ApiErrorI18n(c, i18n.MsgTokenQuotaExceedMax, map[string]any{"Max": maxQuotaValue})
			return
		}
	}
	cleanToken, err := model.GetTeamTokenById(team.Id, tokenId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if token.Status == common.TokenStatusEnabled {
		if cleanToken.Status == common.TokenStatusExpired && cleanToken.ExpiredTime <= common.GetTimestamp() && cleanToken.ExpiredTime != -1 {
			common.ApiErrorI18n(c, i18n.MsgTokenExpiredCannotEnable)
			return
		}
		if cleanToken.Status == common.TokenStatusExhausted && cleanToken.RemainQuota <= 0 && !cleanToken.UnlimitedQuota {
			common.ApiErrorI18n(c, i18n.MsgTokenExhaustedCannotEable)
			return
		}
	}
	if c.Query("status_only") != "" {
		cleanToken.Status = token.Status
	} else {
		cleanToken.Name = strings.TrimSpace(token.Name)
		cleanToken.ExpiredTime = token.ExpiredTime
		cleanToken.RemainQuota = token.RemainQuota
		cleanToken.UnlimitedQuota = token.UnlimitedQuota
		cleanToken.ModelLimitsEnabled = token.ModelLimitsEnabled
		cleanToken.ModelLimits = token.ModelLimits
		cleanToken.AllowIps = token.AllowIps
		cleanToken.Group = token.Group
		cleanToken.CrossGroupRetry = token.CrossGroupRetry
	}
	if err := cleanToken.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, buildMaskedTokenResponse(cleanToken))
}

func DeleteTeamToken(c *gin.Context) {
	team, err := getManageableTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tokenId, err := strconv.Atoi(c.Param("token_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token, err := model.GetTeamTokenById(team.Id, tokenId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if err := token.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func GetTeamTokenKey(c *gin.Context) {
	team, err := getTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	tokenId, err := strconv.Atoi(c.Param("token_id"))
	if err != nil {
		common.ApiError(c, err)
		return
	}
	token, err := model.GetTeamTokenById(team.Id, tokenId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"key": token.GetFullKey()})
}

func getTeamForCurrentUser(c *gin.Context) (*model.TeamWithRole, error) {
	teamId, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		return nil, err
	}
	return model.GetTeamByIdForUser(teamId, c.GetInt("id"))
}

func getManageableTeamForCurrentUser(c *gin.Context) (*model.TeamWithRole, error) {
	team, err := getTeamForCurrentUser(c)
	if err != nil {
		return nil, err
	}
	if !model.CanManageTeamRole(team.Role) {
		return nil, fmt.Errorf("no permission to manage team")
	}
	return team, nil
}

func getOwnedTeamForCurrentUser(c *gin.Context) (*model.TeamWithRole, error) {
	team, err := getTeamForCurrentUser(c)
	if err != nil {
		return nil, err
	}
	if team.Role != model.TeamRoleOwner {
		return nil, fmt.Errorf("only team owner can change member roles")
	}
	return team, nil
}
