package model

import (
	"time"

	"github.com/BaizorAI/new-api/common"
)

const (
	ImagePlaygroundStatusPending   = 1
	ImagePlaygroundStatusCompleted = 2
	ImagePlaygroundStatusFailed    = 3
)

type ImagePlaygroundHistory struct {
	Id            int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId        int    `json:"user_id" gorm:"index;not null"`
	Prompt        string `json:"prompt" gorm:"type:text;not null"`
	Model         string `json:"model" gorm:"type:varchar(128);not null"`
	Size          string `json:"size" gorm:"type:varchar(32)"`
	Quality       string `json:"quality" gorm:"type:varchar(32)"`
	Group         string `json:"group" gorm:"type:varchar(64)"`
	Status        int    `json:"status" gorm:"default:1;not null;index"`
	ImageURL      string `json:"image_url" gorm:"type:text"`
	RevisedPrompt string `json:"revised_prompt,omitempty" gorm:"type:text"`
	ErrorMessage  string `json:"error_message,omitempty" gorm:"type:text"`
	CreatedAt     int64  `json:"created_at" gorm:"autoCreateTime"`
}

func CreateImagePlaygroundHistory(record *ImagePlaygroundHistory) error {
	return DB.Create(record).Error
}

func GetUserImagePlaygroundHistory(userId int, pageInfo *common.PageInfo) ([]ImagePlaygroundHistory, int64, error) {
	var records []ImagePlaygroundHistory
	var total int64

	tx := DB.Where("user_id = ?", userId)
	if err := tx.Model(&ImagePlaygroundHistory{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := tx.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

func UpdateImagePlaygroundHistoryResult(id int, imageURL, revisedPrompt string) error {
	return DB.Model(&ImagePlaygroundHistory{}).Where("id = ?", id).Updates(map[string]any{
		"status":         ImagePlaygroundStatusCompleted,
		"image_url":      imageURL,
		"revised_prompt": revisedPrompt,
	}).Error
}

func UpdateImagePlaygroundHistoryError(id int, errMsg string) error {
	return DB.Model(&ImagePlaygroundHistory{}).Where("id = ?", id).Updates(map[string]any{
		"status":        ImagePlaygroundStatusFailed,
		"error_message": errMsg,
	}).Error
}

// MarkStaleImagePlaygroundHistories marks pending records as failed on startup.
// This avoids retrying (and double-billing) tasks that were interrupted by a server restart.
func MarkStaleImagePlaygroundHistories() error {
	return DB.Model(&ImagePlaygroundHistory{}).
		Where("status = ?", ImagePlaygroundStatusPending).
		Updates(map[string]any{
			"status":        ImagePlaygroundStatusFailed,
			"error_message": "generation interrupted by server restart",
		}).Error
}

func DeleteImagePlaygroundHistory(userId int, id int) error {
	return DB.Where("user_id = ? AND id = ?", userId, id).Delete(&ImagePlaygroundHistory{}).Error
}

func ClearImagePlaygroundHistory(userId int) error {
	return DB.Where("user_id = ?", userId).Delete(&ImagePlaygroundHistory{}).Error
}

// GetImagePlaygroundHistoryById returns a single record for use by the generation goroutine.
func GetImagePlaygroundHistoryById(id int) (*ImagePlaygroundHistory, error) {
	var record ImagePlaygroundHistory
	if err := DB.Where("id = ?", id).First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

// StaleImagePlaygroundThreshold defines how long a pending task is allowed to run
// before being considered stale (used for crash recovery on startup).
var StaleImagePlaygroundThreshold = 10 * time.Minute
