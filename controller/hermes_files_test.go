package controller

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/BaizorAI/new-api/model"

	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNormalizeHermesDataPath(t *testing.T) {
	path, ok := normalizeHermesDataPath("MEDIA:/opt/data/image_cache/report.png")
	require.True(t, ok)
	assert.Equal(t, "image_cache/report.png", path)

	path, ok = normalizeHermesDataPath("/hermes-data/workspace/report.pdf")
	require.True(t, ok)
	assert.Equal(t, "workspace/report.pdf", path)

	_, ok = normalizeHermesDataPath("../config.yaml")
	assert.False(t, ok)
}

func TestHermesPlaygroundFileServesAllowedSharedArtifact(t *testing.T) {
	gin.SetMode(gin.TestMode)
	root := t.TempDir()
	targetDir := filepath.Join(root, "image_cache")
	require.NoError(t, os.MkdirAll(targetDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(targetDir, "report.png"), []byte("image"), 0o644))
	t.Setenv("HERMES_DATA_DIR", root)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/files/image_cache/report.png", nil)
	c.Params = gin.Params{{Key: "path", Value: "/image_cache/report.png"}}
	c.Set("id", 42)

	HermesPlaygroundFile(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "image", recorder.Body.String())
}

func TestHermesPlaygroundFileServesCurrentUserArtifact(t *testing.T) {
	gin.SetMode(gin.TestMode)
	root := t.TempDir()
	targetDir := filepath.Join(root, "baizor-users", "42", "workspace")
	require.NoError(t, os.MkdirAll(targetDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(targetDir, "report.md"), []byte("report"), 0o644))
	t.Setenv("HERMES_DATA_DIR", root)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/files/baizor-users/42/workspace/report.md", nil)
	c.Params = gin.Params{{Key: "path", Value: "/baizor-users/42/workspace/report.md"}}
	c.Set("id", 42)

	HermesPlaygroundFile(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "report", recorder.Body.String())
}

func TestHermesPlaygroundFileServesTeamArtifactForMember(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.Team{}, &model.TeamMember{}))
	require.NoError(t, db.Create(&model.Team{Id: 7, Name: "research", OwnerId: 42, Status: model.TeamStatusEnabled}).Error)
	require.NoError(t, db.Create(&model.TeamMember{TeamId: 7, UserId: 42, Role: model.TeamRoleOwner, Status: model.TeamStatusEnabled}).Error)
	_, memberErr := model.GetTeamMember(7, 42)
	require.NoError(t, memberErr)
	require.True(t, isHermesDataPathAllowed("teams/7/uploads/report.txt", 42))

	root := t.TempDir()
	targetDir := filepath.Join(root, "teams", "7", "uploads")
	require.NoError(t, os.MkdirAll(targetDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(targetDir, "report.txt"), []byte("team report"), 0o644))
	t.Setenv("HERMES_DATA_DIR", root)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/files/teams/7/uploads/report.txt", nil)
	c.Params = gin.Params{{Key: "path", Value: "/teams/7/uploads/report.txt"}}
	c.Set("id", 42)

	HermesPlaygroundFile(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "team report", recorder.Body.String())
	assert.False(t, isHermesDataPathAllowed("teams/7/uploads/report.txt", 43))
}

