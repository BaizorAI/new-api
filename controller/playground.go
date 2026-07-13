package controller

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/BaizorAI/new-api/model"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	"github.com/BaizorAI/new-api/types"

	"github.com/gin-gonic/gin"
)

type hermesSkillCreateRequest struct {
	Name     string `json:"name"`
	Content  string `json:"content"`
	Category string `json:"category,omitempty"`
	Scope    string `json:"scope,omitempty"`
}

// resolveHermesSkillWriteScope determines the storage scope for a Hermes skill
// write (create/update/delete) and enforces team management permission when the
// request targets a team. Without an explicit scope the Hermes sidecar defaults
// to the personal ("user") space, so team-scoped writes must set scope to "team".
func resolveHermesSkillWriteScope(c *gin.Context) (string, error) {
	rawTeamID := strings.TrimSpace(c.GetHeader("X-Baizor-Team-Id"))
	if rawTeamID == "" || rawTeamID == "0" {
		return "user", nil
	}

	teamID, err := strconv.Atoi(rawTeamID)
	if err != nil || teamID <= 0 {
		return "", fmt.Errorf("team context is required")
	}

	team, err := model.GetTeamByIdForUser(teamID, c.GetInt("id"))
	if err != nil || !model.CanManageTeamRole(team.Role) {
		return "", fmt.Errorf("no permission to manage skills for this team")
	}

	return "team", nil
}

type hermesProxyResult struct {
	StatusCode int
	Body       []byte
}

type hermesWeixinStatusAuditResponse struct {
	Status       string      `json:"status"`
	AccountLabel string      `json:"account_label"`
	ConnectedAt  interface{} `json:"connected_at"`
}

var (
	hermesWeixinConnectedAuditMu   sync.Mutex
	hermesWeixinConnectedAuditKeys = map[string]int64{}
)

const hermesWeixinConnectedAuditTTLSeconds int64 = 24 * 60 * 60

func Playground(c *gin.Context) {
	var newAPIError *types.NewAPIError

	defer func() {
		if newAPIError != nil {
			c.JSON(newAPIError.StatusCode, gin.H{
				"error": newAPIError.ToOpenAIError(),
			})
		}
	}()

	useAccessToken := c.GetBool("use_access_token")
	if useAccessToken {
		newAPIError = types.NewError(errors.New("暂不支持使用 access token"), types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}

	relayInfo, err := relaycommon.GenRelayInfo(c, types.RelayFormatOpenAI, nil, nil)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeInvalidRequest, types.ErrOptionWithSkipRetry())
		return
	}

	userId := c.GetInt("id")

	// Write user context to ensure acceptUnsetRatio is available
	userCache, err := model.GetUserCache(userId)
	if err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeQueryDataError, types.ErrOptionWithSkipRetry())
		return
	}
	userCache.WriteContext(c)

	tempToken := &model.Token{
		UserId: userId,
		Name:   fmt.Sprintf("playground-%s", relayInfo.UsingGroup),
		Group:  relayInfo.UsingGroup,
	}
	_ = middleware.SetupContextForToken(c, tempToken)
	if err := applyHermesRequestedBillingContext(c, userId); err != nil {
		newAPIError = types.NewError(err, types.ErrorCodeAccessDenied, types.ErrOptionWithSkipRetry())
		return
	}
	applyHermesPlaygroundHeaderOverride(c, userId)

	Relay(c, types.RelayFormatOpenAI)
}

