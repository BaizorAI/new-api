package model

import (
	"errors"

	"github.com/BaizorAI/new-api/common"
	"gorm.io/gorm"
)

type AuthorFollow struct {
	Id        int `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId    int `json:"user_id" gorm:"uniqueIndex:idx_user_author;not null"`
	AuthorId  int `json:"author_id" gorm:"uniqueIndex:idx_user_author;not null;index"`
	CreatedAt int64 `json:"created_at" gorm:"bigint"`
}

func (AuthorFollow) TableName() string {
	return "author_follows"
}

// FollowAuthor creates a follow relationship if it does not already exist.
func FollowAuthor(userId, authorId int) error {
	if userId <= 0 || authorId <= 0 {
		return errors.New("用户 id 或作者 id 为空")
	}
	if userId == authorId {
		return errors.New("不能关注自己")
	}
	var existing AuthorFollow
	err := DB.Where("user_id = ? AND author_id = ?", userId, authorId).First(&existing).Error
	if err == nil {
		return nil // already following
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return err
	}
	follow := AuthorFollow{
		UserId:    userId,
		AuthorId:  authorId,
		CreatedAt: common.GetTimestamp(),
	}
	return DB.Create(&follow).Error
}

// UnfollowAuthor removes a follow relationship.
func UnfollowAuthor(userId, authorId int) error {
	if userId <= 0 || authorId <= 0 {
		return errors.New("用户 id 或作者 id 为空")
	}
	return DB.Where("user_id = ? AND author_id = ?", userId, authorId).Delete(&AuthorFollow{}).Error
}

// IsFollowing checks whether a user follows an author.
func IsFollowing(userId, authorId int) bool {
	if userId <= 0 || authorId <= 0 {
		return false
	}
	var count int64
	if err := DB.Model(&AuthorFollow{}).Where("user_id = ? AND author_id = ?", userId, authorId).Count(&count).Error; err != nil {
		return false
	}
	return count > 0
}

// CountAuthorFollowers returns the number of followers for an author.
func CountAuthorFollowers(authorId int) int64 {
	if authorId <= 0 {
		return 0
	}
	var count int64
	if err := DB.Model(&AuthorFollow{}).Where("author_id = ?", authorId).Count(&count).Error; err != nil {
		return 0
	}
	return count
}