func TestHermesPlaygroundFileServesIndexedPersonalTeamZeroArtifact(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.HermesResult{}, &model.Team{}, &model.TeamMember{}))
	root := t.TempDir()
	targetDir := filepath.Join(root, "teams", "0", "workspaces", "anne_ski_training")
	require.NoError(t, os.MkdirAll(targetDir, 0o755))
	reportName := "安妮高管滑雪初学者培训方案.pptx"
	require.NoError(t, os.WriteFile(filepath.Join(targetDir, reportName), []byte("slides"), 0o644))
	t.Setenv("HERMES_DATA_DIR", root)
	relativePath := "teams/0/workspaces/anne_ski_training/" + reportName
	require.NoError(t, model.ReplaceHermesResultsForConversation(42, 0, "conversation-1", []model.HermesResult{{
		Title:      "Slides",
		FileName:   reportName,
		Href:       "/pg/hermes/files/teams/0/workspaces/anne_ski_training/%E5%AE%89%E5%A6%AE%E9%AB%98%E7%AE%A1%E6%BB%91%E9%9B%AA%E5%88%9D%E5%AD%A6%E8%80%85%E5%9F%B9%E8%AE%AD%E6%96%B9%E6%A1%88.pptx",
		ResultType: model.HermesResultTypePPT,
		Source:     model.HermesResultSourceArtifact,
	}}))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/files/"+relativePath, nil)
	c.Params = gin.Params{{Key: "path", Value: "/" + relativePath}}
	c.Set("id", 42)

	HermesPlaygroundFile(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "slides", recorder.Body.String())
	assert.False(t, isHermesDataPathAllowed(relativePath, 43))
}

func TestHermesPlaygroundFileServesRootLevelResultFile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.HermesResult{}, &model.Team{}, &model.TeamMember{}))
	root := t.TempDir()
	reportName := "report_20260624.md"
	require.NoError(t, os.WriteFile(filepath.Join(root, reportName), []byte("report"), 0o644))
	t.Setenv("HERMES_DATA_DIR", root)
	require.NoError(t, model.ReplaceHermesResultsForConversation(42, 0, "conversation-1", []model.HermesResult{{
		Title:      "Report",
		FileName:   reportName,
		Href:       "/pg/hermes/files/" + reportName,
		ResultType: model.HermesResultTypeDocument,
		Source:     model.HermesResultSourceArtifact,
	}}))

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/files/"+reportName, nil)
	c.Params = gin.Params{{Key: "path", Value: "/" + reportName}}
	c.Set("id", 42)

	HermesPlaygroundFile(c)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "report", recorder.Body.String())
}

func TestHermesPlaygroundFileRejectsSensitiveAndOtherUserPaths(t *testing.T) {
	for _, path := range []string{
		"/config.yaml",
		"/state.db",
		"/gateway.lock",
		"/unknown.bin",
		"/logs/agent.log",
		"/skills/test/SKILL.md",
		"/baizor-users/43/workspace/report.md",
		"/baizor-users/42/weixin/accounts/account.json",
	} {
		assert.False(t, isHermesDataPathAllowed(strings.TrimPrefix(path, "/"), 42), path)
	}
}

func TestHermesDataPathRejectsPathTraversal(t *testing.T) {
	for _, path := range []string{
		"../../../etc/passwd",
		"baizor-users/42/workspace/../../43/workspace/secret.txt",
		"baizor-users/42/workspace/..",
		"teams/7/uploads/..",
		"teams/0/workspaces/foo/..\\..\\secret",
		"image_cache/report.png%00.jpg",
		"image_cache/report\x00.png",
		"image_cache/report\\backslash.png",
		"baizor-users/42/.env",
		"baizor-users/42/skills/test/SKILL.md",
		"baizor-users/42/workspaces/..../secret",
	} {
		assert.False(t, isHermesDataPathAllowed(path, 42), path)
		_, ok := normalizeHermesDataPath(path)
		assert.False(t, ok, "normalize: "+path)
	}
}

func TestHermesPlaygroundFileRejectsUnindexedRootLevelResultFile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	db := setupModelListControllerTestDB(t)
	require.NoError(t, db.AutoMigrate(&model.HermesResult{}, &model.Team{}, &model.TeamMember{}))
	root := t.TempDir()
	reportName := "unindexed_report.md"
	require.NoError(t, os.WriteFile(filepath.Join(root, reportName), []byte("report"), 0o644))
	t.Setenv("HERMES_DATA_DIR", root)

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodGet, "/pg/hermes/files/"+reportName, nil)
	c.Params = gin.Params{{Key: "path", Value: "/" + reportName}}
	c.Set("id", 42)

	HermesPlaygroundFile(c)

	require.Equal(t, http.StatusForbidden, recorder.Code)
}
