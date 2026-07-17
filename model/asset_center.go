package model

import "errors"

// AssetType defines the category of an asset in the unified asset center.
type AssetType string

const (
	AssetTypeCharacter  AssetType = "character"
	AssetTypeStoryboard AssetType = "storyboard"
	AssetTypeClip       AssetType = "clip"
	AssetTypeLora       AssetType = "lora"
	AssetTypeScene      AssetType = "scene"
	AssetTypeMusic      AssetType = "music"
)

// AssetVisibility controls who can see the asset.
type AssetVisibility string

const (
	AssetVisibilityPrivate AssetVisibility = "private"
	AssetVisibilityTeam    AssetVisibility = "team"
	AssetVisibilityPublic  AssetVisibility = "public"
)

// AssetCenter is the unified asset model backing cross-site asset sync
// (image-playground, video-playground, film-studio).
type AssetCenter struct {
	Id          int             `json:"id" gorm:"primaryKey;autoIncrement"`
	UserId      int             `json:"user_id" gorm:"index;not null"`
	ProjectId   *int            `json:"project_id" gorm:"index"`
	AssetType   AssetType       `json:"asset_type" gorm:"type:varchar(32);index;not null"`
	Name        string          `json:"name" gorm:"type:varchar(128);not null"`
	Description string          `json:"description" gorm:"type:text"`
	URL         string          `json:"url" gorm:"type:varchar(500)"`
	ThumbnailURL string         `json:"thumbnail_url" gorm:"type:varchar(500)"`
	Metadata    string          `json:"metadata" gorm:"type:text"`
	Visibility  AssetVisibility `json:"visibility" gorm:"type:varchar(16);default:private"`
	Tags        string          `json:"tags" gorm:"type:varchar(500)"`
	FileSize    int64           `json:"file_size" gorm:"default:0"`
	Width       int             `json:"width" gorm:"default:0"`
	Height      int             `json:"height" gorm:"default:0"`
	Duration    float64         `json:"duration" gorm:"default:0"`
	SourceApp   string          `json:"source_app" gorm:"type:varchar(32)"`
	SourceId    *int            `json:"source_id"`
	CreatedAt   int64           `json:"created_at" gorm:"autoCreateTime:milli"`
	UpdatedAt   int64           `json:"updated_at" gorm:"autoUpdateTime:milli"`
}

func (a *AssetCenter) Insert() error {
	if a.UserId == 0 {
		return errors.New("user_id is required")
	}
	return DB.Create(a).Error
}

func (a *AssetCenter) Update() error {
	return DB.Model(a).Select(
		"name", "description", "url", "thumbnail_url", "metadata",
		"visibility", "tags", "width", "height", "duration",
	).Updates(a).Error
}

func (a *AssetCenter) Delete() error {
	return DB.Delete(a).Error
}

func GetAssetCenterById(id int) (*AssetCenter, error) {
	if id == 0 {
		return nil, errors.New("id is required")
	}
	var a AssetCenter
	if err := DB.First(&a, "id = ?", id).Error; err != nil {
		return nil, err
	}
	return &a, nil
}

// AssetCenterListParams holds filter options for listing assets.
type AssetCenterListParams struct {
	UserId     *int
	AssetType  *AssetType
	ProjectId  *int
	Visibility *AssetVisibility
	Search     string
	Page       int
	PageSize   int
}

func ListAssetCenter(params AssetCenterListParams) ([]AssetCenter, int64, error) {
	tx := DB.Model(&AssetCenter{})

	if params.UserId != nil {
		tx = tx.Where("user_id = ?", *params.UserId)
	}
	if params.AssetType != nil {
		tx = tx.Where("asset_type = ?", *params.AssetType)
	}
	if params.ProjectId != nil {
		tx = tx.Where("project_id = ? OR project_id IS NULL", *params.ProjectId)
	}
	if params.Visibility != nil {
		tx = tx.Where("visibility = ?", *params.Visibility)
	}
	if params.Search != "" {
		tx = tx.Where("name LIKE ? OR tags LIKE ?",
			"%"+params.Search+"%", "%"+params.Search+"%")
	}

	var total int64
	if err := tx.Count(&total).Error; err != nil {
		return nil, 0, err
	}

	if params.PageSize <= 0 {
		params.PageSize = 20
	}
	if params.Page <= 0 {
		params.Page = 1
	}
	offset := (params.Page - 1) * params.PageSize

	var assets []AssetCenter
	err := tx.Order("created_at desc").
		Offset(offset).Limit(params.PageSize).
		Find(&assets).Error
	return assets, total, err
}

func DeleteAssetsByProjectId(projectId int) error {
	return DB.Where("project_id = ?", projectId).Delete(&AssetCenter{}).Error
}

func GetAssetsBySource(sourceApp string, sourceId int) ([]AssetCenter, error) {
	var assets []AssetCenter
	err := DB.Where("source_app = ? AND source_id = ?", sourceApp, sourceId).
		Order("created_at desc").Find(&assets).Error
	return assets, err
}
