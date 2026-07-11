package controller

import (
	"bytes"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strconv"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/BaizorAI/new-api/model"
	"github.com/BaizorAI/new-api/service"
	"github.com/gin-gonic/gin"
)

type hermesExecutionTaskCreateRequest struct {
	Title           string         `json:"title"`
	WorkspaceMode   string         `json:"workspace_mode"`
	ConversationId  string         `json:"conversation_id"`
	StorageScope    string         `json:"storage_scope"`
	HermesSessionId string         `json:"hermes_session_id"`
	TeamId          int            `json:"team_id"`
	Payload         map[string]any `json:"payload"`
}

type hermesExecutionTaskErrorPayload struct {
	Message string `json:"message"`
	Error   struct {
		Message string `json:"message"`
		Code    any    `json:"code"`
	} `json:"error"`
}

func CreateHermesGatewayExecutionTask(c *gin.Context) {
	if !validateHermesGatewayExecutionSecret(c) {
		return
	}
	userID, ok := getHermesGatewayExecutionUserID(c)
	if !ok {
		return
	}

	var request hermesExecutionTaskCreateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
		return
	}
	teamID, err := resolveHermesGatewayExecutionTeamID(c, request.TeamId, userID)
	if err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return
	}
	createHermesExecutionTask(c, userID, teamID, request)
}

func GetHermesGatewayExecutionTask(c *gin.Context) {
	if !validateHermesGatewayExecutionSecret(c) {
		return
	}
	userID, ok := getHermesGatewayExecutionUserID(c)
	if !ok {
		return
	}
	taskID := strings.TrimSpace(c.Param("task_id"))
	task, err := model.GetHermesExecutionTaskByTaskID(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": err.Error()})
		return
	}
	if task == nil {
		c.JSON(http.StatusNotFound, gin.H{"message": "task not found"})
		return
	}
	if task.UserId != userID {
		if task.TeamId <= 0 {
			c.JSON(http.StatusForbidden, gin.H{"message": "no permission to access this task"})
			return
		}
		if _, err := model.GetTeamByIdForUser(task.TeamId, userID); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"message": "no permission to access this task"})
			return
		}
	}
	c.JSON(http.StatusOK, task.ToResponse(true))
}

func CreateHermesExecutionTask(c *gin.Context) {
	var request hermesExecutionTaskCreateRequest
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
		return
	}
	userID := c.GetInt("id")
	teamID, err := resolveHermesExecutionTaskTeamID(c, request.TeamId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	createHermesExecutionTask(c, userID, teamID, request)
}

func createHermesExecutionTask(c *gin.Context, userID int, teamID int, request hermesExecutionTaskCreateRequest) {
	if request.Payload == nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "payload is required"})
		return
	}

	request.Payload["stream"] = false
	payloadBytes, err := common.Marshal(request.Payload)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	taskID := "hermes_" + strings.ReplaceAll(common.GetUUID(), "-", "")
	title := strings.TrimSpace(request.Title)
	if title == "" {
		title = deriveHermesExecutionTaskTitle(request.Payload)
	}
	if len(title) > 255 {
		title = title[:255]
	}

	task := &model.HermesExecutionTask{
		TaskId:          taskID,
		UserId:          userID,
		TeamId:          teamID,
		WorkspaceMode:   normalizeHermesExecutionWorkspaceMode(request.WorkspaceMode),
		ConversationId:  strings.TrimSpace(request.ConversationId),
		StorageScope:    strings.TrimSpace(request.StorageScope),
		HermesSessionId: strings.TrimSpace(request.HermesSessionId),
		Title:           title,
		Status:          model.HermesExecutionTaskStatusQueued,
		Progress:        0,
		RequestPayload:  string(payloadBytes),
	}
	if err := model.CreateHermesExecutionTask(task); err != nil {
		common.ApiError(c, err)
		return
	}

	go runHermesExecutionTask(task.TaskId)
	common.ApiSuccess(c, task.ToResponse(false))
}

func ListHermesExecutionTasks(c *gin.Context) {
	teamID, err := resolveHermesExecutionTaskTeamID(c, 0)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if rawTeamID := strings.TrimSpace(c.Query("team_id")); rawTeamID != "" {
		parsedTeamID, parseErr := strconv.Atoi(rawTeamID)
		if parseErr != nil || parsedTeamID < 0 {
			common.ApiErrorMsg(c, "invalid team id")
			return
		}
		teamID, err = resolveHermesExecutionTaskTeamID(c, parsedTeamID)
		if err != nil {
			common.ApiError(c, err)
			return
		}
	}
	limit, _ := strconv.Atoi(strings.TrimSpace(c.Query("limit")))
	tasks, err := model.ListHermesExecutionTasks(c.GetInt("id"), teamID, limit)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, model.ToHermesExecutionTaskResponses(tasks, false))
}