func HermesPlaygroundSkills(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	switch c.Request.Method {
	case http.MethodGet:
		proxyHermesPlayground(c, http.MethodGet, "/v1/skills", nil)
	case http.MethodPost:
		var request hermesSkillCreateRequest
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
			return
		}

		request.Name = strings.TrimSpace(request.Name)
		request.Category = strings.TrimSpace(request.Category)
		if request.Name == "" || strings.TrimSpace(request.Content) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "name and content are required"})
			return
		}

		scope, err := resolveHermesSkillWriteScope(c)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
			return
		}
		request.Scope = scope

		body, err := common.Marshal(request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to encode request"})
			return
		}
		proxyHermesPlayground(c, http.MethodPost, "/v1/skills", body)
	case http.MethodPut:
		var request hermesSkillCreateRequest
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
			return
		}

		request.Name = strings.TrimSpace(request.Name)
		if request.Name == "" || strings.TrimSpace(request.Content) == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "name and content are required"})
			return
		}

		scope, err := resolveHermesSkillWriteScope(c)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
			return
		}
		request.Scope = scope

		body, err := common.Marshal(request)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to encode request"})
			return
		}
		proxyHermesPlayground(c, http.MethodPut, "/v1/skills", body)
	case http.MethodDelete:
		var request struct {
			Name string `json:"name"`
		}
		if err := common.DecodeJson(c.Request.Body, &request); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
			return
		}

		request.Name = strings.TrimSpace(request.Name)
		if request.Name == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
			return
		}

		scope, err := resolveHermesSkillWriteScope(c)
		if err != nil {
			c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
			return
		}

		body, err := common.Marshal(gin.H{"name": request.Name, "scope": scope})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to encode request"})
			return
		}
		proxyHermesPlayground(c, http.MethodDelete, "/v1/skills", body)
	default:
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
	}
}

func HermesPromoteSkill(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodPost {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	var request struct {
		Name        string `json:"name"`
		Target      string `json:"target,omitempty"`
		SourceScope string `json:"source_scope,omitempty"`
	}
	if err := common.DecodeJson(c.Request.Body, &request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
		return
	}

	request.Name = strings.TrimSpace(request.Name)
	request.Target = strings.ToLower(strings.TrimSpace(request.Target))
	request.SourceScope = strings.ToLower(strings.TrimSpace(request.SourceScope))
	if request.Target == "" {
		request.Target = "baizor"
	}
	if request.SourceScope == "" {
		request.SourceScope = "user"
	}
	if request.Target != "baizor" && request.Target != "team" && request.Target != "system" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid promote target"})
		return
	}
	if request.SourceScope != "user" && request.SourceScope != "team" && request.SourceScope != "baizor" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid source scope"})
		return
	}
	if request.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
		return
	}

	if request.Target == "team" || request.SourceScope == "team" {
		teamID, err := strconv.Atoi(strings.TrimSpace(c.GetHeader("X-Baizor-Team-Id")))
		if err != nil || teamID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "team context is required"})
			return
		}
		team, err := model.GetTeamByIdForUser(teamID, c.GetInt("id"))
		if err != nil || !model.CanManageTeamRole(team.Role) {
			c.JSON(http.StatusForbidden, gin.H{"message": "no permission to publish skills for this team"})
			return
		}
	}
	if request.Target != "team" && c.GetInt("role") < common.RoleAdminUser {
		c.JSON(http.StatusForbidden, gin.H{"message": "only admin or root users can publish skills to Baizor or system skills"})
		return
	}

	body, err := common.Marshal(request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to encode request"})
		return
	}
	proxyHermesPlayground(c, http.MethodPost, "/v1/skills/promote", body)
}
// resolveSkillAssetDir resolves the on-disk directory for a named skill.
// All skills live under the unified skills/ directory under HERMES_DATA_DIR.
// Ownership and scope are tracked in the SKILL.md frontmatter, not in the
// directory layout.
func resolveSkillAssetDir(userId int, skillName string, teamID int) (string, error) {
	root := filepath.Clean(common.GetEnvOrDefaultString("HERMES_DATA_DIR", "/opt/data"))

	// Search the unified skills directory first.
	skillsBase := filepath.Join(root, "skills")
	var skillDir string
	_ = filepath.Walk(skillsBase, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if skillDir != "" {
			return filepath.SkipAll
		}
		if info.IsDir() && info.Name() == skillName {
			skillDir = p
			return filepath.SkipAll
		}
		return nil
	})

	if skillDir != "" {
		return skillDir, nil
	}

	// Fallback: search legacy per-user / per-team directories.
	var legacyBase string
	if teamID > 0 {
		legacyBase = filepath.Join(root, fmt.Sprintf("teams/%d", teamID), "skills")
	} else {
		legacyBase = filepath.Join(root, fmt.Sprintf("baizor-users/%d", userId), "skills")
	}
	_ = filepath.Walk(legacyBase, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if skillDir != "" {
			return filepath.SkipAll
		}
		if info.IsDir() && info.Name() == skillName {
			skillDir = p
			return filepath.SkipAll
		}
		return nil
	})

	if skillDir == "" {
		return "", fmt.Errorf("skill directory not found")
	}
	return skillDir, nil
}

