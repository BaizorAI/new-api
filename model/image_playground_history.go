package model

import "github.com/BaizorAI/new-api/common"

type ImagePlaygroundHistory struct {
	Id            int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId        int    `json:"user_id" gorm:"index;not null"`
	Prompt        string `json:"prompt" gorm:"type:text;not null"`
	Model         string `json:"model" gorm:"type:varchar(128);not null"`
	Size          string `json:"size" gorm:"type:varchar(32)"`
	Quality       string `json:"quality" gorm:"type:varchar(32)"`
	ImageURL      string `json:"image_url" gorm:"type:text"`
	RevisedPrompt string `json:"revised_prompt,omitempty" gorm:"type:text"`
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

func DeleteImagePlaygroundHistory(userId int, id int) error {
	return DB.Where("user_id = ? AND id = ?", userId, id).Delete(&ImagePlaygroundHistory{}).Error
}

func ClearImagePlaygroundHistory(userId int) error {
	return DB.Where("user_id = ?", userId).Delete(&ImagePlaygroundHistory{}).Error
}
