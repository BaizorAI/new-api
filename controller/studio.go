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
	"github.com/gin-gonic/gin"
)

// ── Request / Response DTOs ───────────────────────────────────────

type studioProjectBody struct {
	Name     string `json:"name"`
	Brief    string `json:"brief"`
	Genre    string `json:"genre"`
	Status   int    `json:"status"`
	StyleDNA string `json:"style_dna"`
	CoverURL string `json:"cover_url"`
}

type studioProjectView struct {
	Id        int    `json:"id"`
	UserId    int    `json:"user_id"`
	TeamId    int    `json:"team_id"`
	Name      string `json:"name"`
	Brief     string `json:"brief"`
	Genre     string `json:"genre"`
	Status    int    `json:"status"`
	StyleDNA  string `json:"style_dna"`
	CoverURL  string `json:"cover_url"`
	CreatedAt int64  `json:"created_at"`
	UpdatedAt int64  `json:"updated_at"`

	// Populated when listing projects — quick summary.
	StageTotal int `json:"stage_total,omitempty"`
	StageDone  int `json:"stage_done,omitempty"`
}

func projectToView(p *model.StudioProject) studioProjectView {
	return studioProjectView{
		Id:        p.Id,
		UserId:    p.UserId,
		TeamId:    p.TeamId,
		Name:      p.Name,
		Brief:     p.Brief,
		Genre:     p.Genre,
		Status:    p.Status,
		StyleDNA:  p.StyleDNA,
		CoverURL:  p.CoverURL,
		CreatedAt: p.CreatedAt,
		UpdatedAt: p.UpdatedAt,
	}
}

type studioStageBody struct {
	Status     *int   `json:"status"`
	TotalItems *int   `json:"total_items"`
	DoneItems  *int   `json:"done_items"`
	OutputData string `json:"output_data"`
}

type studioShotBody struct {
	SceneNumber  int    `json:"scene_number"`
	ShotNumber   int    `json:"shot_number"`
	Description  string `json:"description"`
	CameraAngle  string `json:"camera_angle"`
	CameraMove   string `json:"camera_move"`
	Duration     int    `json:"duration"`
	ImagePrompt  string `json:"image_prompt"`
	ImageURL     string `json:"image_url"`
	VideoPrompt  string `json:"video_prompt"`
	VideoURL     string `json:"video_url"`
	VideoTaskId  string `json:"video_task_id"`
	Status       *int   `json:"status"`
	CharacterIds string `json:"character_ids"`
	SortOrder    int    `json:"sort_order"`
}

type studioBatchShotsBody struct {
	Shots []studioShotBody `json:"shots"`
}

type studioCharacterBody struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	VisualPrompt string `json:"visual_prompt"`
	ReferenceURL string `json:"reference_url"`
	LoraParams   string `json:"lora_params"`
}

// ── Helper: extract project id and verify ownership ───────────────

