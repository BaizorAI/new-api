package controller

import (
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"
	"github.com/BaizorAI/new-api/service"
	"github.com/gin-gonic/gin"
)

type hermesResultsSyncRequest struct {
	TeamId          int    `json:"team_id"`
	ConversationId  string `json:"conversation_id"`
	StorageScope    string `json:"storage_scope"`
	HermesSessionId string `json:"hermes_session_id"`
	Title           string `json:"title"`
	Messages        []any  `json:"messages"`
}

func ListHermesResults(c *gin.Context) {
	teamID, err := resolveHermesResultsTeamID(c, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if rawTeamID := strings.TrimSpace(c.Query("team_id")); rawTeamID != "" {
		parsedTeamID, parseErr := strconv.Atoi(rawTeamID)
		if parseErr != nil || parsedTeamID < 0 {
			common.ApiErrorMsg(c, "invalid team id")
			return
		}
		teamID, err = resolveHermesResultsTeamID(c, parsedTeamID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	limit, _ := strconv.Atoi(strings.TrimSpace(c.Query("limit")))
	results, err := model.ListHermesResults(model.HermesResultQuery{
		UserId:     c.GetInt("id"),
		TeamId:     teamID,
		ResultType: strings.TrimSpace(c.Query("type")),
		Query:      strings.TrimSpace(c.Query("q")),
		Limit:      limit,
	})
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, results)
}

func SyncHermesResults(c *gin.Context) {
	var request hermesResultsSyncRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
		return
	}
	teamID, err := resolveHermesResultsTeamID(c, request.TeamId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	conversationID := strings.TrimSpace(request.ConversationId)
	if err := validateHermesTeamConversationID(conversationID); err != nil {
		common.ApiError(c, err)
		return
	}
	if len(request.Title) > 200 {
		request.Title = request.Title[:200]
	}
	if len(request.StorageScope) > 255 || len(request.HermesSessionId) > 255 {
		common.ApiErrorMsg(c, "conversation metadata is too long")
		return
	}
	if err := service.SyncHermesResultsFromConversation(service.HermesResultConversationInput{
		UserId:          c.GetInt("id"),
		TeamId:          teamID,
		ConversationId:  conversationID,
		StorageScope:    strings.TrimSpace(request.StorageScope),
		HermesSessionId: strings.TrimSpace(request.HermesSessionId),
		Title:           strings.TrimSpace(request.Title),
		Messages:        request.Messages,
		UpdatedBy:       c.GetInt("id"),
	}); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func resolveHermesResultsTeamID(c *gin.Context, requestedTeamID int) (int, error) {
	teamID := requestedTeamID
	if headerTeamID := strings.TrimSpace(c.GetHeader("X-Baizor-Team-Id")); headerTeamID != "" {
		parsed, err := strconv.Atoi(headerTeamID)
		if err != nil || parsed < 0 {
			return 0, errors.New("invalid team id")
		}
		teamID = parsed
	}
	if teamID <= 0 {
		return 0, nil
	}
	if _, err := model.GetTeamByIdForUser(teamID, c.GetInt("id")); err != nil {
		return 0, err
	}
	return teamID, nil
}
