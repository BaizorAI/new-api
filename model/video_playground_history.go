package model

import (
	"time"

	"github.com/BaizorAI/new-api/common"
)

const (
	VideoPlaygroundStatusPending   = 1
	VideoPlaygroundStatusCompleted = 2
	VideoPlaygroundStatusFailed    = 3
)

type VideoPlaygroundHistory struct {
	Id              int     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId          int     `json:"user_id" gorm:"index;not null"`
	Prompt          string  `json:"prompt" gorm:"type:text;not null"`
	Model           string  `json:"model" gorm:"type:varchar(128);not null"`
	Size            string  `json:"size" gorm:"type:varchar(32)"`
	NegativePrompt  string  `json:"negative_prompt,omitempty" gorm:"type:text"`
	NumFrames       int     `json:"num_frames,omitempty"`
	Fps             int     `json:"fps,omitempty"`
	GuidanceScale   float64 `json:"guidance_scale,omitempty"`
	Seed            int64   `json:"seed,omitempty"`
	Group           string  `json:"group" gorm:"type:varchar(64)"`
	Status          int     `json:"status" gorm:"default:1;not null;index"`
	VideoURL        string  `json:"video_url" gorm:"type:text"`
	ErrorMessage    string  `json:"error_message,omitempty" gorm:"type:text"`
	CreatedAt       int64   `json:"created_at" gorm:"autoCreateTime"`
}

func CreateVideoPlaygroundHistory(record *VideoPlaygroundHistory) error {
	return DB.Create(record).Error
}

func GetUserVideoPlaygroundHistory(userId int, pageInfo *common.PageInfo) ([]VideoPlaygroundHistory, int64, error) {
	var records []VideoPlaygroundHistory
	var total int64

	tx := DB.Where("user_id = ?", userId)
	if err := tx.Model(&VideoPlaygroundHistory{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	if err := tx.Order("id desc").Limit(pageInfo.GetPageSize()).Offset(pageInfo.GetStartIdx()).Find(&records).Error; err != nil {
		return nil, 0, err
	}
	return records, total, nil
}

func UpdateVideoPlaygroundHistoryResult(id int, videoURL string) error {
	return DB.Model(&VideoPlaygroundHistory{}).Where("id = ?", id).Updates(map[string]any{
		"status":    VideoPlaygroundStatusCompleted,
		"video_url": videoURL,
	}).Error
}

func UpdateVideoPlaygroundHistoryError(id int, errMsg string) error {
	return DB.Model(&VideoPlaygroundHistory{}).Where("id = ?", id).Updates(map[string]any{
		"status":        VideoPlaygroundStatusFailed,
		"error_message": errMsg,
	}).Error
}

// MarkStaleVideoPlaygroundHistories marks pending records as failed on startup.
// This avoids retrying (and double-billing) tasks that were interrupted by a server restart.
func MarkStaleVideoPlaygroundHistories() error {
	return DB.Model(&VideoPlaygroundHistory{}).
		Where("status = ?", VideoPlaygroundStatusPending).
		Updates(map[string]any{
			"status":        VideoPlaygroundStatusFailed,
			"error_message": "generation interrupted by server restart",
		}).Error
}

func DeleteVideoPlaygroundHistory(userId int, id int) error {
	return DB.Where("user_id = ? AND id = ?", userId, id).Delete(&VideoPlaygroundHistory{}).Error
}

func ClearVideoPlaygroundHistory(userId int) error {
	return DB.Where("user_id = ?", userId).Delete(&VideoPlaygroundHistory{}).Error
}

// GetVideoPlaygroundHistoryById returns a single record for use by the generation goroutine.
func GetVideoPlaygroundHistoryById(id int) (*VideoPlaygroundHistory, error) {
	var record VideoPlaygroundHistory
	if err := DB.Where("id = ?", id).First(&record).Error; err != nil {
		return nil, err
	}
	return &record, nil
}

// StaleVideoPlaygroundThreshold defines how long a pending task is allowed to run
// before being considered stale (used for crash recovery on startup).
var StaleVideoPlaygroundThreshold = 30 * time.Minute