func studioProjectFromParam(c *gin.Context) (*model.StudioProject, bool) {
	id, err := strconv.Atoi(c.Param("id"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid project id")
		return nil, false
	}
	userId := c.GetInt("id")
	project, err := model.GetStudioProjectById(id, userId)
	if err != nil {
		common.ApiErrorMsg(c, "project not found")
		return nil, false
	}
	return project, true
}

// ── Projects ──────────────────────────────────────────────────────

// ListStudioProjects GET /api/studio/projects
func ListStudioProjects(c *gin.Context) {
	userId := c.GetInt("id")
	status := 0
	if s := c.Query("status"); s != "" {
		if v, err := strconv.Atoi(s); err == nil {
			status = v
		}
	}

	pageInfo := common.GetPageQuery(c)
	projects, total, err := model.GetAllStudioProjects(userId, status, pageInfo.GetStartIdx(), pageInfo.GetPageSize())
	if err != nil {
		common.ApiError(c, err)
		return
	}

	views := make([]studioProjectView, len(projects))
	for i, p := range projects {
		views[i] = projectToView(p)
		stageTotal, stageDone, _ := model.CountStudioProjectStagesDone(p.Id)
		views[i].StageTotal = stageTotal
		views[i].StageDone = stageDone
	}

	pageInfo.SetTotal(int(total))
	pageInfo.SetItems(views)
	common.ApiSuccess(c, pageInfo)
}

// CreateStudioProject POST /api/studio/projects
// Also auto-generates 7 default pipeline stages.
func CreateStudioProject(c *gin.Context) {
	var body studioProjectBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" {
		common.ApiErrorMsg(c, "project name is required")
		return
	}
	if body.Genre != "" && !model.ValidStudioProjectGenre(body.Genre) {
		common.ApiErrorMsg(c, "invalid genre")
		return
	}

	project := &model.StudioProject{
		UserId:   c.GetInt("id"),
		Name:     body.Name,
		Brief:    body.Brief,
		Genre:    body.Genre,
		Status:   model.StudioProjectStatusDraft,
		StyleDNA: body.StyleDNA,
		CoverURL: body.CoverURL,
	}

	if err := model.CreateStudioProjectWithStages(project); err != nil {
		common.ApiError(c, err)
		return
	}

	result, err := model.GetStudioProjectWithStages(project.Id, project.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

// GetStudioProject GET /api/studio/projects/:id
func GetStudioProject(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	result, err := model.GetStudioProjectWithStages(project.Id, project.UserId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, result)
}

// UpdateStudioProject PUT /api/studio/projects/:id
func UpdateStudioProject(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	var body studioProjectBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	if body.Name != "" {
		project.Name = strings.TrimSpace(body.Name)
	}
	if body.Brief != "" {
		project.Brief = body.Brief
	}
	if body.Genre != "" {
		if !model.ValidStudioProjectGenre(body.Genre) {
			common.ApiErrorMsg(c, "invalid genre")
			return
		}
		project.Genre = body.Genre
	}
	if body.Status > 0 {
		project.Status = body.Status
	}
	if body.StyleDNA != "" {
		project.StyleDNA = body.StyleDNA
	}
	if body.CoverURL != "" {
		project.CoverURL = body.CoverURL
	}

	if err := project.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, projectToView(project))
}

// DeleteStudioProject DELETE /api/studio/projects/:id
func DeleteStudioProject(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	if err := model.DeleteStudioProjectCascade(project.Id); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ── Stages ────────────────────────────────────────────────────────

// ListStudioStages GET /api/studio/projects/:id/stages
func ListStudioStages(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	stages, err := model.GetStudioStagesByProjectId(project.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stages)
}

// UpdateStudioStage PUT /api/studio/projects/:id/stages/:key
func UpdateStudioStage(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	key := c.Param("key")
	if !model.ValidStageKey(key) {
		common.ApiErrorMsg(c, "invalid stage key")
		return
	}
	stage, err := model.GetStudioStageByProjectAndKey(project.Id, key)
	if err != nil {
		common.ApiErrorMsg(c, "stage not found")
		return
	}

	var body studioStageBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	if body.Status != nil {
		stage.Status = *body.Status
	}
	if body.TotalItems != nil {
		stage.TotalItems = *body.TotalItems
	}
	if body.DoneItems != nil {
		stage.DoneItems = *body.DoneItems
	}
	if body.OutputData != "" {
		stage.OutputData = body.OutputData
		// Auto-transition: if the user has started writing content, move from
		// Not Started → In Progress automatically.
		if stage.Status == model.StageStatusNotStarted {
			stage.Status = model.StageStatusInProgress
		}
	}

	if err := model.UpdateStudioStage(stage); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, stage)
}

// ── Shots ─────────────────────────────────────────────────────────

// ListStudioShots GET /api/studio/projects/:id/shots
func ListStudioShots(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	shots, err := model.GetStudioShotsByProjectId(project.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, shots)
}

// CreateStudioShots POST /api/studio/projects/:id/shots
// Accepts a batch via {"shots": [...]}.
func CreateStudioShots(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}

	var batch studioBatchShotsBody
	if err := c.ShouldBindJSON(&batch); err != nil || len(batch.Shots) == 0 {
		common.ApiErrorMsg(c, "invalid request body: expected {\"shots\": [...]}")
		return
	}
	shots := make([]model.StudioShot, len(batch.Shots))
	for i, s := range batch.Shots {
		shots[i] = shotFromBody(project.Id, &s)
	}
	if err := model.BatchCreateStudioShots(shots); err != nil {
		common.ApiError(c, err)
		return
	}
	syncShotStageStats(project.Id)
	common.ApiSuccess(c, shots)
}

