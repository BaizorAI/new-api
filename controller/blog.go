package controller

import (
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"
	"github.com/gin-gonic/gin"
)

// blogEditorsTeamId is the legacy header-based team identifier kept for
// HermesAgent skill compatibility.
const blogEditorsTeamId = "blog-editors"

// blogAuthorTeamName is the team whose members get publish permission
// automatically, without needing the delegation header.
const blogAuthorTeamName = "Author"

// blogArticleBody is the shape accepted by create and update endpoints.
type blogArticleBody struct {
	Title      string   `json:"title"`
	Summary    string   `json:"summary"`
	CoverImage string   `json:"cover_image"`
	Content    string   `json:"content"`
	Tags       []string `json:"tags"`
	Status     string   `json:"status"`
}

// blogArticleView is the API response shape (tags as []string).
type blogArticleView struct {
	Id          int                `json:"id"`
	Guid        string             `json:"guid"`
	AuthorId    int                `json:"author_id"`
	Title       string             `json:"title"`
	Summary     string             `json:"summary"`
	CoverImage  string             `json:"cover_image"`
	Content     string             `json:"content"`
	Tags        []string           `json:"tags"`
	Status      string             `json:"status"`
	CreatedTime int64              `json:"created_time"`
	UpdatedTime int64              `json:"updated_time"`
	PublishedAt int64              `json:"published_at"`
	Author      *authorProfileView `json:"author,omitempty"`
}

func articleToView(a *model.BlogArticle) blogArticleView {
	return blogArticleView{
		Id:          a.Id,
		Guid:        a.Guid,
		AuthorId:    a.AuthorId,
		Title:       a.Title,
		Summary:     a.Summary,
		CoverImage:  a.CoverImage,
		Content:     a.Content,
		Tags:        a.TagsToSlice(),
		Status:      a.Status,
		CreatedTime: a.CreatedTime,
		UpdatedTime: a.UpdatedTime,
		PublishedAt: a.PublishedAt,
	}
}

// canPublish returns true when the caller may publish articles.
// Three paths: admin role, legacy HermesAgent delegation header, or
// membership in the "Author" team.
func canPublish(c *gin.Context) bool {
	if c.GetInt("role") >= common.RoleAdminUser {
		return true
	}
	// Legacy: HermesAgent skill passes the delegation header explicitly.
	if c.GetHeader("X-Baizor-Delegated-Team-Id") == blogEditorsTeamId {
		return true
	}
	// New: any member of the "Author" team can publish on their own token.
	userId := c.GetInt("id")
	if userId <= 0 {
		return false
	}
	teams, err := model.GetUserTeams(userId)
	if err != nil {
		return false
	}
	for _, t := range teams {
		if t.Name == blogAuthorTeamName {
			return true
		}
	}
	return false
}

// GetAllBlogArticles GET /api/blog/
// Admin sees all articles; regular users see only their own.
// Query params: ?status=draft|published|archived  ?author_id=<id>  ?keyword=<q>
//                ?p=<page>  ?page_size=<n>
func GetAllBlogArticles(c *gin.Context) {
	userId := c.GetInt("id")
	userRole := c.GetInt("role")

	status := c.Query("status")
	if status != "" && !model.ValidBlogArticleStatus(status) {
		common.ApiErrorMsg(c, "无效的 status 值")
		return
	}

	keyword := strings.TrimSpace(c.Query("keyword"))

	// Admin queries across all authors; regular users are scoped to themselves.
	authorId := userId
	if userRole >= common.RoleAdminUser {
		authorId = 0
		if raw := c.Query("author_id"); raw != "" {
			if id, parseErr := strconv.Atoi(raw); parseErr == nil && id > 0 {
				authorId = id
			}
		}
	}

	pageInfo := common.GetPageQuery(c)
	articles, total, err := model.SearchBlogArticles(authorId, status, keyword, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
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

// GetBlogArticle GET /api/blog/:identifier
// Accepts either numeric id or GUID.
func GetBlogArticle(c *gin.Context) {
	identifier := strings.TrimSpace(c.Param("id"))
	if identifier == "" {
		common.ApiErrorMsg(c, "无效的 identifier")
		return
	}

	var article *model.BlogArticle
	var err error
	if id, parseErr := strconv.Atoi(identifier); parseErr == nil && id > 0 {
		article, err = model.GetBlogArticleById(id)
	} else {
		article, err = model.GetBlogArticleByGuid(identifier)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")
	userRole := c.GetInt("role")
	if userRole < common.RoleAdminUser && article.AuthorId != userId {
		common.ApiErrorMsg(c, "无权访问该文章")
		return
	}

	common.ApiSuccess(c, articleToView(article))
}

// CreateBlogArticle POST /api/blog/
func CreateBlogArticle(c *gin.Context) {
	var body blogArticleBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "请求体解析失败: "+err.Error())
		return
	}
	if body.Title == "" {
		common.ApiErrorMsg(c, "标题不能为空")
		return
	}

	status := body.Status
	if status == "" {
		status = model.BlogArticleStatusDraft
	}
	if !model.ValidBlogArticleStatus(status) {
		common.ApiErrorMsg(c, "无效的 status 值")
		return
	}
	if status == model.BlogArticleStatusPublished && !canPublish(c) {
		common.ApiErrorMsg(c, "无发布权限，需要管理员权限或 Author 团队成员资格")
		return
	}

	now := common.GetTimestamp()
	article := &model.BlogArticle{
		AuthorId:    c.GetInt("id"),
		Title:       body.Title,
		Summary:     body.Summary,
		CoverImage:  body.CoverImage,
		Content:     body.Content,
		Tags:        model.TagsFromSlice(body.Tags),
		Status:      status,
		CreatedTime: now,
		UpdatedTime: now,
	}
	if status == model.BlogArticleStatusPublished {
		article.PublishedAt = now
	}

	if err := article.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, articleToView(article))
}

