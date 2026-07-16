package controller

import (
	"net/http"

	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

// GetUpstreamModels 返回当前站点所有可被下游站点同步的模型元数据。
// 输出格式与 upstreamEnvelope[upstreamModel] 兼容，下游可直接通过
// 设置 SYNC_UPSTREAM_BASE 指向本接口来替代 basellm.github.io。
//
// 仅返回 Status=1 且 SyncOfficial != 0 的模型。
func GetUpstreamModels(c *gin.Context) {
	var models []model.Model
	if err := model.DB.
		Where("status = ? AND sync_official != ?", 1, 0).
		Order("model_name ASC").
		Find(&models).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to query models: " + err.Error(),
		})
		return
	}

	// 按需加载 vendor 名称映射
	vendorIDs := make(map[int]struct{})
	for _, m := range models {
		if m.VendorID != 0 {
			vendorIDs[m.VendorID] = struct{}{}
		}
	}
	vendorNameByID := make(map[int]string, len(vendorIDs))
	if len(vendorIDs) > 0 {
		ids := make([]int, 0, len(vendorIDs))
		for id := range vendorIDs {
			ids = append(ids, id)
		}
		var vendors []model.Vendor
		if err := model.DB.Where("id IN ?", ids).Find(&vendors).Error; err == nil {
			for _, v := range vendors {
				vendorNameByID[v.Id] = v.Name
			}
		}
	}

	data := make([]upstreamModel, 0, len(models))
	for _, m := range models {
		data = append(data, upstreamModel{
			ModelName:   m.ModelName,
			Description: m.Description,
			Icon:        m.Icon,
			Tags:        m.Tags,
			VendorName:  vendorNameByID[m.VendorID],
			NameRule:    m.NameRule,
			Status:      m.Status,
		})
	}

	c.JSON(http.StatusOK, upstreamEnvelope[upstreamModel]{
		Success: true,
		Data:    data,
	})
}

// GetUpstreamVendors 返回当前站点所有供应商信息。
// 输出格式与 upstreamEnvelope[upstreamVendor] 兼容。
//
// 仅返回 Status=1 的供应商。
func GetUpstreamVendors(c *gin.Context) {
	var vendors []model.Vendor
	if err := model.DB.
		Where("status = ?", 1).
		Order("name ASC").
		Find(&vendors).Error; err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": false,
			"message": "failed to query vendors: " + err.Error(),
		})
		return
	}

	data := make([]upstreamVendor, 0, len(vendors))
	for _, v := range vendors {
		data = append(data, upstreamVendor{
			Name:        v.Name,
			Description: v.Description,
			Icon:        v.Icon,
			Status:      v.Status,
		})
	}

	c.JSON(http.StatusOK, upstreamEnvelope[upstreamVendor]{
		Success: true,
		Data:    data,
	})
}
