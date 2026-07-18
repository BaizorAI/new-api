package controller

import (
	"regexp"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"
	"github.com/gin-gonic/gin"
)

// authorProfileView is the public-facing subset of an author's identity.
type authorProfileView struct {
	Id          int    `json:"id"`
	DisplayName string `json:"display_name"`
	Slug        string `json:"slug"`
	Avatar      string `json:"avatar"`
	Bio         string `json:"bio"`
}

// authorDetailView extends the profile with aggregate stats for the author page.
type authorDetailView struct {
	authorProfileView
	ArticleCount  int64 `json:"article_count"`
	FollowerCount int64 `json:"follower_count"`
	IsFollowed    bool  `json:"is_followed"`
}

var slugPattern = regexp.MustCompile(`^[a-z0-9]+(?:-[a-z0-9]+)*$`)

func authorProfileToView(p *model.AuthorProfile) authorProfileView {
	if p == nil {
		return authorProfileView{}
	}
	return authorProfileView{
		Id:          p.Id,
		DisplayName: p.DisplayName,
		Slug:        p.Slug,
		Avatar:      p.Avatar,
		Bio:         p.Bio,
	}
}

// buildAuthorProfileView resolves a public author identity for a user id.
// It prefers AuthorProfile; if missing or not public, it falls back to User display_name/username.
func buildAuthorProfileView(userId int) (*authorProfileView, error) {
	if userId <= 0 {
		return nil, nil
	}
	profile, err := model.GetAuthorProfileByUserId(userId)
	if err != nil {
		return nil, err
	}
	if profile != nil && profile.IsPublic {
		v := authorProfileToView(profile)
		return &v, nil
	}

	// Fallback: use User public name only if the user has published articles.
	count, err := model.CountPublishedArticlesByAuthor(userId)
	if err != nil {
		return nil, err
	}
	if count == 0 {
		return nil, nil
	}
	user, err := model.GetUserById(userId, false)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(user.DisplayName)
	if name == "" {
		name = strings.TrimSpace(user.Username)
	}
	if name == "" {
		return nil, nil
	}
	return &authorProfileView{
		Id:          user.Id,
		DisplayName: name,
		Slug:        "", // no slug when profile is missing
		Avatar:      "",
		Bio:         "",
	}, nil
}

// batchAuthorProfileViews resolves author identities for many user ids in two queries.
func batchAuthorProfileViews(userIds []int) (map[int]authorProfileView, error) {
	result := make(map[int]authorProfileView)
	if len(userIds) == 0 {
		return result, nil
	}

	// Deduplicate ids.
	idSet := make(map[int]struct{}, len(userIds))
	for _, id := range userIds {
		if id > 0 {
			idSet[id] = struct{}{}
		}
	}
	uniqueIds := make([]int, 0, len(idSet))
	for id := range idSet {
		uniqueIds = append(uniqueIds, id)
	}

	// Load public profiles.
	var profiles []*model.AuthorProfile
	if err := model.DB.Where("user_id IN ? AND is_public = ?", uniqueIds, true).Find(&profiles).Error; err != nil {
		return nil, err
	}
	profileByUserId := make(map[int]*model.AuthorProfile, len(profiles))
	for _, p := range profiles {
		profileByUserId[p.UserId] = p
	}

	// For users without a public profile, load users for fallback naming.
	fallbackIds := make([]int, 0, len(uniqueIds))
	for _, id := range uniqueIds {
		if _, ok := profileByUserId[id]; !ok {
			fallbackIds = append(fallbackIds, id)
		}
	}
	userMap, err := model.GetUsersByIds(fallbackIds)
	if err != nil {
		return nil, err
	}

	for _, id := range uniqueIds {
		if p, ok := profileByUserId[id]; ok {
			result[id] = authorProfileToView(p)
			continue
		}
		user, ok := userMap[id]
		if !ok {
			continue
		}
		name := strings.TrimSpace(user.DisplayName)
		if name == "" {
			name = strings.TrimSpace(user.Username)
		}
		if name == "" {
			continue
		}
		result[id] = authorProfileView{
			Id:          user.Id,
			DisplayName: name,
			Slug:        "",
			Avatar:      "",
			Bio:         "",
		}
	}
	return result, nil
}

// attachAuthorsToViews populates the Author field on a slice of article views.
func attachAuthorsToViews(views []blogArticleView) ([]blogArticleView, error) {
	userIds := make([]int, len(views))
	for i, v := range views {
		userIds[i] = v.AuthorId
	}
	authors, err := batchAuthorProfileViews(userIds)
	if err != nil {
		return nil, err
	}
	for i := range views {
		if a, ok := authors[views[i].AuthorId]; ok {
			views[i].Author = &a
		}
	}
	return views, nil
}

