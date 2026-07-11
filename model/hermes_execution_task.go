package model

import (
	"errors"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"gorm.io/gorm"
)

const (
	HermesExecutionTaskStatusQueued    = "queued"
	HermesExecutionTaskStatusRunning   = "running"
	HermesExecutionTaskStatusSucceeded = "succeeded"
	HermesExecutionTaskStatusFailed    = "failed"
	HermesExecutionTaskStatusCanceled  = "canceled"
)

type HermesExecutionTask struct {
	Id              int    `json:"-"`
	TaskId          string `json:"task_id" gorm:"type:varchar(64);uniqueIndex"`
	UserId          int    `json:"user_id" gorm:"index"`
	TeamId          int    `json:"team_id" gorm:"index"`
	WorkspaceMode   string `json:"workspace_mode" gorm:"type:varchar(64);index"`
	ConversationId  string `json:"conversation_id" gorm:"type:varchar(128);index"`
	StorageScope    string `json:"storage_scope" gorm:"type:varchar(255)"`
	HermesSessionId string `json:"hermes_session_id" gorm:"type:varchar(255)"`
	Title           string `json:"title" gorm:"type:varchar(255)"`
	Status          string `json:"status" gorm:"type:varchar(32);index"`
	Progress        int    `json:"progress"`
	RequestPayload  string `json:"-" gorm:"type:text"`
	ResponsePayload string `json:"-" gorm:"type:text"`
	Error           string `json:"error" gorm:"type:text"`
	CreatedAt       int64  `json:"created_at" gorm:"autoCreateTime;column:created_at"`
	UpdatedAt       int64  `json:"updated_at" gorm:"autoUpdateTime;column:updated_at"`
	StartedAt       int64  `json:"started_at"`
	FinishedAt      int64  `json:"finished_at"`
}

type HermesExecutionTaskResponse struct {
	TaskId          string `json:"task_id"`
	UserId          int    `json:"user_id"`
	TeamId          int    `json:"team_id"`
	WorkspaceMode   string `json:"workspace_mode"`
	ConversationId  string `json:"conversation_id"`
	StorageScope    string `json:"storage_scope"`
	HermesSessionId string `json:"hermes_session_id"`
	Title           string `json:"title"`
	Status          string `json:"status"`
	Progress        int    `json:"progress"`
	ResponsePayload any    `json:"response_payload,omitempty"`
	Error           string `json:"error,omitempty"`
	CreatedAt       int64  `json:"created_at"`
	UpdatedAt       int64  `json:"updated_at"`
	StartedAt       int64  `json:"started_at,omitempty"`
	FinishedAt      int64  `json:"finished_at,omitempty"`
}

func CreateHermesExecutionTask(task *HermesExecutionTask) error {
	if task == nil {
		return errors.New("task is required")
	}
	task.TaskId = strings.TrimSpace(task.TaskId)
	task.Title = strings.TrimSpace(task.Title)
	task.WorkspaceMode = strings.TrimSpace(task.WorkspaceMode)
	task.ConversationId = strings.TrimSpace(task.ConversationId)
	task.StorageScope = strings.TrimSpace(task.StorageScope)
	task.HermesSessionId = strings.TrimSpace(task.HermesSessionId)
	if task.TaskId == "" {
		return errors.New("task id is required")
	}
	if task.UserId <= 0 {
		return errors.New("user id is invalid")
	}
	if task.Status == "" {
		task.Status = HermesExecutionTaskStatusQueued
	}
	return DB.Create(task).Error
}

func GetHermesExecutionTaskByTaskID(taskID string) (*HermesExecutionTask, error) {
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil, errors.New("task id is required")
	}
	var task HermesExecutionTask
	err := DB.Where("task_id = ?", taskID).First(&task).Error
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	return &task, nil
}

func ListHermesExecutionTasks(userID int, teamID int, limit int) ([]HermesExecutionTask, error) {
	if userID <= 0 {
		return nil, errors.New("user id is invalid")
	}
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	query := DB.Model(&HermesExecutionTask{})
	if teamID > 0 {
		query = query.Where("team_id = ?", teamID)
	} else {
		query = query.Where("user_id = ? AND team_id = 0", userID)
	}

	var tasks []HermesExecutionTask
	err := query.Order("created_at desc").Limit(limit).Find(&tasks).Error
	return tasks, err
}

func UpdateHermesExecutionTaskStatus(taskID string, status string, progress int, errMsg string) error {
	updates := map[string]interface{}{
		"status":   strings.TrimSpace(status),
		"progress": progress,
		"error":    strings.TrimSpace(errMsg),
	}
	now := common.GetTimestamp()
	if status == HermesExecutionTaskStatusRunning {
		updates["started_at"] = now
	}
	if isHermesExecutionTaskTerminal(status) {
		updates["finished_at"] = now
	}
	return DB.Model(&HermesExecutionTask{}).
		Where("task_id = ?", strings.TrimSpace(taskID)).
		Updates(updates).Error
}

func CompleteHermesExecutionTask(taskID string, responsePayload string) error {
	now := common.GetTimestamp()
	return DB.Model(&HermesExecutionTask{}).
		Where("task_id = ?", strings.TrimSpace(taskID)).
		Updates(map[string]interface{}{
			"status":           HermesExecutionTaskStatusSucceeded,
			"progress":         100,
			"response_payload": responsePayload,
			"error":            "",
			"finished_at":      now,
		}).Error
}

func ToHermesExecutionTaskResponses(tasks []HermesExecutionTask, includePayload bool) []HermesExecutionTaskResponse {
	responses := make([]HermesExecutionTaskResponse, 0, len(tasks))
	for _, task := range tasks {
		responses = append(responses, task.ToResponse(includePayload))
	}
	return responses
}

func (task HermesExecutionTask) ToResponse(includePayload bool) HermesExecutionTaskResponse {
	response := HermesExecutionTaskResponse{
		TaskId:          task.TaskId,
		UserId:          task.UserId,
		TeamId:          task.TeamId,
		WorkspaceMode:   task.WorkspaceMode,
		ConversationId:  task.ConversationId,
		StorageScope:    task.StorageScope,
		HermesSessionId: task.HermesSessionId,
		Title:           task.Title,
		Status:          task.Status,
		Progress:        task.Progress,
		Error:           task.Error,
		CreatedAt:       task.CreatedAt,
		UpdatedAt:       task.UpdatedAt,
		StartedAt:       task.StartedAt,
		FinishedAt:      task.FinishedAt,
	}
	if includePayload && strings.TrimSpace(task.ResponsePayload) != "" {
		var payload any
		if err := common.UnmarshalJsonStr(task.ResponsePayload, &payload); err == nil {
			response.ResponsePayload = payload
		}
	}
	return response
}

func isHermesExecutionTaskTerminal(status string) bool {
	return status == HermesExecutionTaskStatusSucceeded ||
		status == HermesExecutionTaskStatusFailed ||
		status == HermesExecutionTaskStatusCanceled
}

func ListRecoverableHermesExecutionTasks(maxCount int) ([]HermesExecutionTask, error) {
	if maxCount <= 0 || maxCount > 200 {
		maxCount = 50
	}
	var tasks []HermesExecutionTask
	err := DB.Where("status IN ?", []string{
		HermesExecutionTaskStatusQueued,
		HermesExecutionTaskStatusRunning,
	}).Order("created_at asc").Limit(maxCount).Find(&tasks).Error
	return tasks, err
}
