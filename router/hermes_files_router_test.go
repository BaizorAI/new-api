package router

import (
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func newHermesFileRouteTestServer(t *testing.T, hermesDataDir string) (*gin.Engine, []*http.Cookie) {
	t.Helper()

	gin.SetMode(gin.TestMode)
	t.Setenv("HERMES_DATA_DIR", hermesDataDir)

	server := gin.New()
	server.Use(sessions.Sessions("session", cookie.NewStore([]byte("hermes-file-route-test"))))
	server.GET("/login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("username", "tester")
		session.Set("role", common.RoleCommonUser)
		session.Set("id", 42)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	SetRelayRouter(server)

	loginRecorder := httptest.NewRecorder()
	server.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/login", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)

	return server, loginRecorder.Result().Cookies()
}

func TestHermesFileRouteAllowsBrowserSessionWithoutNewAPIUserHeader(t *testing.T) {
	root := t.TempDir()
	uploadDir := filepath.Join(root, "_uploads")
	require.NoError(t, os.MkdirAll(uploadDir, 0o755))
	require.NoError(t, os.WriteFile(filepath.Join(uploadDir, "report.txt"), []byte("report"), 0o644))

	server, cookies := newHermesFileRouteTestServer(t, root)
	request := httptest.NewRequest(http.MethodGet, "/pg/hermes/files/_uploads/report.txt", nil)
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	assert.Equal(t, "report", recorder.Body.String())
}

func TestHermesAPIRoutesStillRequireNewAPIUserHeader(t *testing.T) {
	server, cookies := newHermesFileRouteTestServer(t, t.TempDir())
	request := httptest.NewRequest(http.MethodGet, "/pg/hermes/toolsets", nil)
	for _, cookie := range cookies {
		request.AddCookie(cookie)
	}

	recorder := httptest.NewRecorder()
	server.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusUnauthorized, recorder.Code)
	assert.Contains(t, recorder.Body.String(), "user_id_not_provided")
}