// UpdateStudioShot PUT /api/studio/projects/:id/shots/:shotId
func UpdateStudioShot(c *gin.Context) {
	_, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	shotId, err := strconv.Atoi(c.Param("shotId"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid shot id")
		return
	}
	shot, err := model.GetStudioShotById(shotId)
	if err != nil {
		common.ApiErrorMsg(c, "shot not found")
		return
	}

	var body studioShotBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	applyShotBody(shot, &body)
	if err := shot.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	syncShotStageStats(shot.ProjectId)
	common.ApiSuccess(c, shot)
}

// DeleteStudioShot DELETE /api/studio/projects/:id/shots/:shotId
func DeleteStudioShot(c *gin.Context) {
	_, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	shotId, err := strconv.Atoi(c.Param("shotId"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid shot id")
		return
	}
	shot, err := model.GetStudioShotById(shotId)
	if err != nil {
		common.ApiErrorMsg(c, "shot not found")
		return
	}
	if err := shot.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	syncShotStageStats(shot.ProjectId)
	common.ApiSuccess(c, nil)
}

// ── Characters ────────────────────────────────────────────────────

// ListStudioCharacters GET /api/studio/projects/:id/characters
func ListStudioCharacters(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	chars, err := model.GetStudioCharactersByProjectId(project.Id)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, chars)
}

// CreateStudioCharacter POST /api/studio/projects/:id/characters
func CreateStudioCharacter(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	var body studioCharacterBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	if body.Name == "" {
		common.ApiErrorMsg(c, "character name is required")
		return
	}
	char := &model.StudioCharacter{
		ProjectId:    project.Id,
		Name:         body.Name,
		Description:  body.Description,
		VisualPrompt: body.VisualPrompt,
		ReferenceURL: body.ReferenceURL,
		LoraParams:   body.LoraParams,
	}
	if err := char.Insert(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, char)
}

// UpdateStudioCharacter PUT /api/studio/projects/:id/characters/:charId
func UpdateStudioCharacter(c *gin.Context) {
	_, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	charId, err := strconv.Atoi(c.Param("charId"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid character id")
		return
	}
	char, err := model.GetStudioCharacterById(charId)
	if err != nil {
		common.ApiErrorMsg(c, "character not found")
		return
	}

	var body studioCharacterBody
	if err := c.ShouldBindJSON(&body); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	if body.Name != "" {
		char.Name = strings.TrimSpace(body.Name)
	}
	if body.Description != "" {
		char.Description = body.Description
	}
	if body.VisualPrompt != "" {
		char.VisualPrompt = body.VisualPrompt
	}
	if body.ReferenceURL != "" {
		char.ReferenceURL = body.ReferenceURL
	}
	if body.LoraParams != "" {
		char.LoraParams = body.LoraParams
	}

	if err := char.Update(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, char)
}

// DeleteStudioCharacter DELETE /api/studio/projects/:id/characters/:charId
func DeleteStudioCharacter(c *gin.Context) {
	_, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	charId, err := strconv.Atoi(c.Param("charId"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid character id")
		return
	}
	char, err := model.GetStudioCharacterById(charId)
	if err != nil {
		common.ApiErrorMsg(c, "character not found")
		return
	}
	if err := char.Delete(); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ── Internal helpers ──────────────────────────────────────────────

func shotFromBody(projectId int, b *studioShotBody) model.StudioShot {
	s := model.StudioShot{
		ProjectId:    projectId,
		SceneNumber:  b.SceneNumber,
		ShotNumber:   b.ShotNumber,
		Description:  b.Description,
		CameraAngle:  b.CameraAngle,
		CameraMove:   b.CameraMove,
		Duration:     b.Duration,
		ImagePrompt:  b.ImagePrompt,
		ImageURL:     b.ImageURL,
		VideoPrompt:  b.VideoPrompt,
		VideoURL:     b.VideoURL,
		VideoTaskId:  b.VideoTaskId,
		CharacterIds: b.CharacterIds,
		SortOrder:    b.SortOrder,
	}
	if b.Status != nil {
		s.Status = *b.Status
	}
	return s
}

func applyShotBody(shot *model.StudioShot, b *studioShotBody) {
	if b.SceneNumber > 0 {
		shot.SceneNumber = b.SceneNumber
	}
	if b.ShotNumber > 0 {
		shot.ShotNumber = b.ShotNumber
	}
	if b.Description != "" {
		shot.Description = b.Description
	}
	if b.CameraAngle != "" {
		shot.CameraAngle = b.CameraAngle
	}
	if b.CameraMove != "" {
		shot.CameraMove = b.CameraMove
	}
	if b.Duration > 0 {
		shot.Duration = b.Duration
	}
	if b.ImagePrompt != "" {
		shot.ImagePrompt = b.ImagePrompt
	}
	if b.ImageURL != "" {
		shot.ImageURL = b.ImageURL
	}
	if b.VideoPrompt != "" {
		shot.VideoPrompt = b.VideoPrompt
	}
	if b.VideoURL != "" {
		shot.VideoURL = b.VideoURL
	}
	if b.VideoTaskId != "" {
		shot.VideoTaskId = b.VideoTaskId
	}
	if b.Status != nil {
		shot.Status = *b.Status
	}
	if b.CharacterIds != "" {
		shot.CharacterIds = b.CharacterIds
	}
	if b.SortOrder > 0 {
		shot.SortOrder = b.SortOrder
	}
}

// syncShotStageStats recalculates total_items and done_items for the
// storyboard, image_gen, and video_gen stages based on current shot data.
// It runs asynchronously so it never blocks the response.
func syncShotStageStats(projectId int) {
	go func() {
		imgTotal, imgDone, err := model.CountStudioShotsByImageStatus(projectId)
		if err != nil {
			common.SysError("syncShotStageStats: image count error: " + err.Error())
			return
		}
		vidTotal, vidDone, err := model.CountStudioShotsByVideoStatus(projectId)
		if err != nil {
			common.SysError("syncShotStageStats: video count error: " + err.Error())
			return
		}

		for _, spec := range []struct {
			key   string
			total int
			done  int
		}{
			{"storyboard", imgTotal, 0},
			{"image_gen", imgTotal, imgDone},
			{"video_gen", vidTotal, vidDone},
		} {
			stage, err := model.GetStudioStageByProjectAndKey(projectId, spec.key)
			if err != nil {
				continue
			}
			stage.TotalItems = spec.total
			stage.DoneItems = spec.done
			if err := model.UpdateStudioStage(stage); err != nil {
				common.SysError("syncShotStageStats: update " + spec.key + " error: " + err.Error())
			}
		}
	}()
}

// ── Quick Generate ───────────────────────────────────────────────

type studioQuickGenRequest struct {
	Type     string `json:"type"`      // "image" | "analyze" | "describe"
	Prompt   string `json:"prompt"`
	StageKey string `json:"stage_key"` // which stage this belongs to
	ShotId   int    `json:"shot_id"`   // optional: link result to a shot
	Model    string `json:"model"`
	Size     string `json:"size"`
}

type studioQuickGenResponse struct {
	Type     string `json:"type"`
	RecordId int    `json:"record_id,omitempty"` // image playground history id (for polling)
	ImageURL string `json:"image_url,omitempty"` // set on sync image responses
	Text     string `json:"text,omitempty"`      // set on analyze/describe responses
	ShotId   int    `json:"shot_id,omitempty"`
}

// StudioQuickGenerate POST /api/studio/projects/:id/quick-generate
// Dispatches a generation request based on type:
//   - "image"    → creates an ImagePlaygroundHistory record and generates asynchronously
//   - "analyze"  → calls chat completion synchronously and returns structured JSON
//   - "describe" → calls chat completion synchronously and returns description text
func StudioQuickGenerate(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}

	var req studioQuickGenRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	if req.Prompt == "" {
		common.ApiErrorMsg(c, "prompt is required")
		return
	}
	if req.Type == "" {
		req.Type = "image"
	}
	if req.Model == "" {
		req.Model = "huayu-drama-4"
	}

	userId := c.GetInt("id")

	switch req.Type {
	case "image":
		if req.Size == "" {
			req.Size = "1024x1024"
		}
		record := &model.ImagePlaygroundHistory{
			UserId:  userId,
			Prompt:  req.Prompt,
			Model:   req.Model,
			Size:    req.Size,
			Quality: "standard",
			Group:   "default",
			Status:  model.ImagePlaygroundStatusPending,
		}
		if err := model.CreateImagePlaygroundHistory(record); err != nil {
			common.ApiError(c, err)
			return
		}

		// Launch generation in background; on completion, also write back to the shot
		shotId := req.ShotId
		projectId := project.Id
		recordId := record.Id
		go func() {
			runImagePlaygroundGeneration(recordId)
			if shotId > 0 {
				studioWritebackImageToShot(recordId, projectId, shotId)
			}
		}()

		common.ApiSuccess(c, studioQuickGenResponse{
			Type:     "image",
			RecordId: record.Id,
			ShotId:   shotId,
		})

	case "analyze", "describe":
		// Build a chat completion request via relay
		systemPrompt := studioQuickGenSystemPrompt(req.Type, req.StageKey)
		payload := map[string]any{
			"model": req.Model,
			"messages": []map[string]string{
				{"role": "system", "content": systemPrompt},
				{"role": "user", "content": req.Prompt},
			},
			"stream":      false,
			"temperature": 0.3,
		}

		responseBody, statusCode, err := executeStudioChatCompletion(userId, payload)
		if err != nil {
			common.ApiErrorMsg(c, "generation failed: "+err.Error())
			return
		}
		if statusCode < 200 || statusCode >= 300 {
			errMsg := extractImagePlaygroundError(responseBody, statusCode)
			common.ApiErrorMsg(c, "generation failed: "+errMsg)
			return
		}

		// Extract the assistant message content from the response
		text := extractChatCompletionContent(responseBody)

		common.ApiSuccess(c, studioQuickGenResponse{
			Type:   req.Type,
			Text:   text,
			ShotId: req.ShotId,
		})

	default:
		common.ApiErrorMsg(c, "unsupported type: "+req.Type)
	}
}

// studioWritebackImageToShot reads the completed image record and writes
// image_url back to the specified shot. Called from a goroutine after generation.
func studioWritebackImageToShot(recordId, projectId, shotId int) {
	record, err := model.GetImagePlaygroundHistoryById(recordId)
	if err != nil || record == nil || record.Status != model.ImagePlaygroundStatusCompleted {
		return
	}
	if record.ImageURL == "" {
		return
	}
	shot, err := model.GetStudioShotById(shotId)
	if err != nil || shot.ProjectId != projectId {
		return
	}
	shot.ImageURL = record.ImageURL
	shot.Status = model.ShotStatusCompleted
	if err := shot.Update(); err != nil {
		common.SysError("studio quick-gen: writeback image to shot error: " + err.Error())
	}
	syncShotStageStats(projectId)
}

// ── Shot Generate ────────────────────────────────────────────────

type studioShotGenRequest struct {
	Type  string `json:"type"`  // "image" or "video" (default "image")
	Model string `json:"model"` // override model (default "huayu-drama-4")
	Size  string `json:"size"`  // override size (default "1024x1024")
}

// StudioShotGenerate POST /api/studio/projects/:id/shots/:shotId/generate
// Generates an image (or video) for a specific shot. The prompt is derived
// from the shot's image_prompt or description, combined with the project's
// style_dna. Returns the generation record ID for polling.
func StudioShotGenerate(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	shotId, err := strconv.Atoi(c.Param("shotId"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid shot id")
		return
	}
	shot, err := model.GetStudioShotById(shotId)
	if err != nil {
		common.ApiErrorMsg(c, "shot not found")
		return
	}
	if shot.ProjectId != project.Id {
		common.ApiErrorMsg(c, "shot does not belong to this project")
		return
	}

	var req studioShotGenRequest
	// Body is optional — we can derive everything from the shot
	_ = c.ShouldBindJSON(&req)
	if req.Type == "" {
		req.Type = "image"
	}
	if req.Model == "" {
		req.Model = "huayu-drama-4"
	}
	if req.Size == "" {
		req.Size = "1024x1024"
	}

	// Build prompt from shot
	prompt := shot.ImagePrompt
	if prompt == "" {
		prompt = shot.Description
	}
	if prompt == "" {
		common.ApiErrorMsg(c, "shot has no image prompt or description")
		return
	}
	if project.StyleDNA != "" {
		prompt = prompt + ". Style: " + project.StyleDNA
	}

	userId := c.GetInt("id")

	switch req.Type {
	case "image":
		record := &model.ImagePlaygroundHistory{
			UserId:  userId,
			Prompt:  prompt,
			Model:   req.Model,
			Size:    req.Size,
			Quality: "standard",
			Group:   "default",
			Status:  model.ImagePlaygroundStatusPending,
		}
		if err := model.CreateImagePlaygroundHistory(record); err != nil {
			common.ApiError(c, err)
			return
		}

		// Mark shot as generating
		shot.Status = model.ShotStatusGenerating
		_ = shot.Update()

		projectId := project.Id
		sid := shot.Id
		recordId := record.Id
		go func() {
			runImagePlaygroundGeneration(recordId)
			studioWritebackImageToShot(recordId, projectId, sid)
		}()

		common.ApiSuccess(c, gin.H{
			"type":      "image",
			"record_id": record.Id,
			"shot_id":   shot.Id,
		})

	case "video":
		videoPrompt := shot.VideoPrompt
		if videoPrompt == "" {
			videoPrompt = prompt
		}

		vRecord := &model.VideoPlaygroundHistory{
			UserId:  userId,
			Prompt:  videoPrompt,
			Model:   req.Model,
			Size:    "512x768",
			Group:   "default",
			Status:  model.VideoPlaygroundStatusPending,
		}
		if err := model.CreateVideoPlaygroundHistory(vRecord); err != nil {
			common.ApiError(c, err)
			return
		}

		// Mark shot as generating
		shot.Status = model.ShotStatusGenerating
		shot.VideoTaskId = strconv.Itoa(vRecord.Id)
		_ = shot.Update()

		projectId := project.Id
		sid := shot.Id
		vRecordId := vRecord.Id
		go func() {
			runVideoPlaygroundGeneration(vRecordId)
			studioWritebackVideoToShot(vRecordId, projectId, sid)
		}()

		common.ApiSuccess(c, gin.H{
			"type":      "video",
			"record_id": vRecord.Id,
			"shot_id":   shot.Id,
		})

	default:
		common.ApiErrorMsg(c, "unsupported generation type: "+req.Type)
	}
}

// studioWritebackVideoToShot reads the completed video record and writes
// video_url back to the specified shot.
func studioWritebackVideoToShot(recordId, projectId, shotId int) {
	record, err := model.GetVideoPlaygroundHistoryById(recordId)
	if err != nil || record == nil {
		return
	}
	shot, err := model.GetStudioShotById(shotId)
	if err != nil || shot.ProjectId != projectId {
		return
	}
	if record.Status == model.VideoPlaygroundStatusCompleted && record.VideoURL != "" {
		shot.VideoURL = record.VideoURL
		shot.Status = model.ShotStatusCompleted
	} else {
		shot.Status = model.ShotStatusFailed
	}
	if err := shot.Update(); err != nil {
		common.SysError("studio shot-gen: writeback video to shot error: " + err.Error())
	}
	syncShotStageStats(projectId)
}

// ── Chat Completion Relay Helpers ─────────────────────────────────

// executeStudioChatCompletion builds a synthetic request to the playground
// chat completion relay, following the same pattern as executeHermesCompletionTask.
func executeStudioChatCompletion(userId int, payload map[string]any) ([]byte, int, error) {
	payload["stream"] = false
	payloadBytes, err := common.Marshal(payload)
	if err != nil {
		return nil, http.StatusInternalServerError, err
	}

	request := httptest.NewRequest(http.MethodPost, "/pg/chat/completions", bytes.NewReader(payloadBytes))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("New-Api-User", strconv.Itoa(userId))
	request.Header.Set("X-Baizor-Playground", "hermes")

	response := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(response)
	c.Request = request

	c.Set(middleware.PlaygroundContextKey, true)
	c.Set("id", userId)
	c.Set("use_access_token", false)

	userCache, err := model.GetUserCache(userId)
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

	Playground(c)
	common.CleanupBodyStorage(c)
	return response.Body.Bytes(), response.Code, nil
}

// extractChatCompletionContent extracts the assistant message text from
// an OpenAI-format chat completion response.
func extractChatCompletionContent(body []byte) string {
	var resp struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
		} `json:"choices"`
	}
	if err := common.Unmarshal(body, &resp); err == nil && len(resp.Choices) > 0 {
		return resp.Choices[0].Message.Content
	}
	return ""
}

// studioQuickGenSystemPrompt returns the system prompt for analyze/describe
// operations, tailored to the stage context.
func studioQuickGenSystemPrompt(genType, stageKey string) string {
	switch genType {
	case "analyze":
		switch stageKey {
		case "script":
			return `You are a professional screenplay analyst. Analyze the given screenplay and output a structured JSON object with the following fields:
- "scenes": array of {scene_number, location, time_of_day, description, characters}
- "characters": array of {name, description, appearances}
- "estimated_duration_minutes": number
- "genre_suggestions": array of strings
- "quality_notes": array of improvement suggestions
Output ONLY valid JSON, no other text.`
		case "storyboard":
			return `You are a storyboard analyst. Analyze the given shot list and provide a structured JSON critique:
- "coverage_gaps": scenes or actions not covered by shots
- "pacing_analysis": assessment of shot durations and rhythm
- "visual_variety": assessment of camera angle and movement diversity
- "improvement_suggestions": array of specific recommendations
Output ONLY valid JSON, no other text.`
		default:
			return `You are a creative production analyst. Analyze the given content and provide structured JSON feedback with "strengths", "weaknesses", and "suggestions" arrays. Output ONLY valid JSON, no other text.`
		}
	case "describe":
		return `You are a visual description specialist for film production. Given the scene or shot description, write a detailed visual prompt suitable for AI image generation. Include:
- Setting and environment details
- Lighting and atmosphere
- Character positions and expressions
- Camera perspective
- Color palette and mood
Write a single detailed paragraph, no JSON or formatting.`
	default:
		return "You are a helpful assistant for film production."
	}
}

// ── Agent Create ─────────────────────────────────────────────────

type studioAgentCreateRequest struct {
	Skill    string `json:"skill"`     // e.g. "script-analyzer", "character-designer"
	StageKey string `json:"stage_key"` // which stage
	Context  string `json:"context"`   // optional additional context
	Model    string `json:"model"`     // override model
}

// StudioAgentCreate POST /api/studio/projects/:id/agent-create
// Creates a HermesExecutionTask that activates a MagicalBrush skill.
// Returns the task_id for polling.
func StudioAgentCreate(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}

	var req studioAgentCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	if req.Skill == "" {
		common.ApiErrorMsg(c, "skill is required")
		return
	}
	if req.StageKey == "" {
		req.StageKey = "script"
	}
	if req.Model == "" {
		req.Model = "huayu-v2"
	}

	userId := c.GetInt("id")

	// Build the system prompt based on the skill
	systemPrompt := studioSkillSystemPrompt(req.Skill)
	userMessage := req.Context
	if userMessage == "" {
		userMessage = fmt.Sprintf("Execute the %s skill for project '%s', stage '%s'.", req.Skill, project.Name, req.StageKey)
	}

	// Build the Hermes execution task request
	payload := map[string]any{
		"model": req.Model,
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": userMessage},
		},
		"stream":      false,
		"temperature": 0.4,
	}

	taskRequest := hermesExecutionTaskCreateRequest{
		Title:         fmt.Sprintf("Studio: %s — %s", req.Skill, project.Name),
		WorkspaceMode: fmt.Sprintf("studio_project_%d_stage_%s", project.Id, req.StageKey),
		StorageScope:  fmt.Sprintf("studio_project_%d_stage_%s", project.Id, req.StageKey),
		Payload:       payload,
	}

	createHermesExecutionTask(c, userId, 0, taskRequest)
}

