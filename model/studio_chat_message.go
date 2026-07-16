package model

// StudioChatMessage persists chat messages for the film studio so they
// survive page refreshes, device switches, and browser restarts.
type StudioChatMessage struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ProjectId int    `json:"project_id" gorm:"index"`
	StageKey  string `json:"stage_key" gorm:"index;size:32"`
	UserId    int    `json:"user_id" gorm:"index"`
	Role      string `json:"role" gorm:"type:varchar(16)"`
	Content   string `json:"content" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime:milli"`
}

func (m *StudioChatMessage) Insert() error {
	return DB.Create(m).Error
}

func (m *StudioChatMessage) Delete() error {
	return DB.Delete(m).Error
}

func GetStudioChatMessages(projectId int, stageKey string, userId int) ([]StudioChatMessage, error) {
	var messages []StudioChatMessage
	err := DB.
		Where("project_id = ? AND stage_key = ? AND user_id = ?", projectId, stageKey, userId).
		Order("id asc").
		Find(&messages).Error
	return messages, err
}

func DeleteStudioChatMessageById(id int, userId int) error {
	return DB.Where("id = ? AND user_id = ?", id, userId).Delete(&StudioChatMessage{}).Error
}

func ClearStudioChatMessages(projectId int, stageKey string, userId int) error {
	return DB.
		Where("project_id = ? AND stage_key = ? AND user_id = ?", projectId, stageKey, userId).
		Delete(&StudioChatMessage{}).Error
}