func GetHermesExecutionTask(c *gin.Context) {
	task, ok := getAccessibleHermesExecutionTask(c)
	if !ok {
		return
	}
	common.ApiSuccess(c, task.ToResponse(true))
}

func RetryHermesExecutionTask(c *gin.Context) {
	original, ok := getAccessibleHermesExecutionTask(c)
	if !ok {
		return
	}
	if original.RequestPayload == "" {
		common.ApiErrorMsg(c, "task payload is empty")
		return
	}

	task := &model.HermesExecutionTask{
		TaskId:          "hermes_" + strings.ReplaceAll(common.GetUUID(), "-", ""),
		UserId:          c.GetInt("id"),
		TeamId:          original.TeamId,
		WorkspaceMode:   original.WorkspaceMode,
		ConversationId:  original.ConversationId,
		StorageScope:    original.StorageScope,
		HermesSessionId: original.HermesSessionId,
		Title:           original.Title,
		Status:          model.HermesExecutionTaskStatusQueued,
		Progress:        0,
		RequestPayload:  original.RequestPayload,
	}
	if err := model.CreateHermesExecutionTask(task); err != nil {
		common.ApiError(c, err)
		return
	}
	go runHermesExecutionTask(task.TaskId)
	common.ApiSuccess(c, task.ToResponse(false))
}

func getAccessibleHermesExecutionTask(c *gin.Context) (*model.HermesExecutionTask, bool) {
	taskID := strings.TrimSpace(c.Param("task_id"))
	if taskID == "" {
		common.ApiErrorMsg(c, "task id is required")
		return nil, false
	}
	task, err := model.GetHermesExecutionTaskByTaskID(taskID)
	if err != nil {
		common.ApiError(c, err)
		return nil, false
	}
	if task == nil {
		c.JSON(http.StatusNotFound, gin.H{"success": false, "message": "task not found"})
		return nil, false
	}
	if task.TeamId > 0 {
		if _, err := model.GetTeamByIdForUser(task.TeamId, c.GetInt("id")); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "no permission to access this task"})
			return nil, false
		}
		return task, true
	}
	if task.UserId != c.GetInt("id") {
		c.JSON(http.StatusForbidden, gin.H{"success": false, "message": "no permission to access this task"})
		return nil, false
	}
	return task, true
}

func resolveHermesExecutionTaskTeamID(c *gin.Context, bodyTeamID int) (int, error) {
	teamID := bodyTeamID
	if headerTeamID := strings.TrimSpace(c.GetHeader("X-Baizor-Team-Id")); headerTeamID != "" {
		parsed, err := strconv.Atoi(headerTeamID)
		if err != nil || parsed < 0 {
			return 0, fmt.Errorf("invalid team id")
		}
		teamID = parsed
	}
	if teamID <= 0 {
		return 0, nil
	}
	if _, err := model.GetTeamByIdForUser(teamID, c.GetInt("id")); err != nil {
		return 0, fmt.Errorf("team is unavailable")
	}
	return teamID, nil
}

func validateHermesGatewayExecutionSecret(c *gin.Context) bool {
	secret := strings.TrimSpace(common.GetEnvOrDefaultString("HERMES_API_SERVER_KEY", ""))
	if secret == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "HERMES_API_SERVER_KEY is not configured"})
		return false
	}
	authorization := strings.TrimSpace(c.GetHeader("Authorization"))
	key := strings.TrimSpace(strings.TrimPrefix(authorization, "Bearer "))
	if key == authorization {
		key = strings.TrimSpace(strings.TrimPrefix(authorization, "bearer "))
	}
	if key == "" || key != secret {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "invalid gateway key"})
		return false
	}
	return true
}

func getHermesGatewayExecutionUserID(c *gin.Context) (int, bool) {
	rawUserID := strings.TrimSpace(c.GetHeader("X-Hermes-User-Id"))
	userID, err := strconv.Atoi(rawUserID)
	if err != nil || userID <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid X-Hermes-User-Id"})
		return 0, false
	}
	return userID, true
}

