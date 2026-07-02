package controller

import (
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"
	"github.com/gin-gonic/gin"
)

type hermesUserConversationRequest struct {
	Id              string `json:"id"`
	WorkspaceScope  string `json:"workspace_scope"`
	Title           string `json:"title"`
	TitleEdited     bool   `json:"title_edited"`
	StorageScope    string `json:"storage_scope"`
	HermesSessionId string `json:"hermes_session_id"`
	Pinned          bool   `json:"pinned"`
	Archived        bool   `json:"archived"`
	Messages        []any  `json:"messages"`
}

type hermesUserConversationResponse struct {
	Id              string `json:"id"`
	WorkspaceScope  string `json:"workspace_scope"`
	Title           string `json:"title"`
	TitleEdited     bool   `json:"title_edited"`
	StorageScope    string `json:"storage_scope"`
	HermesSessionId string `json:"hermes_session_id"`
	Pinned          bool   `json:"pinned"`
	Archived        bool   `json:"archived"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
	Messages        []any  `json:"messages"`
}

func ListUserHermesConversations(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "unauthorized")
		return
	}
	scope := strings.TrimSpace(c.Query("scope"))
	if len(scope) > 255 {
		scope = scope[:255]
	}
	conversations, err := model.ListHermesUserConversations(userId, scope)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	responses := make([]hermesUserConversationResponse, 0, len(conversations))
	for _, conversation := range conversations {
		response, err := buildHermesUserConversationResponse(conversation)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		responses = append(responses, response)
	}
	common.ApiSuccess(c, responses)
}

func UpsertUserHermesConversation(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "unauthorized")
		return
	}
	conversationID := strings.TrimSpace(c.Param("conversation_id"))
	if err := validateHermesTeamConversationID(conversationID); err != nil {
		common.ApiError(c, err)
		return
	}

	var request hermesUserConversationRequest
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
	if len(request.WorkspaceScope) > 255 {
		request.WorkspaceScope = request.WorkspaceScope[:255]
	}
	messages, err := common.Marshal(request.Messages)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	conversation := &model.HermesUserConversation{
		UserId:          userId,
		ConversationId:  conversationID,
		WorkspaceScope:  strings.TrimSpace(request.WorkspaceScope),
		Title:           strings.TrimSpace(request.Title),
		TitleEdited:     request.TitleEdited,
		StorageScope:    strings.TrimSpace(request.StorageScope),
		HermesSessionId: strings.TrimSpace(request.HermesSessionId),
		Messages:        string(messages),
		Pinned:          request.Pinned,
		Archived:        request.Archived,
	}
	if err := model.UpsertHermesUserConversation(conversation); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func DeleteUserHermesConversation(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "unauthorized")
		return
	}
	conversationID := strings.TrimSpace(c.Param("conversation_id"))
	if err := validateHermesTeamConversationID(conversationID); err != nil {
		common.ApiError(c, err)
		return
	}
	if err := model.DeleteHermesUserConversation(userId, conversationID); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func buildHermesUserConversationResponse(conversation model.HermesUserConversation) (hermesUserConversationResponse, error) {
	messages := []any{}
	if strings.TrimSpace(conversation.Messages) != "" {
		if err := common.UnmarshalJsonStr(conversation.Messages, &messages); err != nil {
			return hermesUserConversationResponse{}, err
		}
	}
	return hermesUserConversationResponse{
		Id:              conversation.ConversationId,
		WorkspaceScope:  conversation.WorkspaceScope,
		Title:           conversation.Title,
		TitleEdited:     conversation.TitleEdited,
		StorageScope:    conversation.StorageScope,
		HermesSessionId: conversation.HermesSessionId,
		Pinned:          conversation.Pinned,
		Archived:        conversation.Archived,
		CreatedAt:       conversation.CreatedAt,
		UpdatedAt:       conversation.UpdatedAt,
		Messages:        messages,
	}, nil
}
