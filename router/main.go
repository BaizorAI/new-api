package router

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/controller"
	"github.com/BaizorAI/new-api/middleware"

	"github.com/gin-gonic/gin"
)

func SetRouter(router *gin.Engine, assets ThemeAssets) {
	SetApiRouter(router)
	SetDashboardRouter(router)
	SetRelayRouter(router)
	SetVideoRouter(router)

	// CLI login token polling — matches the public URL pattern /token?cli_token=xxx
	router.GET("/token", controller.PollCliSession)

	// Serve WeChat MP domain verification file at site root
	router.GET("/MP_verify_R49wU53vsJy7wmuk.txt", func(c *gin.Context) {
		c.String(http.StatusOK, "R49wU53vsJy7wmuk")
	})

	// Serve standalone download/install files
	router.Static("/install", "./install")

	frontendBaseUrl := os.Getenv("FRONTEND_BASE_URL")
	if common.IsMasterNode && frontendBaseUrl != "" {
		frontendBaseUrl = ""
		common.SysLog("FRONTEND_BASE_URL is ignored on master node")
	}
	if frontendBaseUrl == "" {
		SetWebRouter(router, assets)
	} else {
		frontendBaseUrl = strings.TrimSuffix(frontendBaseUrl, "/")
		router.NoRoute(func(c *gin.Context) {
			c.Set(middleware.RouteTagKey, "web")
			c.Redirect(http.StatusMovedPermanently, fmt.Sprintf("%s%s", frontendBaseUrl, c.Request.RequestURI))
		})
	}
}