func HermesPlaygroundSkillAssets(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	userId := c.GetInt("id")
	skillName := strings.TrimSpace(c.Query("name"))
	if skillName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
		return
	}

	rawTeamID := strings.TrimSpace(c.Query("team_id"))
	var teamID int
	if rawTeamID != "" && rawTeamID != "0" {
		var err error
		teamID, err = strconv.Atoi(rawTeamID)
		if err != nil || teamID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid team_id"})
			return
		}
		if _, err := model.GetTeamMember(teamID, userId); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"message": "not a team member"})
			return
		}
	}

	skillDir, err := resolveSkillAssetDir(userId, skillName, teamID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": err.Error()})
		return
	}

	switch c.Request.Method {
	case http.MethodGet:
		type assetEntry struct {
			Name string `json:"name"`
			Path string `json:"path"`
			Size int64  `json:"size"`
			Dir  bool   `json:"dir"`
		}
		var assets []assetEntry
		_ = filepath.Walk(skillDir, func(p string, info os.FileInfo, err error) error {
			if err != nil {
				return nil
			}
			rel, _ := filepath.Rel(skillDir, p)
			if rel == "." || rel == "SKILL.md" {
				return nil
			}
			if strings.HasPrefix(info.Name(), ".") {
				if info.IsDir() {
					return filepath.SkipDir
				}
				return nil
			}
			assets = append(assets, assetEntry{
				Name: info.Name(),
				Path: filepath.ToSlash(rel),
				Size: info.Size(),
				Dir:  info.IsDir(),
			})
			return nil
		})
		if assets == nil {
			assets = []assetEntry{}
		}
		c.JSON(http.StatusOK, gin.H{"data": assets})

	case http.MethodPost:
		// Multipart file upload.  Fields: "file" (required), "subdir" (optional).
		file, header, err := c.Request.FormFile("file")
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "file is required"})
			return
		}
		defer file.Close()

		// Sanitize filename
		cleanName := filepath.Base(filepath.Clean(header.Filename))
		if cleanName == "." || cleanName == ".." || cleanName == "" ||
			cleanName == "SKILL.md" || strings.HasPrefix(cleanName, ".") {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid filename"})
			return
		}

		// Only allow safe extensions
		ext := strings.ToLower(filepath.Ext(cleanName))
		if _, ok := hermesAllowedRootFileExtensions[ext]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"message": "file type not allowed: " + ext})
			return
		}

		targetDir := skillDir
		subdir := strings.TrimSpace(c.PostForm("subdir"))
		if subdir != "" {
			cleanSubdir := filepath.Clean(filepath.FromSlash(subdir))
			if strings.Contains(cleanSubdir, "..") {
				c.JSON(http.StatusBadRequest, gin.H{"message": "invalid subdir"})
				return
			}
			targetDir = filepath.Join(skillDir, cleanSubdir)
			if err := os.MkdirAll(targetDir, 0o755); err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create directory"})
				return
			}
		}

		destPath := filepath.Join(targetDir, cleanName)
		dst, err := os.Create(destPath)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create file"})
			return
		}
		defer dst.Close()

		if _, err := io.Copy(dst, file); err != nil {
			os.Remove(destPath)
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to write file"})
			return
		}

		relPath, _ := filepath.Rel(skillDir, destPath)
		c.JSON(http.StatusOK, gin.H{
			"message": "uploaded",
			"data": gin.H{
				"name": cleanName,
				"path": filepath.ToSlash(relPath),
			},
		})

	case http.MethodDelete:
		// DELETE requires JSON body: { "path": "assets/template.pptx" }
		var req struct {
			Path string `json:"path"`
		}
		if err := common.DecodeJson(c.Request.Body, &req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
			return
		}

		req.Path = strings.TrimSpace(req.Path)
		if req.Path == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "path is required"})
			return
		}

		cleanPath := filepath.Clean(filepath.FromSlash(req.Path))
		if strings.Contains(cleanPath, "..") || cleanPath == "." ||
			filepath.Base(cleanPath) == "SKILL.md" {
			c.JSON(http.StatusForbidden, gin.H{"message": "invalid path"})
			return
		}

		fullPath := filepath.Join(skillDir, cleanPath)
		if !strings.HasPrefix(fullPath, skillDir+string(os.PathSeparator)) && fullPath != skillDir {
			c.JSON(http.StatusForbidden, gin.H{"message": "path is outside skill directory"})
			return
		}

		info, err := os.Stat(fullPath)
		if err != nil || info.IsDir() {
			c.JSON(http.StatusNotFound, gin.H{"message": "file not found"})
			return
		}

		if err := os.Remove(fullPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to delete file"})
			return
		}

		c.JSON(http.StatusOK, gin.H{"message": "deleted"})

	default:
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
	}
}

