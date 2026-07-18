package model

import (
	"errors"

	"gorm.io/gorm"
)

type BlogArticleStats struct {
	Id        int   `json:"id" gorm:"primaryKey;autoIncrement"`
	ArticleId int   `json:"article_id" gorm:"uniqueIndex;not null"`
	ViewCount int64 `json:"view_count" gorm:"default:0"`
	LikeCount int64 `json:"like_count" gorm:"default:0"`
}

func (BlogArticleStats) TableName() string {
	return "blog_article_stats"
}

// GetBlogArticleStats returns stats for an article, creating a row if missing.
func GetBlogArticleStats(articleId int) (*BlogArticleStats, error) {
	if articleId <= 0 {
		return nil, errors.New("article id 为空")
	}
	var stats BlogArticleStats
	err := DB.Where("article_id = ?", articleId).First(&stats).Error
	if err == nil {
		return &stats, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}
	stats = BlogArticleStats{ArticleId: articleId}
	if err := DB.Create(&stats).Error; err != nil {
		return nil, err
	}
	return &stats, nil
}

// IncrementBlogArticleViewCount increments the view count for an article.
func IncrementBlogArticleViewCount(articleId int) error {
	if articleId <= 0 {
		return errors.New("article id 为空")
	}
	stats, err := GetBlogArticleStats(articleId)
	if err != nil {
		return err
	}
	return DB.Model(stats).UpdateColumn("view_count", gorm.Expr("view_count + ?", 1)).Error
}

// IncrementBlogArticleLikeCount increments the like count for an article.
func IncrementBlogArticleLikeCount(articleId int) error {
	if articleId <= 0 {
		return errors.New("article id 为空")
	}
	stats, err := GetBlogArticleStats(articleId)
	if err != nil {
		return err
	}
	return DB.Model(stats).UpdateColumn("like_count", gorm.Expr("like_count + ?", 1)).Error
}
