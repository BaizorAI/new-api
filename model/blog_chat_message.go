package model

// BlogChatMessage persists chat messages for the blog hall workspace so they
// survive page refreshes, device switches, and browser restarts.
type BlogChatMessage struct {
	Id        int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ArticleId int    `json:"article_id" gorm:"index"`
	UserId    int    `json:"user_id" gorm:"index"`
	Role      string `json:"role" gorm:"type:varchar(16)"`
	Content   string `json:"content" gorm:"type:text"`
	CreatedAt int64  `json:"created_at" gorm:"autoCreateTime:milli"`
}

func (m *BlogChatMessage) Insert() error {
	return DB.Create(m).Error
}

func GetBlogChatMessages(articleId int, userId int) ([]BlogChatMessage, error) {
	var messages []BlogChatMessage
	err := DB.
		Where("article_id = ? AND user_id = ?", articleId, userId).
		Order("id asc").
		Find(&messages).Error
	return messages, err
}

func ClearBlogChatMessages(articleId int, userId int) error {
	return DB.
		Where("article_id = ? AND user_id = ?", articleId, userId).
		Delete(&BlogChatMessage{}).Error
}