// studioSkillSystemPrompt returns the system prompt for a MagicalBrush skill.
func studioSkillSystemPrompt(skill string) string {
	switch skill {
	case "script-analyzer":
		return `You are a professional screenplay analyst AI. Your task is to analyze screenplays and scripts. You can:
1. Extract structured scene breakdowns (scene number, location, time, characters, action)
2. Identify all characters with descriptions
3. Suggest improvements for pacing, dialogue, and structure
4. Estimate production duration
Output your analysis in clear, structured format.`
	case "character-designer":
		return `You are a character design AI for film production. Your task is to:
1. Design detailed character profiles from script descriptions
2. Generate visual prompts for AI image generation of character reference images
3. Ensure visual consistency across characters (style, art direction)
4. Define character relationships and visual cues
Output character cards with name, description, visual_prompt, and suggested reference style.`
	case "shot-planner":
		return `You are a professional cinematographer and storyboard artist AI. Your task is to:
1. Break scenes into individual shots with camera angles and movements
2. Plan shot durations for pacing
3. Design visual compositions
4. Create image generation prompts for key frames
Output a detailed shot list as a JSON array with scene_number, shot_number, description, camera_angle, camera_move, duration, and image_prompt.`
	case "batch-generator":
		return `You are a batch generation coordinator AI. Your task is to:
1. Review all pending shots that need image or video generation
2. Prioritize generation order for visual consistency
3. Optimize prompts for best generation results
4. Monitor and report on generation progress
Provide a generation plan and optimized prompts for each shot.`
	case "post-production":
		return `You are a post-production coordinator AI for film. Your task is to:
1. Plan the assembly of video clips into a final sequence
2. Suggest transitions between shots
3. Recommend sound design and music placement
4. Plan subtitle timing and placement
5. Suggest color grading approach
Output a detailed post-production plan.`
	case "full-pipeline":
		return `You are an end-to-end film production AI. Guide the user through the complete pipeline:
1. Script analysis and breakdown
2. Character design
3. Storyboard planning
4. Image generation for key frames
5. Video generation from images
6. Post-production assembly
Provide step-by-step guidance and execute each stage.`
	case "consistency-guard":
		return "You are a visual consistency enforcement AI within the MagicalBrush Film Studio pipeline. Monitor all generated images and videos for visual consistency, flag issues, and suggest corrections. Capabilities: 1. Style Drift Detection — compare generated images against project style DNA 2. Character Consistency — verify character appearances remain consistent across shots (clothing, features, proportions) 3. Scene Continuity — check lighting, weather, props, set dressing within scenes 4. Color Palette Enforcement — ensure imagery adheres to project color palette 5. Prompt Correction — suggest specific prompt modifications when inconsistencies found. Output structured analysis with issues_found count, issues array (severity: high|medium|low, type, shots_affected, description, suggested_fix, prompt_patch), and overall_consistency_score (0-1). High-severity issues block downstream stages. Always preserve original creative intent when suggesting corrections."
	default:
		return "You are a helpful AI assistant for film production. Help the user with their creative project."
	}
}