func HermesPlaygroundSkillAssetFile(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}
	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	userId := c.GetInt("id")
	skillName := strings.TrimSpace(c.Query("name"))
	filePath := strings.TrimSpace(c.Query("path"))
	if skillName == "" || filePath == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "name and path are required"})
		return
	}

	base := filepath.Base(filePath)
	if base == "SKILL.md" || strings.HasPrefix(base, ".") {
		c.JSON(http.StatusForbidden, gin.H{"message": "file is not available"})
		return
	}

	ext := strings.ToLower(filepath.Ext(base))
	if _, ok := hermesAllowedRootFileExtensions[ext]; !ok {
		c.JSON(http.StatusForbidden, gin.H{"message": "file is not available"})
		return
	}

	rawTeamID := strings.TrimSpace(c.Query("team_id"))
	var teamID int
	if rawTeamID != "" && rawTeamID != "0" {
		var err error
		teamID, err = strconv.Atoi(rawTeamID)
		if err != nil || teamID <= 0 {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid team_id"})
			return
		}
		if _, err := model.GetTeamMember(teamID, userId); err != nil {
			c.JSON(http.StatusForbidden, gin.H{"message": "not a team member"})
			return
		}
	}

	skillDir, err := resolveSkillAssetDir(userId, skillName, teamID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"message": err.Error()})
		return
	}

	cleanFile := filepath.Clean(filepath.FromSlash(filePath))
	if strings.Contains(cleanFile, "..") {
		c.JSON(http.StatusForbidden, gin.H{"message": "file is not available"})
		return
	}

	fullPath := filepath.Join(skillDir, cleanFile)
	if !strings.HasPrefix(fullPath, skillDir+string(os.PathSeparator)) && fullPath != skillDir {
		c.JSON(http.StatusForbidden, gin.H{"message": "file is not available"})
		return
	}

	info, err := os.Stat(fullPath)
	if err != nil || info.IsDir() {
		c.JSON(http.StatusNotFound, gin.H{"message": "file not found"})
		return
	}

	c.File(fullPath)
}

