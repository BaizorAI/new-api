package controller

import (
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"

	"github.com/BaizorAI/new-api/common"

	"github.com/gin-gonic/gin"
)

const defaultHermesDataRoot = "/hermes-data"

var hermesDeniedPathSegments = map[string]struct{}{
	".env":      {},
	".git":      {},
	"bin":       {},
	"cron":      {},
	"hooks":     {},
	"logs":      {},
	"memories":  {},
	"pairing":   {},
	"platforms": {},
	"sessions":  {},
	"skills":    {},
	"weixin":    {},
}

var hermesDeniedFilenames = map[string]struct{}{
	".skills_prompt_snapshot.json": {},
	"auth.json":                    {},
	"auth.lock":                    {},
	"channel_directory.json":       {},
	"config.yaml":                  {},
	"gateway.lock":                 {},
	"gateway.pid":                  {},
	"gateway_state.json":           {},
	"kanban.db":                    {},
	"response_store.db":            {},
	"state.db":                     {},
}

var hermesAllowedTopLevelDirs = map[string]struct{}{
	"_uploads":       {},
	"artifacts":      {},
	"audio_cache":    {},
	"document_cache": {},
	"downloads":      {},
	"files":          {},
	"home":           {},
	"image_cache":    {},
	"outputs":        {},
	"sandboxes":      {},
	"video_cache":    {},
	"workspace":      {},
}

func HermesPlaygroundFile(c *gin.Context) {
	relativePath, ok := normalizeHermesDataPath(c.Param("path"))
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid file path"})
		return
	}

	userID := c.GetInt("id")
	if !isHermesDataPathAllowed(relativePath, userID) {
		c.JSON(http.StatusForbidden, gin.H{"message": "file is not available"})
		return
	}

	root := filepath.Clean(common.GetEnvOrDefaultString("HERMES_DATA_DIR", defaultHermesDataRoot))
	filePath := filepath.Join(root, filepath.FromSlash(relativePath))
	rootWithSeparator := root + string(os.PathSeparator)
	if filePath != root && !strings.HasPrefix(filePath, rootWithSeparator) {
		c.JSON(http.StatusBadRequest, gin.H{"message": "invalid file path"})
		return
	}

	info, err := os.Stat(filePath)
	if err != nil || info.IsDir() {
		c.JSON(http.StatusNotFound, gin.H{"message": "file not found"})
		return
	}

	c.File(filePath)
}

func normalizeHermesDataPath(value string) (string, bool) {
	value = strings.TrimSpace(value)
	value = strings.TrimPrefix(value, "MEDIA:")
	value = strings.TrimPrefix(value, "/")
	value = strings.TrimPrefix(value, "opt/data/")
	value = strings.TrimPrefix(value, "hermes-data/")
	if value == "" || strings.Contains(value, "\x00") || strings.Contains(value, "\\") {
		return "", false
	}

	cleaned := filepath.ToSlash(filepath.Clean(filepath.FromSlash(value)))
	if cleaned == "." || strings.HasPrefix(cleaned, "../") || cleaned == ".." {
		return "", false
	}
	return cleaned, true
}

func isHermesDataPathAllowed(relativePath string, userID int) bool {
	parts := strings.Split(relativePath, "/")
	if len(parts) == 0 || parts[0] == "" {
		return false
	}

	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "." || part == ".." {
			return false
		}
		lower := strings.ToLower(part)
		if _, denied := hermesDeniedPathSegments[lower]; denied {
			return false
		}
		if _, denied := hermesDeniedFilenames[lower]; denied {
			return false
		}
		if strings.HasSuffix(lower, ".db") || strings.Contains(lower, ".db-") {
			return false
		}
	}

	if parts[0] == "baizor-users" {
		if len(parts) < 3 || parts[1] != strconv.Itoa(userID) {
			return false
		}
		_, ok := hermesAllowedTopLevelDirs[parts[2]]
		return ok
	}

	_, ok := hermesAllowedTopLevelDirs[parts[0]]
	return ok
}
