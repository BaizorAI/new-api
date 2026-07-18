package service

import (
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"github.com/BaizorAI/new-api/model"
)

type HermesResultConversationInput struct {
	UserId          int
	TeamId          int
	ConversationId  string
	StorageScope    string
	HermesSessionId string
	Title           string
	Messages        []any
	UpdatedBy       int
}

var hermesMarkdownFilePattern = regexp.MustCompile(`\[([^\]]*)\]\((/pg/hermes/files/[^\s)]+)\)`)
var hermesRawDataPathPattern = regexp.MustCompile(`(?:MEDIA:)?(/(?:opt/data|hermes-data)/[^\s<>)\]}"'\x{ff08}\x{ff09}\x{60}]+)`)
var hermesTrailingPunctuationPattern = regexp.MustCompile(`[.,;:!?\x{ff0c}\x{3002}\x{ff1b}\x{ff1a}\x{ff01}\x{ff1f}\x{ff08}\x{ff09}]+$`)

func SyncHermesResultsFromConversation(input HermesResultConversationInput) error {
	conversationID := strings.TrimSpace(input.ConversationId)
	if conversationID == "" {
		return nil
	}
	results := ExtractHermesResultsFromConversation(input)
	return model.ReplaceHermesResultsForConversation(input.UserId, input.TeamId, conversationID, results)
}

func UpsertHermesResultsFromConversation(input HermesResultConversationInput) error {
	conversationID := strings.TrimSpace(input.ConversationId)
	if conversationID == "" {
		return nil
	}
	results := ExtractHermesResultsFromConversation(input)
	return model.UpsertHermesResults(input.UserId, input.TeamId, conversationID, results)
}

func ExtractHermesResultsFromConversation(input HermesResultConversationInput) []model.HermesResult {
	resultsByKey := map[string]model.HermesResult{}
	assistantMessageCount := 0

	for _, rawMessage := range input.Messages {
		message, ok := rawMessage.(map[string]any)
		if !ok {
			continue
		}
		messageKey := stringFromMap(message, "key")
		from := strings.TrimSpace(stringFromMap(message, "from"))
		for _, attachment := range arrayFromMap(message, "attachments") {
			attachmentMap, ok := attachment.(map[string]any)
			if !ok {
				continue
			}
			href := stringFromMap(attachmentMap, "url")
			if href == "" {
				continue
			}
			filename := stringFromMap(attachmentMap, "filename")
			if filename == "" {
				filename = filenameFromHref(href)
			}
			result := buildHermesResult(input, messageKey, model.HermesResultSourceAttachment, href, filename)
			result.MediaType = firstNonEmpty(stringFromMap(attachmentMap, "mediaType"), stringFromMap(attachmentMap, "media_type"))
			result.Size = int64FromAny(attachmentMap["size"])
			resultsByKey[resultDedupKey(result)] = result
		}

		if from != "assistant" {
			continue
		}
		assistantMessageCount += 1
		for _, version := range arrayFromMap(message, "versions") {
			versionMap, ok := version.(map[string]any)
			if !ok {
				continue
			}
			content := stringFromMap(versionMap, "content")
			for _, artifact := range extractHermesArtifacts(content) {
				result := buildHermesResult(input, messageKey, model.HermesResultSourceArtifact, artifact.href, artifact.filename)
				resultsByKey[resultDedupKey(result)] = result
			}
		}
	}

	if len(resultsByKey) == 0 && assistantMessageCount > 0 {
		result := buildHermesResult(input, "", model.HermesResultSourceConversation, "", strings.TrimSpace(input.Title))
		result.ResultType = model.HermesResultTypeDocument
		resultsByKey[resultDedupKey(result)] = result
	}

	results := make([]model.HermesResult, 0, len(resultsByKey))
	for _, result := range resultsByKey {
		results = append(results, result)
	}
	return results
}

func buildHermesResult(input HermesResultConversationInput, messageKey string, source string, href string, filename string) model.HermesResult {
	title := strings.TrimSpace(input.Title)
	filename = strings.TrimSpace(filename)
	if title == "" {
		title = filename
	}
	if filename == "" && source == model.HermesResultSourceConversation {
		filename = title
	}
	return model.HermesResult{
		UserId:          input.UserId,
		TeamId:          input.TeamId,
		ConversationId:  strings.TrimSpace(input.ConversationId),
		StorageScope:    strings.TrimSpace(input.StorageScope),
		HermesSessionId: strings.TrimSpace(input.HermesSessionId),
		Title:           truncateString(title, 255),
		FileName:        truncateString(filename, 255),
		Href:            strings.TrimSpace(href),
		ResultType:      inferHermesResultType(filename, href, ""),
		Source:          source,
		SourceMessageId: truncateString(strings.TrimSpace(messageKey), 128),
		CreatedBy:       input.UpdatedBy,
		UpdatedBy:       input.UpdatedBy,
	}
}