func HermesPlaygroundSkillGenerate(c *gin.Context) {
	if c == nil || c.Request == nil || c.Request.Method != http.MethodPost {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
	}
	if err := common.DecodeJson(c.Request.Body, &req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
		return
	}

	req.Name = strings.TrimSpace(req.Name)
	req.Description = strings.TrimSpace(req.Description)
	if req.Name == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "name is required"})
		return
	}

	systemPrompt := fmt.Sprintf(`You are a Hermes skill authoring assistant. Generate a complete SKILL.md for a skill named "%s".

The user describes the skill as: "%s"

Return ONLY the SKILL.md content with YAML frontmatter. Follow this exact structure:

---
name: %s
description: "Brief one-line description of when to use this skill"
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [relevant, tags, here]
---

# Skill Title

## Overview

What this skill does.

## When to Use

- Condition 1
- Condition 2

## Procedure

1. Step one
2. Step two

## Hard Rules

- Rule 1

## Verification

How to confirm it worked.
`, req.Name, req.Description, req.Name)

	chatReq := map[string]interface{}{
		"model": "hermes",
		"messages": []map[string]string{
			{"role": "system", "content": systemPrompt},
			{"role": "user", "content": fmt.Sprintf("Generate a complete SKILL.md for the skill named \"%s\"", req.Name)},
		},
		"stream":            false,
		"max_tokens":        8000,
		"temperature":       0.3,
		"x-baizor-services": "hermes",
	}

	// If team context, pass through headers
	rawTeamID := strings.TrimSpace(c.GetHeader("X-Baizor-Team-Id"))
	if rawTeamID != "" && rawTeamID != "0" {
		if teamID, err := strconv.Atoi(rawTeamID); err == nil && teamID > 0 {
			if _, err := model.GetTeamMember(teamID, c.GetInt("id")); err != nil {
				c.JSON(http.StatusForbidden, gin.H{"message": "not a team member"})
				return
			}
		}
	}

	body, _ := common.Marshal(chatReq)
	result := proxyHermesPlayground(c, http.MethodPost, "/v1/chat/completions", body)
	if result.StatusCode != http.StatusOK {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "generation failed"})
		return
	}

	// Parse response and extract content
	type choiceType struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	}
	type respType struct {
		Choices []choiceType `json:"choices"`
	}
	var resp respType
	if err := common.Unmarshal(result.Body, &resp); err != nil || len(resp.Choices) == 0 {
		c.JSON(http.StatusOK, gin.H{"data": gin.H{"content": string(result.Body)}, "raw": true})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": gin.H{"content": resp.Choices[0].Message.Content}})
}

func HermesPlaygroundToolsets(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	proxyHermesPlayground(c, http.MethodGet, "/v1/toolsets", nil)
}

func HermesPlaygroundWeixinStatus(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	proxyHermesPlayground(c, http.MethodGet, "/v1/platforms/weixin/status", nil)
}

func HermesPlaygroundWeixinQR(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodPost {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	result := proxyHermesPlayground(c, http.MethodPost, "/v1/platforms/weixin/qr", nil)
	recordHermesWeixinAudit(c, "hermes.weixin_qr_create", "create_qr", result)
}

func HermesPlaygroundWeixinQRStatus(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	requestID := sanitizeHermesPathSegment(c.Param("request_id"))
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request_id"})
		return
	}

	result := proxyHermesPlayground(c, http.MethodGet, "/v1/platforms/weixin/qr/"+url.PathEscape(requestID), nil)
	recordHermesWeixinConnectedAudit(c, requestID, result)
}

func HermesPlaygroundWeixinDisconnect(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodPost {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	result := proxyHermesPlayground(c, http.MethodPost, "/v1/platforms/weixin/disconnect", nil)
	recordHermesWeixinAudit(c, "hermes.weixin_disconnect", "disconnect", result)
}

func HermesPlaygroundWeixinSessions(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	userID := c.GetInt("id")
	if userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}

	query := url.Values{}
	query.Set("source", "weixin")
	query.Set("user_id", strconv.Itoa(userID))
	query.Set("limit", strconv.Itoa(hermesBoundedQueryInt(c.Query("limit"), 20, 100)))
	query.Set("offset", strconv.Itoa(hermesBoundedQueryInt(c.Query("offset"), 0, 1000000)))
	proxyHermesPlaygroundWithQuery(c, http.MethodGet, "/api/sessions", query, nil)
}

