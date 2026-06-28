package middleware

import (
	"path/filepath"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/gin-gonic/gin"
)

func Cache() func(c *gin.Context) {
	return func(c *gin.Context) {
		path := c.Request.URL.Path
		ext := strings.ToLower(filepath.Ext(path))

		switch {
		case path == "/version.json":
			c.Header("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0")
		case path == "/" || ext == "":
			c.Header("Cache-Control", "no-cache")
		default:
			c.Header("Cache-Control", "public, max-age=31536000, immutable")
		}
		c.Header("Cache-Version", common.Version)
		c.Next()
	}
}
