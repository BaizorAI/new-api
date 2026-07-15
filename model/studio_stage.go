package model

const (
	StageStatusNotStarted    = 0
	StageStatusInProgress    = 1
	StageStatusCompleted     = 2
	StageStatusNeedsRevision = 3
)

type StudioStage struct {
	Id         int    `json:"id" gorm:"primaryKey;autoIncrement"`
	ProjectId  int    `json:"project_id" gorm:"index;uniqueIndex:idx_studio_stage_project_key"`
	Key        string `json:"key" gorm:"type:varchar(32);uniqueIndex:idx_studio_stage_project_key"`
	Name       string `json:"name" gorm:"type:varchar(64)"`
	Order      int    `json:"order"`
	Status     int    `json:"status" gorm:"default:0"`
	AutoSkill  string `json:"auto_skill" gorm:"type:varchar(64)"`
	TotalItems int    `json:"total_items" gorm:"default:0"`
	DoneItems  int    `json:"done_items" gorm:"default:0"`
	OutputData string `json:"output_data" gorm:"type:text"`
	CreatedAt  int64  `json:"created_at" gorm:"autoCreateTime:milli"`
	UpdatedAt  int64  `json:"updated_at" gorm:"autoUpdateTime:milli"`
}

// defaultStageTemplate defines one entry in the auto-generated pipeline.
type defaultStageTemplate struct {
	Key       string
	Name      string
	Order     int
	AutoSkill string
}

var defaultProjectStages = []defaultStageTemplate{
	{"script", "剧本", 1, "script-analyzer"},
	{"characters", "角色", 2, "character-designer"},
	{"storyboard", "分镜", 3, "shot-planner"},
	{"image_gen", "图像生成", 4, "batch-generator"},
	{"video_gen", "视频生成", 5, "batch-generator"},
	{"post", "后期合成", 6, "post-production"},
	{"review", "审核发布", 7, ""},
}

// buildDefaultStages creates the 7 default stage records for a new project.
func buildDefaultStages(projectId int) []StudioStage {
	stages := make([]StudioStage, len(defaultProjectStages))
	for i, t := range defaultProjectStages {
		stages[i] = StudioStage{
			ProjectId: projectId,
			Key:       t.Key,
			Name:      t.Name,
			Order:     t.Order,
			AutoSkill: t.AutoSkill,
		}
	}
	return stages
}

func GetStudioStagesByProjectId(projectId int) ([]StudioStage, error) {
	var stages []StudioStage
	err := DB.Where("project_id = ?", projectId).Order("`order` asc").Find(&stages).Error
	return stages, err
}

func GetStudioStageByProjectAndKey(projectId int, key string) (*StudioStage, error) {
	var stage StudioStage
	err := DB.Where("project_id = ? AND `key` = ?", projectId, key).First(&stage).Error
	if err != nil {
		return nil, err
	}
	return &stage, nil
}

func UpdateStudioStage(stage *StudioStage) error {
	return DB.Model(stage).Select(
		"status", "total_items", "done_items", "output_data",
	).Updates(stage).Error
}

// ValidStageKey returns true if the key is one of the 7 default stage keys.
func ValidStageKey(key string) bool {
	for _, t := range defaultProjectStages {
		if t.Key == key {
			return true
		}
	}
	return false
}

// DefaultStageCount returns the number of auto-generated stages (currently 7).
func DefaultStageCount() int {
	return len(defaultProjectStages)
}
