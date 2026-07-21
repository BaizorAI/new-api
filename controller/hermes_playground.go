package controller

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
)

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
	if request.SourceScope != "user" && request.SourceScope != "team" {
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
	root := filepath.Clean(common.GetHermesConfig().DataDir)

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

	if skillDir != "" {
		return skillDir, nil
	}

	return "", fmt.Errorf("skill not found")
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

	case http.MethodPut:
		// PUT requires JSON body: { "path": "assets/old.pptx", "new_name": "new.pptx" }
		var renameReq struct {
			Path    string `json:"path"`
			NewName string `json:"new_name"`
		}
		if err := common.DecodeJson(c.Request.Body, &renameReq); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid request body"})
			return
		}
		renameReq.Path = strings.TrimSpace(renameReq.Path)
		renameReq.NewName = strings.TrimSpace(renameReq.NewName)
		if renameReq.Path == "" || renameReq.NewName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"message": "path and new_name are required"})
			return
		}
		// Security: same constraints as DELETE + valid filename
		cleanPath := filepath.Clean(filepath.FromSlash(renameReq.Path))
		if strings.Contains(cleanPath, "..") || cleanPath == "." || filepath.Base(cleanPath) == "SKILL.md" {
			c.JSON(http.StatusForbidden, gin.H{"message": "invalid path"})
			return
		}
		oldPath := filepath.Join(skillDir, cleanPath)
		if !strings.HasPrefix(oldPath, skillDir+string(os.PathSeparator)) && oldPath != skillDir {
			c.JSON(http.StatusForbidden, gin.H{"message": "path is outside skill directory"})
			return
		}
		if _, err := os.Stat(oldPath); err != nil {
			c.JSON(http.StatusNotFound, gin.H{"message": "file not found"})
			return
		}
		cleanName := filepath.Base(filepath.Clean(renameReq.NewName))
		if cleanName == "." || cleanName == ".." || cleanName == "" || cleanName == "SKILL.md" || strings.HasPrefix(cleanName, ".") {
			c.JSON(http.StatusBadRequest, gin.H{"message": "invalid filename"})
			return
		}
		ext := strings.ToLower(filepath.Ext(cleanName))
		if _, ok := hermesAllowedRootFileExtensions[ext]; !ok {
			c.JSON(http.StatusBadRequest, gin.H{"message": "file type not allowed: " + ext})
			return
		}
		newPath := filepath.Join(filepath.Dir(oldPath), cleanName)
		if err := os.Rename(oldPath, newPath); err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"message": "failed to rename file"})
			return
		}
		relPath, _ := filepath.Rel(skillDir, newPath)
		c.JSON(http.StatusOK, gin.H{"message": "renamed", "data": gin.H{"path": filepath.ToSlash(relPath)}})

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