type hermesArtifact struct {
	href     string
	filename string
}

func extractHermesArtifacts(content string) []hermesArtifact {
	content = stripThinkTags(content)
	artifactsByHref := map[string]hermesArtifact{}
	for _, match := range hermesMarkdownFilePattern.FindAllStringSubmatch(content, -1) {
		if len(match) < 3 {
			continue
		}
		href := strings.TrimSpace(match[2])
		if href == "" {
			continue
		}
		filename := filenameFromHref(href)
		if filename == "" {
			filename = strings.TrimSpace(match[1])
		}
		artifactsByHref[href] = hermesArtifact{href: href, filename: filename}
	}
	for _, match := range hermesRawDataPathPattern.FindAllStringSubmatch(content, -1) {
		if len(match) < 2 {
			continue
		}
		href, filename := hrefFromHermesDataPath(match[1])
		if href == "" {
			continue
		}
		artifactsByHref[href] = hermesArtifact{href: href, filename: filename}
	}

	artifacts := make([]hermesArtifact, 0, len(artifactsByHref))
	for _, artifact := range artifactsByHref {
		artifacts = append(artifacts, artifact)
	}
	return artifacts
}

func hrefFromHermesDataPath(rawPath string) (string, string) {
	cleanPath := hermesTrailingPunctuationPattern.ReplaceAllString(strings.TrimSpace(rawPath), "")
	cleanPath = strings.TrimPrefix(cleanPath, "/opt/data/")
	cleanPath = strings.TrimPrefix(cleanPath, "/hermes-data/")
	cleanPath = strings.TrimPrefix(cleanPath, "opt/data/")
	cleanPath = strings.TrimPrefix(cleanPath, "hermes-data/")
	cleanPath = strings.Trim(cleanPath, "/")
	if cleanPath == "" || strings.Contains(cleanPath, "\x00") {
		return "", ""
	}
	parts := strings.Split(cleanPath, "/")
	encoded := make([]string, 0, len(parts))
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if part == "" || part == "." || part == ".." {
			return "", ""
		}
		encoded = append(encoded, url.PathEscape(part))
	}
	filename := parts[len(parts)-1]
	return "/pg/hermes/files/" + strings.Join(encoded, "/"), filename
}

func filenameFromHref(href string) string {
	href = strings.TrimSpace(href)
	if href == "" {
		return ""
	}
	if parsed, err := url.Parse(href); err == nil && parsed.Path != "" {
		href = parsed.Path
	}
	parts := strings.Split(strings.Trim(href, "/"), "/")
	if len(parts) == 0 {
		return ""
	}
	filename := parts[len(parts)-1]
	if decoded, err := url.PathUnescape(filename); err == nil {
		return decoded
	}
	return filename
}

func inferHermesResultType(values ...string) string {
	haystack := strings.ToLower(strings.Join(values, " "))
	if strings.Contains(haystack, ".ppt") || strings.Contains(haystack, "powerpoint") || strings.Contains(haystack, "presentation") {
		return model.HermesResultTypePPT
	}
	if strings.Contains(haystack, "report") || strings.Contains(haystack, "research") || strings.Contains(haystack, "\u62a5\u544a") || strings.Contains(haystack, "\u8c03\u7814") {
		return model.HermesResultTypeReport
	}
	extSource := ""
	if len(values) > 0 {
		extSource = values[0]
	}
	ext := strings.ToLower(filepath.Ext(strings.TrimSpace(extSource)))
	switch ext {
	case ".doc", ".docx", ".md", ".pdf", ".txt", ".xlsx", ".xls", ".csv":
		return model.HermesResultTypeDocument
	default:
		return model.HermesResultTypeAttachment
	}
}

func stripThinkTags(content string) string {
	for {
		start := strings.Index(strings.ToLower(content), "<think>")
		if start < 0 {
			return content
		}
		end := strings.Index(strings.ToLower(content[start:]), "</think>")
		if end < 0 {
			return strings.TrimSpace(content[:start])
		}
		content = content[:start] + content[start+end+len("</think>"):]
	}
}

func resultDedupKey(result model.HermesResult) string {
	return strings.Join([]string{result.Source, result.Href, result.FileName}, "|")
}

func arrayFromMap(value map[string]any, key string) []any {
	items, ok := value[key].([]any)
	if !ok {
		return nil
	}
	return items
}

func stringFromMap(value map[string]any, key string) string {
	str, ok := value[key].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(str)
}

func int64FromAny(value any) int64 {
	switch typed := value.(type) {
	case int64:
		return typed
	case int:
		return int64(typed)
	case float64:
		return int64(typed)
	case string:
		parsed, err := strconv.ParseInt(strings.TrimSpace(typed), 10, 64)
		if err == nil {
			return parsed
		}
	}
	return 0
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func truncateString(value string, limit int) string {
	if len(value) <= limit {
		return value
	}
	return value[:limit]
}
