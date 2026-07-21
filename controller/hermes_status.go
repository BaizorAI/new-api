package controller

import (
	"fmt"
	"net/http"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/gin-gonic/gin"
)

// GetHermesStatus probes the Hermes sidecar /health endpoint and reports
// whether it is reachable. The endpoint is admin-only because it exposes
// sidecar operational state.
func GetHermesStatus(c *gin.Context) {
	cfg := common.GetHermesConfig()

	if !cfg.SidecarEnabled {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "Hermes sidecar is not enabled",
			"data": gin.H{
				"healthy": false,
				"enabled": false,
			},
		})
		return
	}

	if cfg.APIURL == "" {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": "HERMES_API_SERVER_URL is not configured",
			"data": gin.H{
				"healthy": false,
				"enabled": true,
			},
		})
		return
	}

	healthURL := cfg.APIURL
	if healthURL[len(healthURL)-1] != '/' {
		healthURL += "/"
	}
	healthURL += "health"

	client := &http.Client{Timeout: 5 * time.Second}
	start := time.Now()
	resp, err := client.Get(healthURL)
	latency := time.Since(start).Milliseconds()

	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"success": true,
			"message": fmt.Sprintf("Hermes sidecar is unreachable: %v", err),
			"data": gin.H{
				"healthy":   false,
				"enabled":   true,
				"url":       cfg.APIURL,
				"latency_ms": latency,
			},
		})
		return
	}
	defer resp.Body.Close()

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "",
		"data": gin.H{
			"healthy":    resp.StatusCode == http.StatusOK,
			"enabled":    true,
			"url":        cfg.APIURL,
			"status_code": resp.StatusCode,
			"latency_ms": latency,
		},
	})
}
