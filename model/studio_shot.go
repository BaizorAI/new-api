package model

import "errors"

const (
	ShotStatusPending    = 0
	ShotStatusGenerating = 1
	ShotStatusCompleted  = 2
	ShotStatusFailed     = 3
)

type StudioShot struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ProjectId    int    `json:"project_id" gorm:"index"`
	SceneNumber  int    `json:"scene_number"`
	ShotNumber   int    `json:"shot_number"`
	Description  string `json:"description" gorm:"type:text"`
	CameraAngle  string `json:"camera_angle" gorm:"type:varchar(32)"`
	CameraMove   string `json:"camera_move" gorm:"type:varchar(32)"`
	Duration     int    `json:"duration"`
	ImagePrompt  string `json:"image_prompt" gorm:"type:text"`
	ImageURL     string `json:"image_url" gorm:"type:varchar(500)"`
	VideoPrompt  string `json:"video_prompt" gorm:"type:text"`
	VideoURL     string `json:"video_url" gorm:"type:varchar(500)"`
	VideoTaskId  string `json:"video_task_id" gorm:"type:varchar(64)"`
	Status       int    `json:"status" gorm:"default:0"`
	CharacterIds string `json:"character_ids" gorm:"type:varchar(200)"`
	SortOrder    int    `json:"sort_order"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime:milli"`
	UpdatedAt    int64  `json:"updated_at" gorm:"autoUpdateTime:milli"`
}

func (s *StudioShot) Insert() error {
	return DB.Create(s).Error
}

func (s *StudioShot) Update() error {
	return DB.Model(s).Select(
		"scene_number", "shot_number", "description",
		"camera_angle", "camera_move", "duration",
		"image_prompt", "image_url", "video_prompt", "video_url",
		"video_task_id", "status", "character_ids", "sort_order",
	).Updates(s).Error
}

func (s *StudioShot) Delete() error {
	return DB.Delete(s).Error
}

func GetStudioShotById(id int) (*StudioShot, error) {
	if id == 0 {
		return nil, errors.New("id is required")
	}
	var s StudioShot
	if err := DB.First(&s, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &s, nil
}

func GetStudioShotsByProjectId(projectId int) ([]StudioShot, error) {
	var shots []StudioShot
	err := DB.Where("project_id = ?", projectId).Order("sort_order asc").Find(&shots).Error
	return shots, err
}

func BatchCreateStudioShots(shots []StudioShot) error {
	if len(shots) == 0 {
		return nil
	}
	return DB.Create(&shots).Error
}

func DeleteStudioShotsByProjectId(projectId int) error {
	return DB.Where("project_id = ?", projectId).Delete(&StudioShot{}).Error
}

// CountStudioShotsByStatus counts shots grouped by image/video completion
// for progress tracking in the image_gen and video_gen stages.
func CountStudioShotsByImageStatus(projectId int) (total int, done int, err error) {
	var shots []StudioShot
	if err = DB.Select("id", "image_url").Where("project_id = ?", projectId).Find(&shots).Error; err != nil {
		return
	}
	total = len(shots)
	for _, s := range shots {
		if s.ImageURL != "" {
			done++
		}
	}
	return
}

func CountStudioShotsByVideoStatus(projectId int) (total int, done int, err error) {
	var shots []StudioShot
	if err = DB.Select("id", "video_url").Where("project_id = ?", projectId).Find(&shots).Error; err != nil {
		return
	}
	total = len(shots)
	for _, s := range shots {
		if s.VideoURL != "" {
			done++
		}
	}
	return
}
