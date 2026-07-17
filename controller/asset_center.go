package controller

import (
	"net/http"
	"strconv"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"
	"github.com/gin-gonic/gin"
)

// ── Request / Response DTOs ───────────────────────────────────────

type assetCenterBody struct {
	Name         string               `json:"name"`
	Description  string               `json:"description"`
	AssetType    model.AssetType      `json:"asset_type"`
	URL          string               `json:"url"`
	ThumbnailURL string               `json:"thumbnail_url"`
	Metadata     string               `json:"metadata"`
	Visibility   model.AssetVisibility `json:"visibility"`
	Tags         string               `json:"tags"`
	FileSize     int64                `json:"file_size"`
	Width        int                  `json:"width"`
	Height       int                  `json:"height"`
	Duration     float64              `json:"duration"`
	SourceApp    string               `json:"source_app"`
	SourceId     *int                 `json:"source_id"`
	ProjectId    *int                 `json:"project_id"`
}

type assetCenterView struct {
	Id           int                   `json:"id"`
	UserId       int                   `json:"user_id"`
	ProjectId    *int                  `json:"project_id"`
	AssetType    model.AssetType       `json:"asset_type"`
	Name         string                `json:"name"`
	Description  string                `json:"description"`
	URL          string                `json:"url"`
	ThumbnailURL string                `json:"thumbnail_url"`
	Metadata     string                `json:"metadata"`
	Visibility   model.AssetVisibility `json:"visibility"`
	Tags         string                `json:"tags"`
	FileSize     int64                 `json:"file_size"`
	Width        int                   `json:"width"`
	Height       int                   `json:"height"`
	Duration     float64               `json:"duration"`
	SourceApp    string                `json:"source_app"`
	SourceId     *int                  `json:"source_id"`
	CreatedAt    int64                 `json:"created_at"`
	UpdatedAt    int64                 `json:"updated_at"`
}

func assetToView(a *model.AssetCenter) assetCenterView {
	return assetCenterView{
		Id:           a.Id,
		UserId:       a.UserId,
		ProjectId:    a.ProjectId,
		AssetType:    a.AssetType,
		Name:         a.Name,
		Description:  a.Description,
		URL:          a.URL,
		ThumbnailURL: a.ThumbnailURL,
		Metadata:     a.Metadata,
		Visibility:   a.Visibility,
		Tags:         a.Tags,
		FileSize:     a.FileSize,
		Width:        a.Width,
		Height:       a.Height,
		Duration:     a.Duration,
		SourceApp:    a.SourceApp,
		SourceId:     a.SourceId,
		CreatedAt:    a.CreatedAt,
		UpdatedAt:    a.UpdatedAt,
	}
}

type assetCenterListResponse struct {
	Items []assetCenterView `json:"items"`
	Total int64             `json:"total"`
	Page  int               `json:"page"`
}

// ── Handlers ──────────────────────────────────────────────────────

func ListAssetCenter(c *gin.Context) {
	userId := c.GetInt("id")

	params := model.AssetCenterListParams{
		UserId: &userId,
		Search: c.Query("search"),
	}

	if t := c.Query("asset_type"); t != "" {
		at := model.AssetType(t)
		params.AssetType = &at
	}
	if pid := c.Query("project_id"); pid != "" {
		v, err := strconv.Atoi(pid)
		if err == nil {
			params.ProjectId = &v
		}
	}
	if v := c.Query("visibility"); v != "" {
		av := model.AssetVisibility(v)
		params.Visibility = &av
	}
	if p := c.Query("page"); p != "" {
		v, err := strconv.Atoi(p)
		if err == nil {
			params.Page = v
		}
	}
	if ps := c.Query("page_size"); ps != "" {
		v, err := strconv.Atoi(ps)
		if err == nil {
			params.PageSize = v
		}
	}

	assets, total, err := model.ListAssetCenter(params)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	views := make([]assetCenterView, len(assets))
	for i, a := range assets {
		views[i] = assetToView(&a)
	}

	c.JSON(http.StatusOK, assetCenterListResponse{
		Items: views,
		Total: total,
		Page:  params.Page,
	})
}

func CreateAssetCenter(c *gin.Context) {
	userId := c.GetInt("id")

	var body assetCenterBody
	if err := common.DecodeJson(c.Request.Body, &body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON body"})
		return
	}

	if body.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		return
	}
	if body.AssetType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "asset_type is required"})
		return
	}

	asset := model.AssetCenter{
		UserId:       userId,
		ProjectId:    body.ProjectId,
		AssetType:    body.AssetType,
		Name:         body.Name,
		Description:  body.Description,
		URL:          body.URL,
		ThumbnailURL: body.ThumbnailURL,
		Metadata:     body.Metadata,
		Visibility:   body.Visibility,
		Tags:         body.Tags,
		FileSize:     body.FileSize,
		Width:        body.Width,
		Height:       body.Height,
		Duration:     body.Duration,
		SourceApp:    body.SourceApp,
		SourceId:     body.SourceId,
	}
	if asset.Visibility == "" {
		asset.Visibility = model.AssetVisibilityPrivate
	}

	if err := asset.Insert(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, assetToView(&asset))
}

func GetAssetCenter(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}

	asset, err := model.GetAssetCenterById(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "asset not found"})
		return
	}

	c.JSON(http.StatusOK, assetToView(asset))
}

func UpdateAssetCenter(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}

	asset, err := model.GetAssetCenterById(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "asset not found"})
		return
	}

	var body assetCenterBody
	if err := common.DecodeJson(c.Request.Body, &body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid JSON body"})
		return
	}

	if body.Name != "" {
		asset.Name = body.Name
	}
	if body.Description != "" {
		asset.Description = body.Description
	}
	if body.URL != "" {
		asset.URL = body.URL
	}
	if body.ThumbnailURL != "" {
		asset.ThumbnailURL = body.ThumbnailURL
	}
	if body.Metadata != "" {
		asset.Metadata = body.Metadata
	}
	if body.Visibility != "" {
		asset.Visibility = body.Visibility
	}
	asset.Tags = body.Tags
	asset.Width = body.Width
	asset.Height = body.Height
	asset.Duration = body.Duration

	if err := asset.Update(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, assetToView(asset))
}

func DeleteAssetCenter(c *gin.Context) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid asset id"})
		return
	}

	asset, err := model.GetAssetCenterById(id)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "asset not found"})
		return
	}

	if err := asset.Delete(); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "asset deleted"})
}

func ListAssetCenterTypes(c *gin.Context) {
	c.JSON(http.StatusOK, []model.AssetType{
		model.AssetTypeCharacter,
		model.AssetTypeStoryboard,
		model.AssetTypeClip,
		model.AssetTypeLora,
		model.AssetTypeScene,
		model.AssetTypeMusic,
	})
}
