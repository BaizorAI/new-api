package model

import (
	"errors"
	"sort"
	"strings"

	"github.com/BaizorAI/new-api/common"
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
	Guid        string         `json:"guid" gorm:"type:varchar(36);index"`
	AuthorId    int            `json:"author_id" gorm:"index;not null"`
	Title       string         `json:"title" gorm:"type:varchar(200);not null"`
	Summary     string         `json:"summary" gorm:"type:varchar(500)"`
	CoverImage  string         `json:"cover_image" gorm:"type:varchar(500)"`
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
	raw := strings.Split(a.Tags, ",")
	result := make([]string, 0, len(raw))
	for _, tag := range raw {
		tag = strings.TrimSpace(tag)
		if tag != "" {
			result = append(result, tag)
		}
	}
	return result
}

// TagsFromSlice joins a string slice into the stored comma-separated format.
func TagsFromSlice(tags []string) string {
	cleaned := make([]string, 0, len(tags))
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag != "" {
			cleaned = append(cleaned, tag)
		}
	}
	return strings.Join(cleaned, ",")
}

func GetAllBlogArticles(authorId int, status string, startIdx, num int) ([]*BlogArticle, int64, error) {
	return SearchBlogArticles(authorId, status, "", startIdx, num)
}

// SearchBlogArticles returns paginated articles filtered by author, status and
// keyword (title/summary/content). An empty keyword disables text filtering.
func SearchBlogArticles(authorId int, status string, keyword string, startIdx, num int) ([]*BlogArticle, int64, error) {
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
	query = applySearchFilter(query, keyword)

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
		Select("title", "summary", "cover_image", "content", "tags", "status", "updated_time", "published_at").
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

// DeleteBlogArticlesByIds permanently deletes the articles with the given ids.
func DeleteBlogArticlesByIds(ids []int) error {
	if len(ids) == 0 {
		return nil
	}
	return DB.Where("id IN ?", ids).Delete(&BlogArticle{}).Error
}

// UpdateBlogArticlesStatusByIds updates the status of the given articles.
// When transitioning to published, articles without a published_at timestamp
// receive the current time.
func UpdateBlogArticlesStatusByIds(ids []int, status string) error {
	if len(ids) == 0 {
		return nil
	}
	if !ValidBlogArticleStatus(status) {
		return errors.New("无效的 status 值")
	}

	now := common.GetTimestamp()
	if err := DB.Model(&BlogArticle{}).
		Where("id IN ?", ids).
		Updates(BlogArticle{Status: status, UpdatedTime: now}).Error; err != nil {
		return err
	}

	if status == BlogArticleStatusPublished {
		return DB.Model(&BlogArticle{}).
			Where("id IN ? AND published_at = ?", ids, 0).
			Update("published_at", now).Error
	}
	return nil
}

// ============================================================================
// Search & tag helpers
// ============================================================================

// escapeLikePattern escapes LIKE wildcards using "!" as the escape character,
// matching the convention in model/token.go.
func escapeLikePattern(s string) string {
	return strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(s)
}

// buildTagMatchCondition returns a condition that matches a tag as a whole
// comma-separated token. likePlaceholders is the number of LIKE patterns;
// the function appends one equality check for a single-tag article.
func buildTagMatchCondition(likePlaceholders int) string {
	parts := make([]string, likePlaceholders)
	for i := range parts {
		parts[i] = "tags LIKE ? ESCAPE '!'"
	}
	parts = append(parts, "tags = ?")
	return "(" + strings.Join(parts, " OR ") + ")"
}

// tagMatchPatterns returns the boundary patterns for a single tag.
func tagMatchPatterns(tag string) []string {
	escaped := escapeLikePattern(tag)
	return []string{
		escaped + ",%",        // tag at start
		"%," + escaped + ",%", // tag in middle
		"%," + escaped,        // tag at end
		escaped,               // exact single tag
	}
}

func applySearchFilter(query *gorm.DB, keyword string) *gorm.DB {
	if keyword = strings.TrimSpace(keyword); keyword == "" {
		return query
	}
	pattern := "%" + escapeLikePattern(strings.ToLower(keyword)) + "%"
	return query.Where(
		"LOWER(title) LIKE ? ESCAPE '!' OR LOWER(summary) LIKE ? ESCAPE '!' OR LOWER(content) LIKE ? ESCAPE '!'",
		pattern, pattern, pattern,
	)
}

func applyTagFilter(query *gorm.DB, tags []string) *gorm.DB {
	if len(tags) == 0 {
		return query
	}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		patterns := tagMatchPatterns(tag)
		args := make([]any, len(patterns))
		for i, p := range patterns {
			args[i] = p
		}
		query = query.Where(buildTagMatchCondition(len(patterns)-1), args...)
	}
	return query
}

