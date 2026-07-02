package model

import (
	"errors"
	"strings"

	"gorm.io/gorm"
)

type HermesUserConversation struct {
	Id              int    `json:"-"`
	UserId          int    `json:"user_id" gorm:"uniqueIndex:idx_hermes_user_conv;index"`
	ConversationId  string `json:"id" gorm:"column:conversation_id;type:varchar(128);uniqueIndex:idx_hermes_user_conv"`
	WorkspaceScope  string `json:"workspace_scope" gorm:"type:varchar(255);index"`
	Title           string `json:"title" gorm:"type:text"`
	TitleEdited     bool   `json:"title_edited"`
	StorageScope    string `json:"storage_scope" gorm:"type:varchar(255)"`
	HermesSessionId string `json:"hermes_session_id" gorm:"type:varchar(255)"`
	Messages        string `json:"-" gorm:"type:text"`
	Pinned          bool   `json:"pinned"`
	Archived        bool   `json:"archived"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt       int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

func ListHermesUserConversations(userId int, workspaceScope string) ([]HermesUserConversation, error) {
	var conversations []HermesUserConversation
	q := DB.Where("user_id = ?", userId)
	if strings.TrimSpace(workspaceScope) != "" {
		q = q.Where("workspace_scope = ?", strings.TrimSpace(workspaceScope))
	}
	err := q.Order("archived asc").
		Order("pinned desc").
		Order("updated_at desc").
		Find(&conversations).Error
	return conversations, err
}

func UpsertHermesUserConversation(conversation *HermesUserConversation) error {
	if conversation == nil {
		return errors.New("conversation is required")
	}
	conversation.ConversationId = strings.TrimSpace(conversation.ConversationId)
	if conversation.UserId <= 0 {
		return errors.New("user id is invalid")
	}
	if conversation.ConversationId == "" {
		return errors.New("conversation id is required")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		var existing HermesUserConversation
		err := tx.Where("user_id = ? AND conversation_id = ?", conversation.UserId, conversation.ConversationId).First(&existing).Error
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return tx.Create(conversation).Error
		}
		if err != nil {
			return err
		}

		updates := map[string]interface{}{
			"title":             conversation.Title,
			"title_edited":      conversation.TitleEdited,
			"workspace_scope":   conversation.WorkspaceScope,
			"storage_scope":     conversation.StorageScope,
			"hermes_session_id": conversation.HermesSessionId,
			"messages":          conversation.Messages,
			"pinned":            conversation.Pinned,
			"archived":          conversation.Archived,
		}
		return tx.Model(&existing).Updates(updates).Error
	})
}

func DeleteHermesUserConversation(userId int, conversationId string) error {
	conversationId = strings.TrimSpace(conversationId)
	if userId <= 0 || conversationId == "" {
		return errors.New("conversation is invalid")
	}
	return DB.Where("user_id = ? AND conversation_id = ?", userId, conversationId).Delete(&HermesUserConversation{}).Error
}
