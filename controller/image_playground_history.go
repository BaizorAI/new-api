package controller

import (
	"net/http"
	"strconv"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

type imagePlaygroundHistoryRequest struct {
	Prompt        string `json:"prompt"`
	Model         string `json:"model"`
	Size          string `json:"size"`
	Quality       string `json:"quality"`
	ImageURL      string `json:"image_url"`
	RevisedPrompt string `json:"revised_prompt"`
}

func ListImagePlaygroundHistory(c *gin.Context) {
	userId := c.GetInt("id")
	pageInfo := common.GetPageQuery(c)

	records, total, err := model.GetUserImagePlaygroundHistory(userId, pageInfo)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(records)
	common.ApiSuccess(c, pageInfo)
}

func CreateImagePlaygroundHistoryEntry(c *gin.Context) {
	userId := c.GetInt("id")
	var req imagePlaygroundHistoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid request body"})
		return
	}
	if req.Prompt == "" || req.Model == "" {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "prompt and model are required"})
		return
	}

	record := &model.ImagePlaygroundHistory{
		UserId:        userId,
		Prompt:        req.Prompt,
		Model:         req.Model,
		Size:          req.Size,
		Quality:       req.Quality,
		ImageURL:      req.ImageURL,
		RevisedPrompt: req.RevisedPrompt,
	}
	if err := model.CreateImagePlaygroundHistory(record); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, record)
}

func DeleteImagePlaygroundHistoryEntry(c *gin.Context) {
	userId := c.GetInt("id")
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"success": false, "message": "invalid id"})
		return
	}
	if err := model.DeleteImagePlaygroundHistory(userId, id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

func ClearImagePlaygroundHistoryEntries(c *gin.Context) {
	userId := c.GetInt("id")
	if err := model.ClearImagePlaygroundHistory(userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}