// GetPublishedBlogAuthors GET /api/blog/authors
func GetPublishedBlogAuthors(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	profiles, total, err := model.GetPublicAuthorProfiles(pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	views := make([]authorDetailView, 0, len(profiles))
	for _, p := range profiles {
		count, _ := model.CountPublishedArticlesByAuthor(p.UserId)
		views = append(views, authorDetailView{
			authorProfileView: authorProfileToView(p),
			ArticleCount:      count,
		})
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(views)
	common.ApiSuccess(c, pageInfo)
}

// GetPublishedBlogAuthor GET /api/blog/authors/:slug
func GetPublishedBlogAuthor(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" || !slugPattern.MatchString(slug) {
		common.ApiErrorMsg(c, "无效的 slug")
		return
	}

	profile, err := model.GetAuthorProfileBySlug(slug)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if profile == nil {
		common.ApiErrorMsg(c, "作者不存在")
		return
	}

	count, err := model.CountPublishedArticlesByAuthor(profile.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	followerCount := model.CountAuthorFollowers(profile.UserId)
	isFollowed := false
	if userId := c.GetInt("id"); userId > 0 {
		isFollowed = model.IsFollowing(userId, profile.UserId)
	}

	common.ApiSuccess(c, authorDetailView{
		authorProfileView: authorProfileToView(profile),
		ArticleCount:      count,
		FollowerCount:     followerCount,
		IsFollowed:        isFollowed,
	})
}

// GetPublishedBlogAuthorArticles GET /api/blog/authors/:slug/articles
func GetPublishedBlogAuthorArticles(c *gin.Context) {
	slug := strings.TrimSpace(c.Param("slug"))
	if slug == "" || !slugPattern.MatchString(slug) {
		common.ApiErrorMsg(c, "无效的 slug")
		return
	}

	profile, err := model.GetAuthorProfileBySlug(slug)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if profile == nil {
		common.ApiErrorMsg(c, "作者不存在")
		return
	}

	pageInfo := common.GetPageQuery(c)
	articles, total, err := model.GetPublishedArticlesByAuthor(profile.UserId, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	views := make([]blogArticleView, len(articles))
	for i, a := range articles {
		views[i] = articleToView(a)
	}
	views, err = attachAuthorsToViews(views)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(views)
	common.ApiSuccess(c, pageInfo)
}

// GetSelfAuthorProfile GET /api/user/author-profile
func GetSelfAuthorProfile(c *gin.Context) {
	userId := c.GetInt("id")
	profile, err := model.GetAuthorProfileByUserId(userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if profile == nil {
		common.ApiSuccess(c, nil)
		return
	}
	common.ApiSuccess(c, authorProfileToView(profile))
}

// FollowBlogAuthor POST /api/blog/authors/:slug/follow
func FollowBlogAuthor(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}

	slug := strings.TrimSpace(c.Param("slug"))
	profile, err := model.GetAuthorProfileBySlug(slug)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if profile == nil {
		common.ApiErrorMsg(c, "作者不存在")
		return
	}

	if err := model.FollowAuthor(userId, profile.UserId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"following": true, "follower_count": model.CountAuthorFollowers(profile.UserId)})
}

// UnfollowBlogAuthor DELETE /api/blog/authors/:slug/unfollow
func UnfollowBlogAuthor(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}

	slug := strings.TrimSpace(c.Param("slug"))
	profile, err := model.GetAuthorProfileBySlug(slug)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if profile == nil {
		common.ApiErrorMsg(c, "作者不存在")
		return
	}

	if err := model.UnfollowAuthor(userId, profile.UserId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, gin.H{"following": false, "follower_count": model.CountAuthorFollowers(profile.UserId)})
}

// UpdateSelfAuthorProfile PUT /api/user/author-profile
func UpdateSelfAuthorProfile(c *gin.Context) {
	userId := c.GetInt("id")
	if userId <= 0 {
		common.ApiErrorMsg(c, "未登录")
		return
	}

	var body struct {
		DisplayName string `json:"display_name"`
		Slug        string `json:"slug"`
		Avatar      string `json:"avatar"`
		Bio         string `json:"bio"`
		IsPublic    *bool  `json:"is_public"`
	}
	if err := common.DecodeJson(c.Request.Body, &body); err != nil {
		common.ApiErrorMsg(c, "请求体解析失败")
		return
	}

	slug := strings.TrimSpace(body.Slug)
	if slug == "" {
		common.ApiErrorMsg(c, "slug 不能为空")
		return
	}
	if !slugPattern.MatchString(slug) {
		common.ApiErrorMsg(c, "slug 只能包含小写字母、数字和连字符")
		return
	}
	if len(slug) > 100 {
		common.ApiErrorMsg(c, "slug 长度不能超过 100")
		return
	}
	if taken, err := model.AuthorProfileExistsBySlug(slug, userId); err != nil {
		common.ApiError(c, err)
		return
	} else if taken {
		common.ApiErrorMsg(c, "slug 已被占用")
		return
	}

	isPublic := false
	if body.IsPublic != nil {
		isPublic = *body.IsPublic
	}

	profile := &model.AuthorProfile{
		UserId:      userId,
		DisplayName: strings.TrimSpace(body.DisplayName),
		Slug:        slug,
		Avatar:      strings.TrimSpace(body.Avatar),
		Bio:         strings.TrimSpace(body.Bio),
		IsPublic:    isPublic,
	}
	if profile.DisplayName == "" {
		user, err := model.GetUserById(userId, false)
		if err == nil {
			profile.DisplayName = strings.TrimSpace(user.DisplayName)
			if profile.DisplayName == "" {
				profile.DisplayName = strings.TrimSpace(user.Username)
			}
		}
	}
	if len(profile.DisplayName) > 100 {
		common.ApiErrorMsg(c, "display_name 长度不能超过 100")
		return
	}
	if len(profile.Avatar) > 500 {
		common.ApiErrorMsg(c, "avatar 长度不能超过 500")
		return
	}
	if len(profile.Bio) > 1000 {
		common.ApiErrorMsg(c, "bio 长度不能超过 1000")
		return
	}

	if err := model.UpsertAuthorProfile(profile); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, authorProfileToView(profile))
}