func HermesPlaygroundSessionMessages(c *gin.Context) {
	if c == nil || c.Request == nil {
		return
	}

	if c.Request.Method != http.MethodGet {
		c.JSON(http.StatusMethodNotAllowed, gin.H{"message": "method not allowed"})
		return
	}

	userID := c.GetInt("id")
	if userID <= 0 {
		c.JSON(http.StatusUnauthorized, gin.H{"message": "unauthorized"})
		return
	}

	sessionID := sanitizeHermesSessionID(c.Param("session_id"))
	if sessionID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid session_id"})
		return
	}

	query := url.Values{}
	query.Set("user_id", strconv.Itoa(userID))
	proxyHermesPlaygroundWithQuery(c, http.MethodGet, "/api/sessions/"+url.PathEscape(sessionID)+"/messages", query, nil)
}

func applyHermesPlaygroundHeaderOverride(c *gin.Context, userId int) {
	if c == nil || c.Request == nil || !strings.HasPrefix(c.Request.URL.Path, "/pg/chat/completions") {
		return
	}
	if !strings.EqualFold(strings.TrimSpace(c.GetHeader("X-Baizor-Playground")), "hermes") {
		return
	}

	headerOverride := common.GetContextKeyStringMap(c, constant.ContextKeyChannelHeaderOverride)
	merged := make(map[string]any, len(headerOverride)+3)
	for key, value := range headerOverride {
		merged[key] = value
	}

	for key, value := range buildHermesPlaygroundAttributionHeaders(c, userId) {
		merged[key] = value
	}

	common.SetContextKey(c, constant.ContextKeyChannelHeaderOverride, merged)
}

func buildHermesPlaygroundAttributionHeaders(c *gin.Context, userId int) map[string]string {
	teamID := common.GetContextKeyInt(c, constant.ContextKeyTeamId)
	workspace := strings.ToLower(strings.TrimSpace(c.GetHeader("X-Baizor-Hermes-Workspace")))
	sessionID := scopedHermesSessionID(userId, c.GetHeader("X-Baizor-Hermes-Session"))
	if teamID > 0 && workspace == "team_workspace" {
		sessionID = scopedHermesTeamSessionID(teamID, c.GetHeader("X-Baizor-Hermes-Session"))
	}
	teamName := common.GetContextKeyString(c, constant.ContextKeyTeamName)
	billingScope := common.HermesBillingScopeUser
	if teamID > 0 {
		billingScope = common.HermesBillingScopeTeam
	}

	headers := map[string]string{
		"X-Hermes-User-Id":       strconv.Itoa(userId),
		"X-Hermes-Source":        "baizor-web-playground",
		"X-Hermes-Session-Id":    sessionID,
		"X-Hermes-Billing-Scope": billingScope,
	}

	activeSkill := strings.TrimSpace(c.GetHeader("X-Baizor-Hermes-Skill-Activate"))
	if activeSkill != "" {
		headers["X-Hermes-Active-Skill"] = activeSkill
	}

	smartRoute := strings.TrimSpace(c.GetHeader("X-Baizor-Smart-Route"))
	if smartRoute != "" {
		headers["X-Hermes-Smart-Route"] = smartRoute
	}

	if teamID > 0 {
		headers["X-Hermes-Team-Id"] = strconv.Itoa(teamID)
		if teamName != "" {
			headers["X-Hermes-Team-Name"] = teamName
		}
	}

	secret := common.GetEnvOrDefaultString("HERMES_API_SERVER_KEY", "")
	delegationHeaders := common.BuildHermesDelegationHeaders(secret, common.HermesDelegationContext{
		UserID:    userId,
		TeamID:    teamID,
		TeamName:  teamName,
		Scope:     billingScope,
		SessionID: sessionID,
		ExpiresAt: time.Now().Add(6 * time.Hour).Unix(),
	})
	for key, value := range delegationHeaders {
		headers[key] = value
	}
	return headers
}