// SearchPublishedBlogArticles searches published articles by keyword and/or tags.
func SearchPublishedBlogArticles(keyword string, tags []string, startIdx, num int) ([]*BlogArticle, int64, error) {
	query := DB.Model(&BlogArticle{}).
		Where("status = ? AND deleted_at IS NULL", BlogArticleStatusPublished)

	query = applySearchFilter(query, keyword)
	query = applyTagFilter(query, tags)

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var articles []*BlogArticle
	if err := query.Order("published_at desc, id desc").
		Limit(num).Offset(startIdx).
		Find(&articles).Error; err != nil {
		return nil, 0, err
	}
	return articles, total, nil
}

// GetRelatedPublishedArticles returns published articles sharing at least one tag.
func GetRelatedPublishedArticles(articleId int, tags []string, startIdx, num int) ([]*BlogArticle, int64, error) {
	if articleId <= 0 || len(tags) == 0 {
		return []*BlogArticle{}, 0, nil
	}

	query := DB.Model(&BlogArticle{}).
		Where("status = ? AND deleted_at IS NULL AND id != ?", BlogArticleStatusPublished, articleId)

	orConditions := []string{}
	orArgs := []any{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		patterns := tagMatchPatterns(tag)
		cond := buildTagMatchCondition(len(patterns) - 1)
		orConditions = append(orConditions, cond)
		for _, p := range patterns {
			orArgs = append(orArgs, p)
		}
	}
	if len(orConditions) == 0 {
		return []*BlogArticle{}, 0, nil
	}
	query = query.Where("("+strings.Join(orConditions, " OR ")+")", orArgs...)

	scoreParts := []string{}
	scoreArgs := []any{}
	for _, tag := range tags {
		tag = strings.TrimSpace(tag)
		if tag == "" {
			continue
		}
		patterns := tagMatchPatterns(tag)
		cond := buildTagMatchCondition(len(patterns) - 1)
		scoreParts = append(scoreParts, "CASE WHEN "+cond+" THEN 1 ELSE 0 END")
		for _, p := range patterns {
			scoreArgs = append(scoreArgs, p)
		}
	}
	var orderExpr interface{} = "published_at desc, id desc"
	if len(scoreParts) > 0 {
		orderExpr = gorm.Expr("("+strings.Join(scoreParts, " + ")+") DESC, published_at desc, id desc", scoreArgs...)
	}

	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	var articles []*BlogArticle
	if err := query.Order(orderExpr).Limit(num).Offset(startIdx).Find(&articles).Error; err != nil {
		return nil, 0, err
	}
	return articles, total, nil
}

// GetPublishedBlogTags returns the most frequently used tags among published articles.
func GetPublishedBlogTags(limit int) ([]struct {
	Tag   string `json:"tag"`
	Count int64  `json:"count"`
}, error) {
	if limit <= 0 {
		limit = 50
	}
	var rows []*BlogArticle
	if err := DB.Model(&BlogArticle{}).
		Where("status = ? AND deleted_at IS NULL AND tags != ?", BlogArticleStatusPublished, "").
		Select("tags").
		Find(&rows).Error; err != nil {
		return nil, err
	}

	type tagCount struct {
		Tag   string
		Count int64
	}
	counts := make(map[string]int64)
	for _, row := range rows {
		for _, tag := range row.TagsToSlice() {
			tag = strings.TrimSpace(tag)
			if tag == "" {
				continue
			}
			counts[tag]++
		}
	}

	result := make([]tagCount, 0, len(counts))
	for tag, count := range counts {
		result = append(result, tagCount{Tag: tag, Count: count})
	}
	sort.Slice(result, func(i, j int) bool {
		if result[i].Count != result[j].Count {
			return result[i].Count > result[j].Count
		}
		return result[i].Tag < result[j].Tag
	})
	if len(result) > limit {
		result = result[:limit]
	}

	out := make([]struct {
		Tag   string `json:"tag"`
		Count int64  `json:"count"`
	}, len(result))
	for i, r := range result {
		out[i].Tag = r.Tag
		out[i].Count = r.Count
	}
	return out, nil
}
