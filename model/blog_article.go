package model

import (
	"errors"
	"strings"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

const (
	BlogArticleStatusDraft     = "draft"
	BlogArticleStatusPublished = "published"
	BlogArticleStatusArchived  = "archived"
)

type BlogArticle struct {
	Id          int            `json:"id" gorm:"primaryKey;autoIncrement"`
	Guid        string         `json:"guid" gorm:"type:varchar(36);uniqueIndex"`
	AuthorId    int            `json:"author_id" gorm:"index;not null"`
	Title       string         `json:"title" gorm:"type:varchar(200);not null"`
	Summary     string         `json:"summary" gorm:"type:varchar(500)"`
	Content     string         `json:"content" gorm:"type:text"`
	Tags        string         `json:"tags" gorm:"type:varchar(500)"` // comma-separated
	Status      string         `json:"status" gorm:"type:varchar(20);index"`
	CreatedTime int64          `json:"created_time" gorm:"bigint"`
	UpdatedTime int64          `json:"updated_time" gorm:"bigint"`
	PublishedAt int64          `json:"published_at" gorm:"bigint"`
	DeletedAt   gorm.DeletedAt `gorm:"index"`
}

func (a *BlogArticle) BeforeCreate(tx *gorm.DB) error {
	if a.Guid == "" {
		a.Guid = uuid.New().String()
	}
	return nil
}

func ValidBlogArticleStatus(status string) bool {
	switch status {
	case BlogArticleStatusDraft, BlogArticleStatusPublished, BlogArticleStatusArchived:
		return true
	}
	return false
}

// TagsToSlice splits the stored comma-separated tags string into a slice.
func (a *BlogArticle) TagsToSlice() []string {
	if a.Tags == "" {
		return []string{}
	}
	return strings.Split(a.Tags, ",")
}

// TagsFromSlice joins a string slice into the stored comma-separated format.
func TagsFromSlice(tags []string) string {
	return strings.Join(tags, ",")
}

func GetAllBlogArticles(authorId int, status string, startIdx, num int) ([]*BlogArticle, int64, error) {
	tx := DB.Begin()
	if tx.Error != nil {
		return nil, 0, tx.Error
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	query := tx.Model(&BlogArticle{})
	if authorId > 0 {
		query = query.Where("author_id = ?", authorId)
	}
	if status != "" {
		query = query.Where("status = ?", status)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	var articles []*BlogArticle
	if err := query.Order("id desc").Limit(num).Offset(startIdx).Find(&articles).Error; err != nil {
		tx.Rollback()
		return nil, 0, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, 0, err
	}
	return articles, total, nil
}

func GetBlogArticleById(id int) (*BlogArticle, error) {
	if id == 0 {
		return nil, errors.New("id 为空")
	}
	var article BlogArticle
	err := DB.First(&article, "id = ?", id).Error
	return &article, err
}

func GetBlogArticleByGuid(guid string) (*BlogArticle, error) {
	guid = strings.TrimSpace(guid)
	if guid == "" {
		return nil, errors.New("guid 为空")
	}
	var article BlogArticle
	err := DB.First(&article, "guid = ?", guid).Error
	return &article, err
}

func (a *BlogArticle) Insert() error {
	return DB.Create(a).Error
}

func (a *BlogArticle) Update() error {
	return DB.Model(a).
		Select("title", "summary", "content", "tags", "status", "updated_time", "published_at").
		Updates(a).Error
}

func (a *BlogArticle) Delete() error {
	return DB.Delete(a).Error
}

func DeleteBlogArticleById(id int) error {
	if id == 0 {
		return errors.New("id 为空")
	}
	article, err := GetBlogArticleById(id)
	if err != nil {
		return err
	}
	return article.Delete()
}