func applyHermesRequestedBillingContext(c *gin.Context, userId int) error {
	if c == nil || c.Request == nil {
		return nil
	}

	rawTeamID := strings.TrimSpace(c.GetHeader("X-Baizor-Team-Id"))
	if rawTeamID == "" || rawTeamID == "0" {
		return nil
	}

	teamID, err := strconv.Atoi(rawTeamID)
	if err != nil || teamID <= 0 {
		return fmt.Errorf("invalid team billing account")
	}

	team, _, err := model.GetTeamForToken(teamID, userId)
	if err != nil {
		return fmt.Errorf("team billing account is unavailable")
	}

	common.SetContextKey(c, constant.ContextKeyTeamId, team.Id)
	common.SetContextKey(c, constant.ContextKeyTeamName, team.Name)
	common.SetContextKey(c, constant.ContextKeyTeamQuota, team.Quota)
	return nil
}

func hermesBoundedQueryInt(value string, fallback int, maximum int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 0 {
		return fallback
	}
	if parsed > maximum {
		return maximum
	}
	return parsed
}

func proxyHermesPlayground(c *gin.Context, method string, path string, body []byte) hermesProxyResult {
	return proxyHermesPlaygroundWithQuery(c, method, path, nil, body)
}

func proxyHermesPlaygroundWithQuery(c *gin.Context, method string, path string, query url.Values, body []byte) hermesProxyResult {
	baseURL := strings.TrimRight(common.GetEnvOrDefaultString("HERMES_API_SERVER_URL", "http://baizor-hermes:8642"), "/")
	apiKey := strings.TrimSpace(common.GetEnvOrDefaultString("HERMES_API_SERVER_KEY", ""))
	if apiKey == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "HERMES_API_SERVER_KEY is not configured"})
		return hermesProxyResult{StatusCode: http.StatusServiceUnavailable}
	}

	parsedURL, err := url.Parse(baseURL)
	if err != nil || parsedURL.Scheme == "" || parsedURL.Host == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"message": "HERMES_API_SERVER_URL is invalid"})
		return hermesProxyResult{StatusCode: http.StatusServiceUnavailable}
	}
	parsedURL.Path = strings.TrimRight(parsedURL.Path, "/") + path
	parsedURL.RawQuery = query.Encode()

	var reader io.Reader
	if len(body) > 0 {
		reader = bytes.NewReader(body)
	}

	reqCtx := c.Request.Context()
	// Chat completions and generation requests can run for several minutes.
	// Use a background context so the request survives even if the
	// browser's HTTP connection drops (e.g. network hiccup, tab switch).
	if strings.Contains(path, "/chat/completions") || strings.Contains(path, "/generate") {
		reqCtx = context.Background()
	}
	req, err := http.NewRequestWithContext(reqCtx, method, parsedURL.String(), reader)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to create hermes request"})
		return hermesProxyResult{StatusCode: http.StatusInternalServerError}
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Accept", "application/json")
	if len(body) > 0 {
		req.Header.Set("Content-Type", "application/json")
	}
	userId := c.GetInt("id")
	if err := applyHermesRequestedBillingContext(c, userId); err != nil {
		c.JSON(http.StatusForbidden, gin.H{"message": err.Error()})
		return hermesProxyResult{StatusCode: http.StatusForbidden}
	}
	for key, value := range buildHermesPlaygroundAttributionHeaders(c, userId) {
		req.Header.Set(key, value)
	}

	client := &http.Client{Timeout: 10 * time.Minute}
	resp, err := client.Do(req)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "failed to reach hermes sidecar"})
		return hermesProxyResult{StatusCode: http.StatusBadGateway}
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		c.JSON(http.StatusBadGateway, gin.H{"message": "failed to read hermes response"})
		return hermesProxyResult{StatusCode: http.StatusBadGateway}
	}

	contentType := resp.Header.Get("Content-Type")
	if contentType == "" {
		contentType = "application/json"
	}
	c.Data(resp.StatusCode, contentType, respBody)
	return hermesProxyResult{StatusCode: resp.StatusCode, Body: respBody}
}