func resolveHermesGatewayExecutionTeamID(c *gin.Context, bodyTeamID int, userID int) (int, error) {
	teamID := bodyTeamID
	if headerTeamID := strings.TrimSpace(c.GetHeader("X-Hermes-Team-Id")); headerTeamID != "" {
		parsed, err := strconv.Atoi(headerTeamID)
		if err != nil || parsed < 0 {
			return 0, fmt.Errorf("invalid team id")
		}
		teamID = parsed
	}
	if teamID <= 0 {
		return 0, nil
	}
	if _, err := model.GetTeamByIdForUser(teamID, userID); err != nil {
		return 0, fmt.Errorf("team is unavailable")
	}
	return teamID, nil
}

func runHermesExecutionTask(taskID string) {
	if err := model.UpdateHermesExecutionTaskStatus(taskID, model.HermesExecutionTaskStatusRunning, 10, ""); err != nil {
		common.SysError("failed to mark hermes execution task running: " + err.Error())
		return
	}

	task, err := model.GetHermesExecutionTaskByTaskID(taskID)
	if err != nil || task == nil {
		if err != nil {
			common.SysError("failed to load hermes execution task: " + err.Error())
		}
		return
	}

	responseBody, statusCode, err := executeHermesCompletionTask(task)
	if err != nil {
		_ = model.UpdateHermesExecutionTaskStatus(taskID, model.HermesExecutionTaskStatusFailed, 100, err.Error())
		return
	}
	if statusCode < 200 || statusCode >= 300 {
		_ = model.UpdateHermesExecutionTaskStatus(taskID, model.HermesExecutionTaskStatusFailed, 100, extractHermesExecutionTaskError(responseBody, statusCode))
		return
	}
	if err := model.CompleteHermesExecutionTask(taskID, string(responseBody)); err != nil {
		common.SysError("failed to complete hermes execution task: " + err.Error())
		return
	}
	syncHermesResultsFromExecutionTask(task, responseBody)
}

func syncHermesResultsFromExecutionTask(task *model.HermesExecutionTask, responseBody []byte) {
	if task == nil || strings.TrimSpace(task.ConversationId) == "" {
		return
	}
	content := extractHermesExecutionTaskAssistantContent(responseBody)
	if strings.TrimSpace(content) == "" {
		return
	}
	messages := []any{
		map[string]any{
			"key":  task.TaskId,
			"from": "assistant",
			"versions": []any{
				map[string]any{
					"id":      task.TaskId,
					"content": content,
				},
			},
		},
	}
	if err := service.UpsertHermesResultsFromConversation(service.HermesResultConversationInput{
		UserId:          task.UserId,
		TeamId:          task.TeamId,
		ConversationId:  task.ConversationId,
		StorageScope:    task.StorageScope,
		HermesSessionId: task.HermesSessionId,
		Title:           task.Title,
		Messages:        messages,
		UpdatedBy:       task.UserId,
	}); err != nil {
		common.SysError("failed to sync hermes execution task results: " + err.Error())
	}
}

func extractHermesExecutionTaskAssistantContent(body []byte) string {
	payload := map[string]any{}
	if err := common.Unmarshal(body, &payload); err != nil {
		return ""
	}
	choices, ok := payload["choices"].([]any)
	if !ok || len(choices) == 0 {
		return ""
	}
	choice, ok := choices[0].(map[string]any)
	if !ok {
		return ""
	}
	message, ok := choice["message"].(map[string]any)
	if !ok {
		return ""
	}
	content, ok := message["content"].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(content)
}
func executeHermesCompletionTask(task *model.HermesExecutionTask) ([]byte, int, error) {
	payload := map[string]any{}
	if err := common.UnmarshalJsonStr(task.RequestPayload, &payload); err != nil {
		return nil, http.StatusBadRequest, err
	}
	payload["stream"] = false
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	request := httptest.NewRequest(http.MethodPost, "/pg/chat/completions", bytes.NewReader(payloadBytes))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("New-Api-User", strconv.Itoa(task.UserId))
	request.Header.Set("X-Baizor-Playground", "hermes")
	if task.HermesSessionId != "" {
		request.Header.Set("X-Baizor-Hermes-Session", task.HermesSessionId)
	}
	if task.WorkspaceMode != "" {
		request.Header.Set("X-Baizor-Hermes-Workspace", task.WorkspaceMode)
	}
	if task.TeamId > 0 {
		request.Header.Set("X-Baizor-Team-Id", strconv.Itoa(task.TeamId))
		if team, err := model.GetTeamById(task.TeamId); err == nil && strings.TrimSpace(team.Name) != "" {
			request.Header.Set("X-Baizor-Team-Name", team.Name)
		}
	}

	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = request
	c.Set(common.RequestIdKey, task.TaskId)
	c.Set("id", task.UserId)
	c.Set("use_access_token", false)

	userCache, err := model.GetUserCache(task.UserId)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}
	c.Set("username", userCache.Username)
	c.Set("role", userCache.Role)
	c.Set("group", userCache.Group)
	c.Set("user_group", userCache.Group)
	userCache.WriteContext(c)
	common.SetContextKey(c, constant.ContextKeyUsingGroup, userCache.Group)

	middleware.Distribute()(c)
	if c.IsAborted() {
		common.CleanupBodyStorage(c)
		return response.Body.Bytes(), response.Code, nil
	}
	_ = model.UpdateHermesExecutionTaskStatus(task.TaskId, model.HermesExecutionTaskStatusRunning, 35, "")
	Playground(c)
	common.CleanupBodyStorage(c)
	return response.Body.Bytes(), response.Code, nil
}

