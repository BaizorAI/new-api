package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"
	"github.com/gin-contrib/sessions"
	"github.com/gin-contrib/sessions/cookie"
	"github.com/gin-gonic/gin"
	"github.com/glebarez/sqlite"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func TestUserAuthRefreshesBrowserSessionRoleFromDatabase(t *testing.T) {
	gin.SetMode(gin.TestMode)

	originalDB := model.DB
	originalRedisEnabled := common.RedisEnabled
	originalRedisClient := common.RDB
	t.Cleanup(func() {
		model.DB = originalDB
		common.RedisEnabled = originalRedisEnabled
		common.RDB = originalRedisClient
	})

	common.RedisEnabled = false
	common.RDB = nil
	db, err := gorm.Open(sqlite.Open(":memory:"), &gorm.Config{})
	require.NoError(t, err)
	require.NoError(t, db.AutoMigrate(&model.User{}))
	model.DB = db

	require.NoError(t, db.Create(&model.User{
		Id:       1,
		Username: "tester",
		Password: "not-used-in-test",
		Role:     common.RoleAdminUser,
		Status:   common.UserStatusEnabled,
		Group:    "default",
	}).Error)

	router := gin.New()
	router.Use(sessions.Sessions("session", cookie.NewStore([]byte("auth-refresh-test"))))
	router.GET("/login", func(c *gin.Context) {
		session := sessions.Default(c)
		session.Set("username", "tester")
		session.Set("role", common.RoleCommonUser)
		session.Set("id", 1)
		session.Set("status", common.UserStatusEnabled)
		session.Set("group", "default")
		require.NoError(t, session.Save())
		c.Status(http.StatusNoContent)
	})
	router.GET("/api/admin", AdminAuth(), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"role": c.GetInt("role")})
	})

	loginRecorder := httptest.NewRecorder()
	router.ServeHTTP(loginRecorder, httptest.NewRequest(http.MethodGet, "/login", nil))
	require.Equal(t, http.StatusNoContent, loginRecorder.Code)

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/admin", nil)
	request.Header.Set("New-Api-User", "1")
	for _, cookie := range loginRecorder.Result().Cookies() {
		request.AddCookie(cookie)
	}
	router.ServeHTTP(recorder, request)

	require.Equal(t, http.StatusOK, recorder.Code)
	require.JSONEq(t, `{"role":10}`, recorder.Body.String())
}