func sanitizeHermesSessionID(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 128 {
		return ""
	}

	for _, char := range value {
		if char >= 'a' && char <= 'z' {
			continue
		}
		if char >= 'A' && char <= 'Z' {
			continue
		}
		if char >= '0' && char <= '9' {
			continue
		}
		if strings.ContainsRune("._:-", char) {
			continue
		}
		return ""
	}

	return value
}

func scopedHermesSessionID(userID int, sessionID string) string {
	cleanSessionID := sanitizeHermesSessionID(sessionID)
	if cleanSessionID == "" {
		return "user-" + strconv.Itoa(userID)
	}
	return "user-" + strconv.Itoa(userID) + "-" + cleanSessionID
}

func scopedHermesTeamSessionID(teamID int, sessionID string) string {
	cleanSessionID := sanitizeHermesSessionID(sessionID)
	if cleanSessionID == "" {
		return "team-" + strconv.Itoa(teamID)
	}
	return "team-" + strconv.Itoa(teamID) + "-" + cleanSessionID
}

func sanitizeHermesPathSegment(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 128 {
		return ""
	}

	for _, char := range value {
		if char >= 'a' && char <= 'z' {
			continue
		}
		if char >= 'A' && char <= 'Z' {
			continue
		}
		if char >= '0' && char <= '9' {
			continue
		}
		if strings.ContainsRune("._-", char) {
			continue
		}
		return ""
	}

	return value
}

func recordHermesWeixinAudit(c *gin.Context, successAction string, operation string, result hermesProxyResult) {
	params := map[string]interface{}{
		"operation":   operation,
		"status_code": result.StatusCode,
	}
	if result.StatusCode >= 200 && result.StatusCode < 300 {
		recordUserSecurityAudit(c, c.GetInt("id"), successAction, params)
		return
	}
	recordUserSecurityAudit(c, c.GetInt("id"), "hermes.weixin_error", params)
}

func recordHermesWeixinConnectedAudit(c *gin.Context, requestID string, result hermesProxyResult) {
	if result.StatusCode < 200 || result.StatusCode >= 300 || len(result.Body) == 0 {
		return
	}

	var response hermesWeixinStatusAuditResponse
	if err := common.Unmarshal(result.Body, &response); err != nil {
		return
	}
	if response.Status != "connected" {
		return
	}

	userID := c.GetInt("id")
	auditKey := fmt.Sprintf("user:%d:request:%s", userID, requestID)
	if requestID == "" {
		auditKey = fmt.Sprintf("user:%d:account:%s:connected:%v", userID, response.AccountLabel, response.ConnectedAt)
	}
	if !markHermesWeixinConnectedAuditOnce(auditKey) {
		return
	}

	params := map[string]interface{}{
		"operation":   "connect",
		"status_code": result.StatusCode,
	}
	if requestID != "" {
		params["request_id"] = requestID
	}
	if response.AccountLabel != "" {
		params["account_label"] = response.AccountLabel
	}
	if response.ConnectedAt != nil {
		params["connected_at"] = response.ConnectedAt
	}
	recordUserSecurityAudit(c, userID, "hermes.weixin_connected", params)
}

func markHermesWeixinConnectedAuditOnce(key string) bool {
	now := common.GetTimestamp()

	hermesWeixinConnectedAuditMu.Lock()
	defer hermesWeixinConnectedAuditMu.Unlock()

	for auditKey, timestamp := range hermesWeixinConnectedAuditKeys {
		if now-timestamp > hermesWeixinConnectedAuditTTLSeconds {
			delete(hermesWeixinConnectedAuditKeys, auditKey)
		}
	}

	if _, ok := hermesWeixinConnectedAuditKeys[key]; ok {
		return false
	}
	hermesWeixinConnectedAuditKeys[key] = now
	return true
}
