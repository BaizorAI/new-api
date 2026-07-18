package controller

import (
	"encoding/xml"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/model"
	"github.com/gin-gonic/gin"
)

// blogBaseURL returns the canonical frontend base URL for blog links.
// It prefers FRONTEND_BASE_URL and falls back to the request scheme/host.
func blogBaseURL(c *gin.Context) string {
	base := strings.TrimSpace(common.GetEnvOrDefaultString("FRONTEND_BASE_URL", ""))
	if base != "" {
		return strings.TrimRight(base, "/")
	}
	scheme := "http"
	if c.Request.TLS != nil {
		scheme = "https"
	}
	if forwardedProto := c.GetHeader("X-Forwarded-Proto"); forwardedProto != "" {
		scheme = forwardedProto
	}
	return scheme + "://" + c.Request.Host
}

func blogAbsolutePath(c *gin.Context, path string) string {
	base := blogBaseURL(c)
	path = "/" + strings.TrimLeft(path, "/")
	return base + path
}

func formatBlogTime(t int64) string {
	if t <= 0 {
		return ""
	}
	return time.Unix(t, 0).UTC().Format(time.RFC3339)
}

func formatBlogRSSPubDate(t int64) string {
	if t <= 0 {
		return ""
	}
	return time.Unix(t, 0).UTC().Format(time.RFC1123Z)
}

// ============================================================================
// Sitemap
// ============================================================================

type sitemapURL struct {
	XMLName    xml.Name `xml:"url"`
	Loc        string   `xml:"loc"`
	LastMod    string   `xml:"lastmod,omitempty"`
	ChangeFreq string   `xml:"changefreq,omitempty"`
	Priority   string   `xml:"priority,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	Xmlns   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

// GetBlogSitemapXML serves /sitemap.xml for public blog content.
func GetBlogSitemapXML(c *gin.Context) {
	articles, _, err := model.GetAllBlogArticles(0, model.BlogArticleStatusPublished, 0, 50000)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	authors, _, err := model.GetPublicAuthorProfiles(0, 50000)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	tags, err := model.GetPublishedBlogTags(50000)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	urls := make([]sitemapURL, 0, 2+len(articles)+len(authors)+len(tags))
	urls = append(urls,
		sitemapURL{Loc: blogAbsolutePath(c, "/blog"), ChangeFreq: "daily", Priority: "0.9"},
		sitemapURL{Loc: blogAbsolutePath(c, "/blog/authors"), ChangeFreq: "weekly", Priority: "0.6"},
	)

	for _, a := range articles {
		urls = append(urls, sitemapURL{
			Loc:        blogAbsolutePath(c, "/blog/"+a.Guid),
			LastMod:    formatBlogTime(a.UpdatedTime),
			ChangeFreq: "weekly",
			Priority:   "0.8",
		})
	}

	for _, author := range authors {
		urls = append(urls, sitemapURL{
			Loc:        blogAbsolutePath(c, "/blog/authors/"+url.PathEscape(author.Slug)),
			ChangeFreq: "weekly",
			Priority:   "0.6",
		})
	}

	for _, tag := range tags {
		urls = append(urls, sitemapURL{
			Loc:        blogAbsolutePath(c, "/blog/tags/"+url.PathEscape(tag.Tag)),
			ChangeFreq: "weekly",
			Priority:   "0.5",
		})
	}

	set := sitemapURLSet{
		Xmlns: "http://www.sitemaps.org/schemas/sitemap/0.9",
		URLs:  urls,
	}
	output, err := xml.MarshalIndent(set, "", "  ")
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.Header("Content-Type", "application/xml; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=3600")
	c.Data(http.StatusOK, "application/xml; charset=utf-8", append([]byte(xml.Header), output...))
}

// ============================================================================
// RSS feed
// ============================================================================

type rssItem struct {
	XMLName     xml.Name `xml:"item"`
	Title       string   `xml:"title"`
	Link        string   `xml:"link"`
	Description string   `xml:"description"`
	PubDate     string   `xml:"pubDate,omitempty"`
	GUID        string   `xml:"guid"`
}

type rssChannel struct {
	XMLName     xml.Name  `xml:"channel"`
	Title       string    `xml:"title"`
	Link        string    `xml:"link"`
	Description string    `xml:"description"`
	Language    string    `xml:"language"`
	LastBuild   string    `xml:"lastBuildDate"`
	Items       []rssItem `xml:"item"`
}

type rssDocument struct {
	XMLName xml.Name   `xml:"rss"`
	Version string     `xml:"version,attr"`
	Channel rssChannel `xml:"channel"`
}

// GetBlogRSSXML serves /rss.xml with recent published articles.
func GetBlogRSSXML(c *gin.Context) {
	articles, _, err := model.GetAllBlogArticles(0, model.BlogArticleStatusPublished, 0, 20)
	if err != nil {
		common.ApiError(c, err)
		return
	}

	baseURL := blogBaseURL(c)
	blogURL := blogAbsolutePath(c, "/blog")

	items := make([]rssItem, 0, len(articles))
	for _, a := range articles {
		desc := strings.TrimSpace(a.Summary)
		if desc == "" {
			desc = strings.TrimSpace(stripBlogHTML(a.Content))
			if len(desc) > 300 {
				desc = desc[:300] + "..."
			}
		}
		items = append(items, rssItem{
			Title:       a.Title,
			Link:        blogAbsolutePath(c, "/blog/"+a.Guid),
			Description: desc,
			PubDate:     formatBlogRSSPubDate(a.PublishedAt),
			GUID:        blogAbsolutePath(c, "/blog/"+a.Guid),
		})
	}

	feed := rssDocument{
		Version: "2.0",
		Channel: rssChannel{
			Title:       "Blog",
			Link:        blogURL,
			Description: "Latest published articles",
			Language:    "en",
			LastBuild:   time.Now().UTC().Format(time.RFC1123Z),
			Items:       items,
		},
	}

	// Brand the feed if a site name is configured.
	if siteName := common.GetEnvOrDefaultString("SYSTEM_NAME", ""); siteName != "" {
		feed.Channel.Title = siteName + " Blog"
	}
	feed.Channel.Link = baseURL + "/blog"

	output, err := xml.MarshalIndent(feed, "", "  ")
	if err != nil {
		common.ApiError(c, err)
		return
	}

	c.Header("Content-Type", "application/rss+xml; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=1800")
	c.Data(http.StatusOK, "application/rss+xml; charset=utf-8", append([]byte(xml.Header), output...))
}

// stripBlogHTML is a minimal HTML stripper safe for RSS descriptions.
func stripBlogHTML(input string) string {
	var sb strings.Builder
	inTag := false
	for _, r := range input {
		switch r {
		case '<':
			inTag = true
		case '>':
			inTag = false
		default:
			if !inTag {
				sb.WriteRune(r)
			}
		}
	}
	return sb.String()
}

// ============================================================================
// robots.txt
// ============================================================================

// GetRobotsTXT serves /robots.txt.
func GetRobotsTXT(c *gin.Context) {
	base := blogBaseURL(c)
	body := fmt.Sprintf("User-agent: *\nAllow: /\nSitemap: %s/sitemap.xml\n", base)
	c.Header("Content-Type", "text/plain; charset=utf-8")
	c.Header("Cache-Control", "public, max-age=86400")
	c.Data(http.StatusOK, "text/plain; charset=utf-8", []byte(body))
}