// UpdateBlogArticle PUT /api/blog/:id
func UpdateBlogArticle(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id")
		return
	}

	article, err := model.GetBlogArticleById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")
	userRole := c.GetInt("role")
	if userRole < common.RoleAdminUser && article.AuthorId != userId {
		common.ApiErrorMsg(c, "无权修改该文章")
		return
	}

	var body blogArticleBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "请求体解析失败: "+err.Error())
		return
	}

	if body.Status != "" {
		if !model.ValidBlogArticleStatus(body.Status) {
			common.ApiErrorMsg(c, "无效的 status 值")
			return
		}
		if body.Status == model.BlogArticleStatusPublished &&
			article.Status != model.BlogArticleStatusPublished &&
			!canPublish(c) {
			common.ApiErrorMsg(c, "无发布权限，需要管理员权限或 Author 团队成员资格")
			return
		}
	}

	if body.Title != "" {
		article.Title = body.Title
	}
	if body.Summary != "" {
		article.Summary = body.Summary
	}
	if body.CoverImage != "" {
		article.CoverImage = body.CoverImage
	}
	if body.Content != "" {
		article.Content = body.Content
	}
	if body.Tags != nil {
		article.Tags = model.TagsFromSlice(body.Tags)
	}

	now := common.GetTimestamp()
	article.UpdatedTime = now

	if body.Status != "" {
		if body.Status == model.BlogArticleStatusPublished && article.PublishedAt == 0 {
			article.PublishedAt = now
		}
		article.Status = body.Status
	}

	if err := article.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, articleToView(article))
}

// GetBlogArticleAuthors GET /api/blog/authors
// Admin only. Returns every user who has created at least one blog article.
func GetBlogArticleAuthors(c *gin.Context) {
	if c.GetInt("role") < common.RoleAdminUser {
		common.ApiErrorMsg(c, "无权访问")
		return
	}

	var authorIds []int
	if err := model.DB.Model(&model.BlogArticle{}).
		Where("deleted_at IS NULL").
		Distinct("author_id").
		Pluck("author_id", &authorIds).Error; err != nil {
		common.ApiError(c, err)
		return
	}

	users, err := model.GetUsersByIds(authorIds)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	type authorOption struct {
		Id          int    `json:"id"`
		DisplayName string `json:"display_name"`
	}
	options := make([]authorOption, 0, len(users))
	for _, user := range users {
		name := strings.TrimSpace(user.DisplayName)
		if name == "" {
			name = strings.TrimSpace(user.Username)
		}
		if name == "" {
			continue
		}
		options = append(options, authorOption{
			Id:          user.Id,
			DisplayName: name,
		})
	}

	common.ApiSuccess(c, options)
}

