package controller

import (
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
	"uploads":        {},
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
	"workspaces":     {},
}

var hermesAllowedRootFileExtensions = map[string]struct{}{
	".csv":  {},
	".doc":  {},
	".docx": {},
	".gif":  {},
	".jpeg": {},
	".jpg":  {},
	".json": {},
	".md":   {},
	".pdf":  {},
	".png":  {},
	".ppt":  {},
	".pptx": {},
	".txt":  {},
	".xlsx": {},
	".zip":  {},
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
		// Defense-in-depth: try stripping metadata suffixes from the
		// filename (e.g. "`（465KB，26页）") that LLMs sometimes append.
		if cleanPath, ok := tryCleanHermesFilename(root, filePath); ok {
			c.File(cleanPath)
			return
		}
		c.JSON(http.StatusNotFound, gin.H{"message": "file not found"})
		return
	}

	c.File(filePath)
}

// tryCleanHermesFilename attempts to find a file by stripping metadata
// suffixes that LLMs sometimes append to filenames (e.g. backtick-prefixed
// size/page annotations like "`（465KB，26页）"). Returns the cleaned path
// and true if a matching file exists.
func tryCleanHermesFilename(root string, filePath string) (string, bool) {
	dir := filepath.Dir(filePath)
	base := filepath.Base(filePath)

	// Strip trailing backtick-prefixed metadata: "`（...）" or "`(...)"
	if idx := strings.Index(base, "`"); idx > 0 {
		candidate := filepath.Join(dir, base[:idx])
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			prefix := root + string(os.PathSeparator)
			if strings.HasPrefix(candidate, prefix) || candidate == root {
				return candidate, true
			}
		}
	}

	// Strip full-width parenthesized suffix: "（...）"
	if idx := strings.Index(base, "\xef\xbc\x88"); idx > 0 {
		candidate := filepath.Join(dir, base[:idx])
		if info, err := os.Stat(candidate); err == nil && !info.IsDir() {
			prefix := root + string(os.PathSeparator)
			if strings.HasPrefix(candidate, prefix) || candidate == root {
				return candidate, true
			}
		}
	}

	return "", false
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

func isHermesIndexedResultFileAllowed(relativePath string, userID int) bool {
	if _, ok := hermesAllowedRootFileExtensions[strings.ToLower(filepath.Ext(relativePath))]; !ok {
		return false
	}
	if model.DB == nil {
		return false
	}
	allowed, err := model.HasAccessibleHermesResultHref(userID, hermesFileHrefCandidates(relativePath))
	return err == nil && allowed
}

func hermesFileHrefCandidates(relativePath string) []string {
	relativePath = strings.Trim(filepath.ToSlash(relativePath), "/")
	if relativePath == "" {
		return nil
	}
	parts := strings.Split(relativePath, "/")
	encodedParts := make([]string, 0, len(parts))
	for _, part := range parts {
		encodedParts = append(encodedParts, url.PathEscape(part))
	}
	return []string{
		"/pg/hermes/files/" + relativePath,
		"/pg/hermes/files/" + strings.Join(encodedParts, "/"),
	}
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

	if parts[0] == "teams" {
		if len(parts) < 3 {
			return false
		}
		teamID, err := strconv.Atoi(parts[1])
		if err != nil || teamID < 0 || model.DB == nil {
			return false
		}
		if teamID == 0 {
			if _, ok := hermesAllowedTopLevelDirs[parts[2]]; !ok {
				return false
			}
			// workspaces and home directories are user session-scoped;
			// allow direct file access without indexed result record.
			if parts[2] == "workspaces" || parts[2] == "home" {
				return true
			}
			return isHermesIndexedResultFileAllowed(relativePath, userID)
		}
		if _, err := model.GetTeamMember(teamID, userID); err != nil {
			return false
		}
		_, ok := hermesAllowedTopLevelDirs[parts[2]]
		return ok
	}

	if len(parts) == 1 {
		return isHermesIndexedResultFileAllowed(relativePath, userID)
	}

	_, ok := hermesAllowedTopLevelDirs[parts[0]]
	return ok
}
