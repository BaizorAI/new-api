package model

import (
	"crypto/sha1"
	"encoding/hex"
	"errors"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

const (
	HermesResultTypePPT        = "ppt"
	HermesResultTypeReport     = "report"
	HermesResultTypeDocument   = "document"
	HermesResultTypeAttachment = "attachment"

	HermesResultSourceArtifact     = "artifact"
	HermesResultSourceAttachment   = "attachment"
	HermesResultSourceConversation = "conversation"
)

type HermesResult struct {
	Id              int    `json:"-"`
	ResultKey       string `json:"result_key" gorm:"type:varchar(64);uniqueIndex"`
	UserId          int    `json:"user_id" gorm:"index"`
	TeamId          int    `json:"team_id" gorm:"index"`
	ConversationId  string `json:"conversation_id" gorm:"type:varchar(128);index"`
	StorageScope    string `json:"storage_scope" gorm:"type:varchar(255)"`
	HermesSessionId string `json:"hermes_session_id" gorm:"type:varchar(255)"`
	Title           string `json:"title" gorm:"type:varchar(255)"`
	FileName        string `json:"file_name" gorm:"type:varchar(255);index"`
	Href            string `json:"href" gorm:"type:text"`
	MediaType       string `json:"media_type" gorm:"type:varchar(128)"`
	Size            int64  `json:"size"`
	ResultType      string `json:"result_type" gorm:"type:varchar(32);index"`
	Source          string `json:"source" gorm:"type:varchar(32);index"`
	SourceMessageId string `json:"source_message_id" gorm:"type:varchar(128)"`
	CreatedBy       int    `json:"created_by" gorm:"index"`
	UpdatedBy       int    `json:"updated_by" gorm:"index"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt       int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
}

type HermesResultQuery struct {
	UserId     int
	TeamId     int
	ResultType string
	Query      string
	Limit      int
}

func BuildHermesResultKey(userId int, teamId int, conversationId string, source string, href string, fileName string) string {
	parts := []string{
		strings.TrimSpace(conversationId),
		strings.TrimSpace(source),
		strings.TrimSpace(href),
		strings.TrimSpace(fileName),
	}
	scope := "user:" + strconv.Itoa(userId)
	if teamId > 0 {
		scope = "team:" + strconv.Itoa(teamId)
	}
	h := sha1.Sum([]byte(scope + strings.Join(parts, "|")))
	return hex.EncodeToString(h[:])
}

func ReplaceHermesResultsForConversation(userId int, teamId int, conversationId string, results []HermesResult) error {
	conversationId = strings.TrimSpace(conversationId)
	if conversationId == "" {
		return errors.New("conversation id is required")
	}
	if teamId <= 0 && userId <= 0 {
		return errors.New("result owner is required")
	}

	return DB.Transaction(func(tx *gorm.DB) error {
		query := tx.Where("conversation_id = ?", conversationId)
		if teamId > 0 {
			query = query.Where("team_id = ?", teamId)
		} else {
			query = query.Where("user_id = ? AND team_id = 0", userId)
		}
		if err := query.Delete(&HermesResult{}).Error; err != nil {
			return err
		}
		if len(results) == 0 {
			return nil
		}
		for i := range results {
			results[i].UserId = userId
			results[i].TeamId = teamId
			results[i].ConversationId = conversationId
			results[i].ResultKey = BuildHermesResultKey(
				userId,
				teamId,
				conversationId,
				results[i].Source,
				results[i].Href,
				results[i].FileName,
			)
		}
		return tx.Create(&results).Error
	})
}

func UpsertHermesResults(userId int, teamId int, conversationId string, results []HermesResult) error {
	conversationId = strings.TrimSpace(conversationId)
	if conversationId == "" {
		return errors.New("conversation id is required")
	}
	if teamId <= 0 && userId <= 0 {
		return errors.New("result owner is required")
	}
	if len(results) == 0 {
		return nil
	}
	return DB.Transaction(func(tx *gorm.DB) error {
		for i := range results {
			results[i].UserId = userId
			results[i].TeamId = teamId
			results[i].ConversationId = conversationId
			results[i].ResultKey = BuildHermesResultKey(
				userId,
				teamId,
				conversationId,
				results[i].Source,
				results[i].Href,
				results[i].FileName,
			)

			var existing HermesResult
			err := tx.Where("result_key = ?", results[i].ResultKey).First(&existing).Error
			if errors.Is(err, gorm.ErrRecordNotFound) {
				if err := tx.Create(&results[i]).Error; err != nil {
					return err
				}
				continue
			}
			if err != nil {
				return err
			}
			updates := map[string]interface{}{
				"storage_scope":     results[i].StorageScope,
				"hermes_session_id": results[i].HermesSessionId,
				"title":             results[i].Title,
				"file_name":         results[i].FileName,
				"href":              results[i].Href,
				"media_type":        results[i].MediaType,
				"size":              results[i].Size,
				"result_type":       results[i].ResultType,
				"source":            results[i].Source,
				"source_message_id": results[i].SourceMessageId,
				"updated_by":        results[i].UpdatedBy,
			}
			if err := tx.Model(&existing).Updates(updates).Error; err != nil {
				return err
			}
		}
		return nil
	})
}
func DeleteHermesResultsForConversation(userId int, teamId int, conversationId string) error {
	conversationId = strings.TrimSpace(conversationId)
	if conversationId == "" {
		return errors.New("conversation id is required")
	}
	query := DB.Where("conversation_id = ?", conversationId)
	if teamId > 0 {
		query = query.Where("team_id = ?", teamId)
	} else {
		query = query.Where("user_id = ? AND team_id = 0", userId)
	}
	return query.Delete(&HermesResult{}).Error
}

func ListHermesResults(options HermesResultQuery) ([]HermesResult, error) {
	limit := options.Limit
	if limit <= 0 || limit > 100 {
		limit = 50
	}
	query := DB.Model(&HermesResult{})
	if options.TeamId > 0 {
		query = query.Where("team_id = ?", options.TeamId)
	} else {
		if options.UserId <= 0 {
			return nil, errors.New("user id is required")
		}
		query = query.Where("user_id = ? AND team_id = 0", options.UserId)
	}
	if resultType := strings.TrimSpace(options.ResultType); resultType != "" && resultType != "all" {
		if resultType == HermesResultTypeAttachment {
			query = query.Where("source = ?", HermesResultSourceAttachment)
		} else {
			query = query.Where("result_type = ?", resultType)
		}
	}
	if keyword := strings.ToLower(strings.TrimSpace(options.Query)); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where(
			"LOWER(title) LIKE ? OR LOWER(file_name) LIKE ? OR LOWER(media_type) LIKE ? OR LOWER(href) LIKE ?",
			like,
			like,
			like,
			like,
		)
	}

	var results []HermesResult
	err := query.Order("updated_at desc").Limit(limit).Find(&results).Error
	return results, err
}
