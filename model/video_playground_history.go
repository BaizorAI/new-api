package model

import (
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
	ChannelId       int     `json:"channel_id,omitempty"`
	UpstreamJobId   string  `json:"upstream_job_id,omitempty" gorm:"type:varchar(64)"`
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

// UpdateVideoPlaygroundUpstreamInfo stores the upstream job ID and channel ID
// after a successful async submission (202 Accepted from sulphur2).
func UpdateVideoPlaygroundUpstreamInfo(id int, upstreamJobId string, channelId int) error {
	return DB.Model(&VideoPlaygroundHistory{}).Where("id = ?", id).Updates(map[string]any{
		"upstream_job_id": upstreamJobId,
		"channel_id":      channelId,
	}).Error
}

// GetPendingVideoPlaygroundWithUpstreamJob returns pending records that already
// have an upstream job ID — these need poll-loop recovery after a gateway restart.
func GetPendingVideoPlaygroundWithUpstreamJob() ([]*VideoPlaygroundHistory, error) {
	var records []*VideoPlaygroundHistory
	err := DB.Where("status = ? AND upstream_job_id != ''", VideoPlaygroundStatusPending).
		Find(&records).Error
	return records, err
}

// MarkStaleVideoPlaygroundHistoriesWithoutUpstream marks pending records that
// were never successfully submitted upstream (no job ID) as failed.
func MarkStaleVideoPlaygroundHistoriesWithoutUpstream() error {
	return DB.Model(&VideoPlaygroundHistory{}).
		Where("status = ? AND (upstream_job_id = '' OR upstream_job_id IS NULL)", VideoPlaygroundStatusPending).
		Updates(map[string]any{
			"status":        VideoPlaygroundStatusFailed,
			"error_message": "generation interrupted by server restart (not submitted)",
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
