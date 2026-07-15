package model

import (
	"errors"

	"gorm.io/gorm"
)

const (
	StudioProjectStatusDraft      = 1
	StudioProjectStatusInProgress = 2
	StudioProjectStatusCompleted  = 3
	StudioProjectStatusArchived   = 4
)

type StudioProject struct {
	Id        int            `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int            `json:"user_id" gorm:"index;not null"`
	TeamId    int            `json:"team_id" gorm:"index"`
	Name      string         `json:"name" gorm:"type:varchar(128);not null"`
	Brief     string         `json:"brief" gorm:"type:text"`
	Genre     string         `json:"genre" gorm:"type:varchar(32)"`
	Status    int            `json:"status" gorm:"default:1"`
	StyleDNA  string         `json:"style_dna" gorm:"type:text"`
	CoverURL  string         `json:"cover_url" gorm:"type:varchar(500)"`
	CreatedAt int64          `json:"created_at" gorm:"autoCreateTime:milli"`
	UpdatedAt int64          `json:"updated_at" gorm:"autoUpdateTime:milli"`
	DeletedAt gorm.DeletedAt `gorm:"index"`
}

func (p *StudioProject) Insert() error {
	return DB.Create(p).Error
}

func (p *StudioProject) Update() error {
	return DB.Model(p).Select(
		"name", "brief", "genre", "status", "style_dna", "cover_url",
	).Updates(p).Error
}

func (p *StudioProject) Delete() error {
	return DB.Delete(p).Error
}

func GetStudioProjectById(id int, userId int) (*StudioProject, error) {
	if id == 0 {
		return nil, errors.New("id is required")
	}
	var p StudioProject
	tx := DB.Where("id = ?", id)
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	if err := tx.First(&p).Error; err != nil {
		return nil, err
	}
	return &p, nil
}

func GetAllStudioProjects(userId int, status int, startIdx, num int) ([]*StudioProject, int64, error) {
	tx := DB.Model(&StudioProject{})
	if userId > 0 {
		tx = tx.Where("user_id = ?", userId)
	}
	if status > 0 {
		tx = tx.Where("status = ?", status)
	}
	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var projects []*StudioProject
	if err := tx.Order("id desc").Limit(num).Offset(startIdx).Find(&projects).Error; err != nil {
		return nil, 0, err
	}
	return projects, total, nil
}

// CreateStudioProjectWithStages creates a project and auto-generates the
// default 7-stage production pipeline in a single transaction.
func CreateStudioProjectWithStages(project *StudioProject) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(project).Error; err != nil {
			return err
		}
		stages := buildDefaultStages(project.Id)
		return tx.Create(&stages).Error
	})
}

// DeleteStudioProjectCascade deletes a project and all its stages, shots,
// and characters.
func DeleteStudioProjectCascade(projectId int) error {
	return DB.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("project_id = ?", projectId).Delete(&StudioCharacter{}).Error; err != nil {
			return err
		}
		if err := tx.Where("project_id = ?", projectId).Delete(&StudioShot{}).Error; err != nil {
			return err
		}
		if err := tx.Where("project_id = ?", projectId).Delete(&StudioStage{}).Error; err != nil {
			return err
		}
		return tx.Delete(&StudioProject{}, "id = ?", projectId).Error
	})
}

// StudioProjectWithStages is a convenience struct for API responses that
// include the project alongside all its stages.
type StudioProjectWithStages struct {
	*StudioProject
	Stages []StudioStage `json:"stages"`
}

func GetStudioProjectWithStages(id int, userId int) (*StudioProjectWithStages, error) {
	project, err := GetStudioProjectById(id, userId)
	if err != nil {
		return nil, err
	}
	stages, err := GetStudioStagesByProjectId(id)
	if err != nil {
		return nil, err
	}
	return &StudioProjectWithStages{StudioProject: project, Stages: stages}, nil
}

// CountStudioProjectStagesDone returns how many of the 7 stages are completed.
func CountStudioProjectStagesDone(projectId int) (int, int, error) {
	var total, done int64
	if err := DB.Model(&StudioStage{}).Where("project_id = ?", projectId).Count(&total).Error; err != nil {
		return 0, 0, err
	}
	if err := DB.Model(&StudioStage{}).Where("project_id = ? AND status = ?", projectId, StageStatusCompleted).Count(&done).Error; err != nil {
		return 0, 0, err
	}
	return int(total), int(done), nil
}

func ValidStudioProjectGenre(genre string) bool {
	switch genre {
	case "short_film", "short_drama", "commercial", "animation", "music_video", "documentary", "other":
		return true
	}
	return false
}

