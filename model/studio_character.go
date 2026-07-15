package model

import "errors"

type StudioCharacter struct {
	Id           int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ProjectId    int    `json:"project_id" gorm:"index"`
	Name         string `json:"name" gorm:"type:varchar(64)"`
	Description  string `json:"description" gorm:"type:text"`
	VisualPrompt string `json:"visual_prompt" gorm:"type:text"`
	ReferenceURL string `json:"reference_url" gorm:"type:varchar(500)"`
	LoraParams   string `json:"lora_params" gorm:"type:text"`
	CreatedAt    int64  `json:"created_at" gorm:"autoCreateTime:milli"`
	UpdatedAt    int64  `json:"updated_at" gorm:"autoUpdateTime:milli"`
}

func (c *StudioCharacter) Insert() error {
	return DB.Create(c).Error
}

func (c *StudioCharacter) Update() error {
	return DB.Model(c).Select(
		"name", "description", "visual_prompt", "reference_url", "lora_params",
	).Updates(c).Error
}

func (c *StudioCharacter) Delete() error {
	return DB.Delete(c).Error
}

func GetStudioCharacterById(id int) (*StudioCharacter, error) {
	if id == 0 {
		return nil, errors.New("id is required")
	}
	var c StudioCharacter
	if err := DB.First(&c, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &c, nil
}

func GetStudioCharactersByProjectId(projectId int) ([]StudioCharacter, error) {
	var chars []StudioCharacter
	err := DB.Where("project_id = ?", projectId).Order("id asc").Find(&chars).Error
	return chars, err
}

func DeleteStudioCharactersByProjectId(projectId int) error {
	return DB.Where("project_id = ?", projectId).Delete(&StudioCharacter{}).Error
}

// CountStudioCharactersByReferenceStatus counts how many characters have
// a reference image, used for progress tracking in the characters stage.
func CountStudioCharactersByReferenceStatus(projectId int) (total int, done int, err error) {
	var chars []StudioCharacter
	if err = DB.Select("id", "reference_url").Where("project_id = ?", projectId).Find(&chars).Error; err != nil {
		return
	}
	total = len(chars)
	for _, c := range chars {
		if c.ReferenceURL != "" {
			done++
		}
	}
	return
}
