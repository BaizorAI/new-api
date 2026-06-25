package model

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

type HermesTeamConversation struct {
	Id              int    `json:"-"`
	TeamId          int    `json:"team_id" gorm:"uniqueIndex:idx_hermes_team_conversation;index"`
	ConversationId  string `json:"id" gorm:"column:conversation_id;type:varchar(128);uniqueIndex:idx_hermes_team_conversation"`
	Title           string `json:"title" gorm:"type:text"`
	StorageScope    string `json:"storage_scope" gorm:"type:varchar(255)"`
	HermesSessionId string `json:"hermes_session_id" gorm:"type:varchar(255)"`
	Messages        string `json:"-" gorm:"type:text"`
	Pinned          bool   `json:"pinned"`
	Archived        bool   `json:"archived"`
	CreatedBy       int    `json:"created_by" gorm:"index"`
	UpdatedBy       int    `json:"updated_by" gorm:"index"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt       int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func ListHermesTeamConversations(teamId int) ([]HermesTeamConversation, error) {
	var conversations []HermesTeamConversation
	err := DB.Where("team_id = ?", teamId).
		Order("archived asc").
		Order("pinned desc").
		Order("updated_at desc").
		Find(&conversations).Error
	return conversations, err
}

func UpsertHermesTeamConversation(conversation *HermesTeamConversation) error {
	if conversation == nil {
		return errors.New("conversation is required")
	}
	conversation.ConversationId = strings.TrimSpace(conversation.ConversationId)
	if conversation.TeamId <= 0 {
		return errors.New("team id is invalid")
	}
	if conversation.ConversationId == "" {
		return errors.New("conversation id is required")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var existing HermesTeamConversation
		err := tx.Where("team_id = ? AND conversation_id = ?", conversation.TeamId, conversation.ConversationId).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return tx.Create(conversation).Error
		}
		if err != nil {
			return err
		}

		updates := map[string]interface{}{
			"title":             conversation.Title,
			"storage_scope":     conversation.StorageScope,
			"hermes_session_id": conversation.HermesSessionId,
			"messages":          conversation.Messages,
			"pinned":            conversation.Pinned,
			"archived":          conversation.Archived,
			"updated_by":        conversation.UpdatedBy,
		}
		return tx.Model(&existing).Updates(updates).Error
	})
}

func DeleteHermesTeamConversation(teamId int, conversationId string) error {
	conversationId = strings.TrimSpace(conversationId)
	if teamId <= 0 || conversationId == "" {
		return errors.New("conversation is invalid")
	}
	return DB.Where("team_id = ? AND conversation_id = ?", teamId, conversationId).Delete(&HermesTeamConversation{}).Error
}
