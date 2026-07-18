package model

import (
	"errors"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"gorm.io/gorm"
)

type AuthorProfile struct {
	Id          int    `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int    `json:"user_id" gorm:"uniqueIndex;not null"`
	DisplayName string `json:"display_name" gorm:"type:varchar(100)"`
	Slug        string `json:"slug" gorm:"uniqueIndex;type:varchar(100);not null"`
	Avatar      string `json:"avatar" gorm:"type:varchar(500)"`
	Bio         string `json:"bio" gorm:"type:varchar(1000)"`
	IsPublic    bool   `json:"is_public" gorm:"index"`
	CreatedAt   int64  `json:"created_at" gorm:"bigint"`
	UpdatedAt   int64  `json:"updated_at" gorm:"bigint"`
}

func (AuthorProfile) TableName() string {
	return "author_profiles"
}

// GetAuthorProfileByUserId returns the profile for a given user, or nil if not found.
func GetAuthorProfileByUserId(userId int) (*AuthorProfile, error) {
	if userId <= 0 {
		return nil, errors.New("user id 为空")
	}
	var profile AuthorProfile
	err := DB.Where("user_id = ?", userId).First(&profile).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &profile, nil
}

// GetAuthorProfileBySlug returns a public-visible profile by slug.
func GetAuthorProfileBySlug(slug string) (*AuthorProfile, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return nil, errors.New("slug 为空")
	}
	var profile AuthorProfile
	err := DB.Where("slug = ? AND is_public = ?", slug, true).First(&profile).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return &profile, nil
}

// GetPublicAuthorProfiles returns public author profiles that have at least one published article.
func GetPublicAuthorProfiles(startIdx, num int) ([]*AuthorProfile, int64, error) {
	subQuery := DB.Model(&BlogArticle{}).
		Select("author_id").
		Where("status = ? AND deleted_at IS NULL", BlogArticleStatusPublished).
		Group("author_id")

	query := DB.Model(&AuthorProfile{}).
		Where("is_public = ? AND user_id IN (?)", true, subQuery)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var profiles []*AuthorProfile
	if err := query.Order("id desc").Limit(num).Offset(startIdx).Find(&profiles).Error; err != nil {
		return nil, 0, err
	}
	return profiles, total, nil
}

// AuthorProfileExistsBySlug checks whether a slug is already taken by another user.
func AuthorProfileExistsBySlug(slug string, excludeUserId int) (bool, error) {
	slug = strings.TrimSpace(slug)
	if slug == "" {
		return false, errors.New("slug 为空")
	}
	var count int64
	query := DB.Model(&AuthorProfile{}).Where("slug = ?", slug)
	if excludeUserId > 0 {
		query = query.Where("user_id != ?", excludeUserId)
	}
	if err := query.Count(&count).Error; err != nil {
		return false, err
	}
	return count > 0, nil
}

// UpsertAuthorProfile inserts a new profile or updates an existing one (matched by user_id).
func UpsertAuthorProfile(profile *AuthorProfile) error {
	if profile.UserId <= 0 {
		return errors.New("user id 为空")
	}
	now := common.GetTimestamp()
	profile.Slug = strings.TrimSpace(profile.Slug)
	profile.DisplayName = strings.TrimSpace(profile.DisplayName)
	profile.Avatar = strings.TrimSpace(profile.Avatar)
	profile.Bio = strings.TrimSpace(profile.Bio)
	if profile.Id == 0 {
		profile.CreatedAt = now
	}
	profile.UpdatedAt = now

	var existing AuthorProfile
	err := DB.Where("user_id = ?", profile.UserId).First(&existing).Error
	if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	if existing.Id > 0 {
		profile.Id = existing.Id
		profile.CreatedAt = existing.CreatedAt
		return DB.Model(&existing).Select(
			"display_name", "slug", "avatar", "bio", "is_public", "updated_at",
		).Updates(profile).Error
	}
	return DB.Create(profile).Error
}

// CountPublishedArticlesByAuthor returns the number of published articles for a user.
func CountPublishedArticlesByAuthor(authorId int) (int64, error) {
	var count int64
	err := DB.Model(&BlogArticle{}).
		Where("author_id = ? AND status = ? AND deleted_at IS NULL", authorId, BlogArticleStatusPublished).
		Count(&count).Error
	return count, err
}

// GetPublishedArticlesByAuthor returns paginated published articles for a user.
func GetPublishedArticlesByAuthor(authorId int, startIdx, num int) ([]*BlogArticle, int64, error) {
	if authorId <= 0 {
		return nil, 0, errors.New("author id 为空")
	}
	var total int64
	if err := DB.Model(&BlogArticle{}).
		Where("author_id = ? AND status = ? AND deleted_at IS NULL", authorId, BlogArticleStatusPublished).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var articles []*BlogArticle
	if err := DB.Where("author_id = ? AND status = ? AND deleted_at IS NULL", authorId, BlogArticleStatusPublished).
		Order("published_at desc, id desc").
		Limit(num).Offset(startIdx).
		Find(&articles).Error; err != nil {
		return nil, 0, err
	}
	return articles, total, nil
}
