package router

import (
	"embed"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/controller"
	"github.com/BaizorAI/new-api/middleware"
	"github.com/gin-contrib/gzip"
	"github.com/gin-contrib/static"
	"github.com/gin-gonic/gin"
)

// ThemeAssets holds the embedded frontend assets.
type ThemeAssets struct {
	BuildFS   embed.FS
	IndexPage []byte
}

func cleanDistAssetPath(path string) (string, bool) {
	relPath := strings.TrimPrefix(path, "/")
	cleanPath := filepath.Clean(filepath.FromSlash(relPath))
	if cleanPath == "." || cleanPath == ".." || filepath.IsAbs(cleanPath) || strings.HasPrefix(cleanPath, ".."+string(os.PathSeparator)) {
		return "", false
	}
	return cleanPath, true
}

func cleanStaticAssetPath(path string) (string, bool) {
	cleanPath, ok := cleanDistAssetPath(path)
	staticPrefix := "static" + string(os.PathSeparator)
	if !ok || !strings.HasPrefix(cleanPath, staticPrefix) {
		return "", false
	}
	return cleanPath, true
}

func preservedStaticCandidates(root string, cleanPath string) []string {
	candidates := []string{filepath.Join(root, "current", cleanPath)}
	releasesRoot := filepath.Join(root, "releases")
	entries, err := os.ReadDir(releasesRoot)
	if err != nil {
		return candidates
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() > entries[j].Name()
	})
	for _, entry := range entries {
		if entry.IsDir() {
			candidates = append(candidates, filepath.Join(releasesRoot, entry.Name(), cleanPath))
		}
	}
	return candidates
}

func serveFileCandidate(c *gin.Context, candidates []string) bool {
	for _, candidate := range candidates {
		info, err := os.Stat(candidate)
		if err == nil && !info.IsDir() {
			c.File(candidate)
			c.Abort()
			return true
		}
	}
	return false
}

func servePreservedStaticAssets(root string) gin.HandlerFunc {
	return func(c *gin.Context) {
		if root == "" || !strings.HasPrefix(c.Request.URL.Path, "/static/") {
			c.Next()
			return
		}

		cleanPath, ok := cleanStaticAssetPath(c.Request.URL.Path)
		if !ok || serveFileCandidate(c, preservedStaticCandidates(root, cleanPath)) {
			if !ok {
				c.Next()
			}
			return
		}

		c.Next()
	}
}

func serveVersionedAssets(root string, currentFS http.FileSystem) gin.HandlerFunc {
	return func(c *gin.Context) {
		if !strings.HasPrefix(c.Request.URL.Path, "/assets/") {
			c.Next()
			return
		}

		remainder := strings.TrimPrefix(c.Request.URL.Path, "/assets/")
		buildID, assetPath, ok := strings.Cut(remainder, "/")
		if !ok || buildID == "" {
			controller.RelayNotFound(c)
			return
		}

		cleanPath, ok := cleanDistAssetPath("/" + assetPath)
		if !ok {
			controller.RelayNotFound(c)
			return
		}

		if buildID == common.Version {
			if file, err := currentFS.Open(filepath.ToSlash(cleanPath)); err == nil {
				_ = file.Close()
				c.FileFromFS(filepath.ToSlash(cleanPath), currentFS)
				c.Abort()
				return
			}
		}

		if root != "" {
			candidates := []string{filepath.Join(root, "releases", buildID, cleanPath)}
			if buildID == common.Version {
				candidates = append(candidates, filepath.Join(root, "current", cleanPath))
			}
			if serveFileCandidate(c, candidates) {
				return
			}
		}

		controller.RelayNotFound(c)
	}
}

func SetWebRouter(router *gin.Engine, assets ThemeAssets) {
	fs := common.EmbedFolder(assets.BuildFS, "web/default/dist")
	preservedStaticRoot := common.GetEnvOrDefaultString("WEB_ASSETS_DIR", "/app/web-assets")

	// CLI login short URL: /code/token?token=xxx -> /keys?login_token=xxx
	router.GET("/code/token", func(c *gin.Context) {
		token := c.Query("token")
		c.Redirect(http.StatusFound, "/keys?login_token="+token)
	})

	router.Use(gzip.Gzip(gzip.DefaultCompression))
	router.Use(middleware.GlobalWebRateLimit())
	router.Use(middleware.Cache())
	router.GET("/version.json", func(c *gin.Context) {
		assetBase := "/assets/" + common.Version + "/"
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, private, max-age=0")
		c.Header("Cache-Version", common.Version)
		body, err := common.Marshal(gin.H{
			"version":      common.Version,
			"buildId":      common.Version,
			"cacheVersion": common.Version,
			"assetBase":    assetBase,
		})
		if err != nil {
			c.Status(http.StatusInternalServerError)
			return
		}
		c.Data(http.StatusOK, "application/json; charset=utf-8", body)
	})
	router.GET("/sitemap.xml", middleware.CriticalRateLimit(), controller.GetBlogSitemapXML)
	router.GET("/rss.xml", middleware.CriticalRateLimit(), controller.GetBlogRSSXML)
	router.GET("/robots.txt", controller.GetRobotsTXT)

	router.Use(serveVersionedAssets(preservedStaticRoot, fs))
	router.Use(servePreservedStaticAssets(preservedStaticRoot))
	router.Use(static.Serve("/", fs))
	router.NoRoute(func(c *gin.Context) {
		c.Set(middleware.RouteTagKey, "web")
		if strings.HasPrefix(c.Request.RequestURI, "/v1") || strings.HasPrefix(c.Request.RequestURI, "/api") || strings.HasPrefix(c.Request.RequestURI, "/assets") {
			controller.RelayNotFound(c)
			return
		}
		c.Header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
		c.Header("Pragma", "no-cache")
		c.Data(http.StatusOK, "text/html; charset=utf-8", assets.IndexPage)
	})
}
