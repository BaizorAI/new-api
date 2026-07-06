package controller

import (
	"strconv"

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
	Title   string   `json:"title"`
	Summary string   `json:"summary"`
	Content string   `json:"content"`
	Tags    []string `json:"tags"`
	Status  string   `json:"status"`
}

// blogArticleView is the API response shape (tags as []string).
type blogArticleView struct {
	Id          int      `json:"id"`
	AuthorId    int      `json:"author_id"`
	Title       string   `json:"title"`
	Summary     string   `json:"summary"`
	Content     string   `json:"content"`
	Tags        []string `json:"tags"`
	Status      string   `json:"status"`
	CreatedTime int64    `json:"created_time"`
	UpdatedTime int64    `json:"updated_time"`
	PublishedAt int64    `json:"published_at"`
}

func articleToView(a *model.BlogArticle) blogArticleView {
	return blogArticleView{
		Id:          a.Id,
		AuthorId:    a.AuthorId,
		Title:       a.Title,
		Summary:     a.Summary,
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
// Query params: ?status=draft|published|archived  ?p=<page>  ?page_size=<n>
func GetAllBlogArticles(c *gin.Context) {
	userId := c.GetInt("id")
	userRole := c.GetInt("role")

	status := c.Query("status")
	if status != "" && !model.ValidBlogArticleStatus(status) {
		common.ApiErrorMsg(c, "无效的 status 值")
		return
	}

	// Admin queries across all authors; regular users are scoped to themselves.
	authorId := userId
	if userRole >= common.RoleAdminUser {
		authorId = 0
	}

	pageInfo := common.GetPageQuery(c)
	articles, total, err := model.GetAllBlogArticles(authorId, status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	views := make([]blogArticleView, len(articles))
	for i, a := range articles {
		views[i] = articleToView(a)
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(views)
	common.ApiSuccess(c, pageInfo)
}

// GetBlogArticle GET /api/blog/:id
func GetBlogArticle(c *gin.Context) {
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
// Query params: ?p=<page>  ?page_size=<n>
func GetPublishedBlogArticles(c *gin.Context) {
	pageInfo := common.GetPageQuery(c)
	articles, total, err := model.GetAllBlogArticles(0, model.BlogArticleStatusPublished, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	views := make([]blogArticleView, len(articles))
	for i, a := range articles {
		views[i] = articleToView(a)
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(views)
	common.ApiSuccess(c, pageInfo)
}

// GetPublishedBlogArticle GET /api/blog/public/:id
// No auth required. Returns the article only if it is published.
func GetPublishedBlogArticle(c *gin.Context) {
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

	if article.Status != model.BlogArticleStatusPublished {
		common.ApiErrorMsg(c, "文章不存在或尚未发布")
		return
	}

	common.ApiSuccess(c, articleToView(article))
}
