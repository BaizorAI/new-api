package controller

import (
	"errors"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"
	"github.com/gin-gonic/gin"
)

type hermesTeamConversationRequest struct {
	Id              string `json:"id"`
	Title           string `json:"title"`
	StorageScope    string `json:"storage_scope"`
	HermesSessionId string `json:"hermes_session_id"`
	Pinned          bool   `json:"pinned"`
	Archived        bool   `json:"archived"`
	Messages        []any  `json:"messages"`
}

type hermesTeamConversationResponse struct {
	Id              string `json:"id"`
	Title           string `json:"title"`
	StorageScope    string `json:"storage_scope"`
	HermesSessionId string `json:"hermes_session_id"`
	Pinned          bool   `json:"pinned"`
	Archived        bool   `json:"archived"`
	CreatedBy       int    `json:"created_by"`
	UpdatedBy       int    `json:"updated_by"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
	Messages        []any  `json:"messages"`
}

func ListTeamHermesConversations(c *gin.Context) {
	team, err := getTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	conversations, err := model.ListHermesTeamConversations(team.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses := make([]hermesTeamConversationResponse, 0, len(conversations))
	for _, conversation := range conversations {
		response, err := buildHermesTeamConversationResponse(conversation)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		responses = append(responses, response)
	}
	common.ApiSuccess(c, responses)
}

func UpsertTeamHermesConversation(c *gin.Context) {
	team, err := getTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	conversationID := strings.TrimSpace(c.Param("conversation_id"))
	if err := validateHermesTeamConversationID(conversationID); err != nil {
		common.ApiError(c, err)
		return
	}

	var request hermesTeamConversationRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		common.ApiError(c, err)
		return
	}
	if strings.TrimSpace(request.Id) != "" && strings.TrimSpace(request.Id) != conversationID {
		common.ApiErrorMsg(c, "conversation id does not match")
		return
	}
	if len(request.Title) > 200 {
		request.Title = request.Title[:200]
	}
	if len(request.StorageScope) > 255 || len(request.HermesSessionId) > 255 {
		common.ApiErrorMsg(c, "conversation metadata is too long")
		return
	}
	messages, err := common.Marshal(request.Messages)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	conversation := &model.HermesTeamConversation{
		TeamId:          team.Id,
		ConversationId:  conversationID,
		Title:           strings.TrimSpace(request.Title),
		StorageScope:    strings.TrimSpace(request.StorageScope),
		HermesSessionId: strings.TrimSpace(request.HermesSessionId),
		Messages:        string(messages),
		Pinned:          request.Pinned,
		Archived:        request.Archived,
		CreatedBy:       c.GetInt("id"),
		UpdatedBy:       c.GetInt("id"),
	}
	if err := model.UpsertHermesTeamConversation(conversation); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func DeleteTeamHermesConversation(c *gin.Context) {
	team, err := getManageableTeamForCurrentUser(c)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	conversationID := strings.TrimSpace(c.Param("conversation_id"))
	if err := validateHermesTeamConversationID(conversationID); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteHermesTeamConversation(team.Id, conversationID); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func buildHermesTeamConversationResponse(conversation model.HermesTeamConversation) (hermesTeamConversationResponse, error) {
	messages := []any{}
	if strings.TrimSpace(conversation.Messages) != "" {
		if err := common.UnmarshalJsonStr(conversation.Messages, &messages); err != nil {
			return hermesTeamConversationResponse{}, err
		}
	}
	return hermesTeamConversationResponse{
		Id:              conversation.ConversationId,
		Title:           conversation.Title,
		StorageScope:    conversation.StorageScope,
		HermesSessionId: conversation.HermesSessionId,
		Pinned:          conversation.Pinned,
		Archived:        conversation.Archived,
		CreatedBy:       conversation.CreatedBy,
		UpdatedBy:       conversation.UpdatedBy,
		CreatedAt:       conversation.CreatedAt,
		UpdatedAt:       conversation.UpdatedAt,
		Messages:        messages,
	}, nil
}

func validateHermesTeamConversationID(value string) error {
	if value == "" {
		return errors.New("conversation id is required")
	}
	if len(value) > 128 {
		return errors.New("conversation id is too long")
	}
	for _, character := range value {
		if character >= 'a' && character <= 'z' {
			continue
		}
		if character >= 'A' && character <= 'Z' {
			continue
		}
		if character >= '0' && character <= '9' {
			continue
		}
		switch character {
		case '-', '_', '.', ':':
			continue
		}
		return errors.New("conversation id contains invalid characters")
	}
	return nil
}