// -- Chat Messages ----------------------------------------------------

// ListStudioChatMessages GET /api/studio/projects/:id/stages/:key/messages
func ListStudioChatMessages(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	key := c.Param("key")
	if !model.ValidStageKey(key) {
		common.ApiErrorMsg(c, "invalid stage key")
		return
	}
	userId := c.GetInt("id")
	messages, err := model.GetStudioChatMessages(project.Id, key, userId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if messages == nil {
		messages = []model.StudioChatMessage{}
	}
	common.ApiSuccess(c, messages)
}

// DeleteStudioChatMessage DELETE /api/studio/projects/:id/stages/:key/messages/:msgId
func DeleteStudioChatMessage(c *gin.Context) {
	_, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	key := c.Param("key")
	if !model.ValidStageKey(key) {
		common.ApiErrorMsg(c, "invalid stage key")
		return
	}
	msgId, err := strconv.Atoi(c.Param("msgId"))
	if err != nil {
		common.ApiErrorMsg(c, "invalid message id")
		return
	}
	userId := c.GetInt("id")
	if err := model.DeleteStudioChatMessageById(msgId, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

// ClearStudioChatMessages DELETE /api/studio/projects/:id/stages/:key/messages
func ClearStudioChatMessages(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	key := c.Param("key")
	if !model.ValidStageKey(key) {
		common.ApiErrorMsg(c, "invalid stage key")
		return
	}
	userId := c.GetInt("id")
	if err := model.ClearStudioChatMessages(project.Id, key, userId); err != nil {
		common.ApiError(c, err)
		return
	}
	common.ApiSuccess(c, nil)
}

type studioSaveChatMessagesRequest struct {
	Messages []studioChatMessageBody `json:"messages"`
}

type studioChatMessageBody struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

// SaveStudioChatMessages POST /api/studio/projects/:id/stages/:key/messages
func SaveStudioChatMessages(c *gin.Context) {
	project, ok := studioProjectFromParam(c)
	if !ok {
		return
	}
	key := c.Param("key")
	if !model.ValidStageKey(key) {
		common.ApiErrorMsg(c, "invalid stage key")
		return
	}
	var req studioSaveChatMessagesRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		common.ApiErrorMsg(c, "invalid request body")
		return
	}
	userId := c.GetInt("id")

	var saved []model.StudioChatMessage
	for _, m := range req.Messages {
		if m.Role != "user" && m.Role != "assistant" {
			continue
		}
		if strings.TrimSpace(m.Content) == "" {
			continue
		}
		msg := model.StudioChatMessage{
			ProjectId: project.Id,
			StageKey:  key,
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
