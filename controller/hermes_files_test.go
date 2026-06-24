package controller

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

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

func TestHermesPlaygroundFileServesRootLevelResultFile(t *testing.T) {
	gin.SetMode(gin.TestMode)
	root := t.TempDir()
	reportName := "report_20260624.md"
	require.NoError(t, os.WriteFile(filepath.Join(root, reportName), []byte("report"), 0o644))
	t.Setenv("HERMES_DATA_DIR", root)

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