// BatchDeleteBlogArticles POST /api/blog/batch/delete
// Admin only. Permanently deletes all articles in the request body.
func BatchDeleteBlogArticles(c *gin.Context) {
	if c.GetInt("role") < common.RoleAdminUser {
		common.ApiErrorMsg(c, "无权访问")
		return
	}

	var body struct {
		Ids []int `json:"ids"`
	}
	if err := common.DecodeJson(c.Request.Body, &body); err != nil {
		common.ApiErrorMsg(c, "请求体解析失败")
		return
	}
	if len(body.Ids) == 0 {
		common.ApiErrorMsg(c, "ids 不能为空")
		return
	}

	if err := model.DeleteBlogArticlesByIds(body.Ids); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// BatchUpdateBlogArticles POST /api/blog/batch/update
// Admin only. Updates the status of all articles in the request body.
func BatchUpdateBlogArticles(c *gin.Context) {
	if c.GetInt("role") < common.RoleAdminUser {
		common.ApiErrorMsg(c, "无权访问")
		return
	}

	var body struct {
		Ids    []int  `json:"ids"`
		Status string `json:"status"`
	}
	if err := common.DecodeJson(c.Request.Body, &body); err != nil {
		common.ApiErrorMsg(c, "请求体解析失败")
		return
	}
	if len(body.Ids) == 0 {
		common.ApiErrorMsg(c, "ids 不能为空")
		return
	}
	if !model.ValidBlogArticleStatus(body.Status) {
		common.ApiErrorMsg(c, "无效的 status 值")
		return
	}

	if err := model.UpdateBlogArticlesStatusByIds(body.Ids, body.Status); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// DeleteBlogArticle DELETE /api/blog/:id
func DeleteBlogArticle(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id")
		return
	}

	article, err := model.GetBlogArticleById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	userId := c.GetInt("id")
	userRole := c.GetInt("role")
	if userRole < common.RoleAdminUser && article.AuthorId != userId {
		common.ApiErrorMsg(c, "无权删除该文章")
		return
	}

	if err := article.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// GetPublishedBlogArticles GET /api/blog/public/
// No auth required. Returns only published articles.
// Query params: ?p=<page>  ?page_size=<n>  ?author_id=<id>
func GetPublishedBlogArticles(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	authorId := 0
	if raw := c.Query("author_id"); raw != "" {
		if id, parseErr := strconv.Atoi(raw); parseErr == nil && id > 0 {
			authorId = id
		}
	}
	articles, total, err := model.GetAllBlogArticles(authorId, model.BlogArticleStatusPublished, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
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

// GetPublishedBlogArticle GET /api/blog/public/:identifier
// No auth required. Accepts either numeric id or GUID. Returns only published articles.
func GetPublishedBlogArticle(c *gin.Context) {
	identifier := strings.TrimSpace(c.Param("id"))
	if identifier == "" {
		common.ApiErrorMsg(c, "无效的 identifier")
		return
	}

	var article *model.BlogArticle
	var err error
	if id, parseErr := strconv.Atoi(identifier); parseErr == nil && id > 0 {
		article, err = model.GetBlogArticleById(id)
	} else {
		article, err = model.GetBlogArticleByGuid(identifier)
	}
	if err != nil {
		common.ApiError(c, err)
		return
	}

	if article.Status != model.BlogArticleStatusPublished {
		common.ApiErrorMsg(c, "文章不存在或尚未发布")
		return
	}

	view := articleToView(article)
	author, err := buildAuthorProfileView(article.AuthorId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	view.Author = author
	common.ApiSuccess(c, view)
}

// SearchPublishedBlogArticles GET /api/blog/public/search
// Query: ?q=<keyword>&tag=go&tag=ai&p=&page_size=
func SearchPublishedBlogArticles(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("q"))
	tags := c.QueryArray("tag")

	pageInfo := common.GetPageQuery(c)
	articles, total, err := model.SearchPublishedBlogArticles(
		keyword, tags, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
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

// GetRelatedPublishedBlogArticles GET /api/blog/public/articles/:id/related
// Returns published articles that share at least one tag.
func GetRelatedPublishedBlogArticles(c *gin.Context) {
	identifier := strings.TrimSpace(c.Param("id"))
	var article *model.BlogArticle
	var err error
	if id, parseErr := strconv.Atoi(identifier); parseErr == nil && id > 0 {
		article, err = model.GetBlogArticleById(id)
	} else {
		article, err = model.GetBlogArticleByGuid(identifier)
	}
	if err != nil || article == nil || article.Status != model.BlogArticleStatusPublished {
		common.ApiErrorMsg(c, "文章不存在或尚未发布")
		return
	}

	pageInfo := common.GetPageQuery(c)
	articles, total, err := model.GetRelatedPublishedArticles(
		article.Id, article.TagsToSlice(), pageInfo.GetStartIdx(), pageInfo.GetPageSize())
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

// GetPublishedBlogTags GET /api/blog/public/tags
// Returns the most frequently used tags among published articles.
func GetPublishedBlogTags(c *gin.Context) {
	limit := 50
	if raw := c.Query("limit"); raw != "" {
		if n, err := strconv.Atoi(raw); err == nil && n > 0 {
			limit = n
		}
	}
	tags, err := model.GetPublishedBlogTags(limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, tags)
}

// ============================================================================
// Blog Chat Message API
// ============================================================================

type blogSaveChatMessagesRequest struct {
	Messages []blogChatMessageBody `json:"messages"`
}

type blogChatMessageBody struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// ListBlogChatMessages GET /api/blog/:id/messages
func ListBlogChatMessages(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id")
		return
	}

	// Verify the article exists and belongs to the user
	article, err := model.GetBlogArticleById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	userRole := c.GetInt("role")
	if userRole < common.RoleAdminUser && article.AuthorId != userId {
		common.ApiErrorMsg(c, "无权访问该文章")
		return
	}

	messages, err := model.GetBlogChatMessages(id, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if messages == nil {
		messages = []model.BlogChatMessage{}
	}
	common.ApiSuccess(c, messages)
}

// SaveBlogChatMessages POST /api/blog/:id/messages
func SaveBlogChatMessages(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id")
		return
	}

	// Verify the article exists and belongs to the user
	article, err := model.GetBlogArticleById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	userRole := c.GetInt("role")
	if userRole < common.RoleAdminUser && article.AuthorId != userId {
		common.ApiErrorMsg(c, "无权修改该文章")
		return
	}

	var req blogSaveChatMessagesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}

	var saved []model.BlogChatMessage
	for _, m := range req.Messages {
		if m.Role != "user" && m.Role != "assistant" {
			continue
		}
		if strings.TrimSpace(m.Content) == "" {
			continue
		}
		msg := model.BlogChatMessage{
			ArticleId: id,
			UserId:    userId,
			Role:      m.Role,
			Content:   m.Content,
		}
		if err := msg.Insert(); err != nil {
			common.ApiError(c, err)
			return
		}
		saved = append(saved, msg)
	}
	common.ApiSuccess(c, saved)
}

// ClearBlogChatMessages DELETE /api/blog/:id/messages
func ClearBlogChatMessages(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "无效的 id")
		return
	}

	// Verify the article exists and belongs to the user
	article, err := model.GetBlogArticleById(id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	userId := c.GetInt("id")
	userRole := c.GetInt("role")
	if userRole < common.RoleAdminUser && article.AuthorId != userId {
		common.ApiErrorMsg(c, "无权修改该文章")
		return
	}

	if err := model.ClearBlogChatMessages(id, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ============================================================================
// Blog Image Upload API
// ============================================================================

const blogUploadDir = "blog-images"

type blogFileUploadResponse struct {
	Url      string `json:"url"`
	Filename string `json:"filename"`
	Bytes    int64  `json:"bytes"`
}

// UploadBlogImage POST /api/blog/files/upload
func UploadBlogImage(c *gin.Context) {
	userId := c.GetInt("id")

	os.MkdirAll(blogUploadDir, 0o755)

	file, header, err := c.Request.FormFile("image")
	if err != nil {
		common.ApiErrorMsg(c, "请上传图片文件（字段名: image）")
		return
	}
	defer file.Close()

	ext := strings.ToLower(filepath.Ext(header.Filename))
	allowed := map[string]bool{".jpg": true, ".jpeg": true, ".png": true, ".gif": true, ".webp": true, ".svg": true}
	if !allowed[ext] {
		common.ApiErrorMsg(c, "不支持的图片格式，只支持 jpg/png/gif/webp/svg")
		return
	}

	diskFilename := fmt.Sprintf("%d_%d%s", userId, time.Now().UnixNano(), ext)
	diskPath := filepath.Join(blogUploadDir, diskFilename)

	dst, err := os.Create(diskPath)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	written, err := io.Copy(dst, file)
	dst.Close()
	if err != nil {
		os.Remove(diskPath)
		common.ApiError(c, err)
		return
	}

	publicUrl := "/api/blog/files/" + diskFilename
	common.ApiSuccess(c, blogFileUploadResponse{
		Url:      publicUrl,
		Filename: header.Filename,
		Bytes:    written,
	})
}

// ServeBlogImage GET /api/blog/files/:filename
// Public — serves uploaded blog images without auth.
func ServeBlogImage(c *gin.Context) {
	filename := c.Param("filename")
	cleanName := filepath.Clean(filename)
	if strings.Contains(cleanName, "..") || strings.Contains(cleanName, string(filepath.Separator)) {
		common.ApiErrorMsg(c, "invalid filename")
		return
	}
	diskPath := filepath.Join(blogUploadDir, cleanName)
	if _, err := os.Stat(diskPath); os.IsNotExist(err) {
		common.ApiErrorMsg(c, "file not found")
		return
	}
	c.File(diskPath)
}