func normalizeHermesExecutionWorkspaceMode(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch value {
	case "team", "team_workspace":
		return "team_workspace"
	case "one_person_company":
		return "one_person_company"
	case "weixin", "wechat":
		return "weixin"
	default:
		return "personal"
	}
}

// RecoverHermesExecutionTasks re-fires goroutines for tasks left in
// queued / running state after a restart.  Call once after the
// database and HTTP router are initialised.
func RecoverHermesExecutionTasks() {
	if model.DB == nil {
		return
	}
	tasks, err := model.ListRecoverableHermesExecutionTasks(50)
	if err != nil {
		common.SysError("failed to list recoverable hermes execution tasks: " + err.Error())
		return
	}
	if len(tasks) == 0 {
		common.SysLog("no recoverable hermes execution tasks found")
		return
	}
	common.SysLog(fmt.Sprintf("recovering %d hermes execution tasks", len(tasks)))
	for _, task := range tasks {
		switch task.Status {
		case model.HermesExecutionTaskStatusQueued:
			go runHermesExecutionTask(task.TaskId)
		case model.HermesExecutionTaskStatusRunning:
			// Already running when we crashed — restart from scratch.
			_ = model.UpdateHermesExecutionTaskStatus(
				task.TaskId,
				model.HermesExecutionTaskStatusQueued,
				0,
				"restarted after server recovery",
			)
			go runHermesExecutionTask(task.TaskId)
		}
	}
}

func deriveHermesExecutionTaskTitle(payload map[string]any) string {
	messages, ok := payload["messages"].([]any)
	if !ok {
		return "Hermes task"
	}
	for index := len(messages) - 1; index >= 0; index-- {
		message, ok := messages[index].(map[string]any)
		if !ok || message["role"] != "user" {
			continue
		}
		content := hermesExecutionContentText(message["content"])
		if content != "" {
			return content
		}
	}
	return "Hermes task"
}

func hermesExecutionContentText(value any) string {
	switch content := value.(type) {
	case string:
		return strings.TrimSpace(content)
	case []any:
		parts := make([]string, 0, len(content))
		for _, item := range content {
			part, ok := item.(map[string]any)
			if !ok || part["type"] != "text" {
				continue
			}
			if text, ok := part["text"].(string); ok && strings.TrimSpace(text) != "" {
				parts = append(parts, strings.TrimSpace(text))
			}
		}
		return strings.Join(parts, " ")
	default:
		return ""
	}
}

func extractHermesExecutionTaskError(body []byte, statusCode int) string {
	var payload hermesExecutionTaskErrorPayload
	if err := common.Unmarshal(body, &payload); err == nil {
		if strings.TrimSpace(payload.Error.Message) != "" {
			return strings.TrimSpace(payload.Error.Message)
		}
		if strings.TrimSpace(payload.Message) != "" {
			return strings.TrimSpace(payload.Message)
		}
	}
	bodyText := strings.TrimSpace(string(body))
	if bodyText != "" && len(bodyText) <= 500 {
		return bodyText
	}
	return fmt.Sprintf("Hermes task failed with HTTP %d", statusCode)
}
