package middleware

import (
	"strings"

	"github.com/gin-gonic/gin"
)

const PlaygroundContextKey = "is_playground"

// PlaygroundPathRewrite rewrites /pg/... to /v1/... and sets a context flag,
// so all downstream code (Path2RelayMode, Distribute, relay handlers) sees
// standard /v1/ paths without needing per-path /pg/ checks.
func PlaygroundPathRewrite() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set(PlaygroundContextKey, true)
		c.Request.URL.Path = "/v1" + strings.TrimPrefix(c.Request.URL.Path, "/pg")
		c.Next()
	}
}
