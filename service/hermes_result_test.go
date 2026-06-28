package service

import (
	"testing"

	"github.com/BaizorAI/new-api/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestExtractHermesResultsFromConversationFindsArtifactsAndAttachments(t *testing.T) {
	input := HermesResultConversationInput{
		UserId:          7,
		ConversationId:  "conversation-1",
		StorageScope:    "scope-1",
		HermesSessionId: "session-1",
		Title:           "Research session",
		UpdatedBy:       7,
		Messages: []any{
			map[string]any{
				"key":  "user-1",
				"from": "user",
				"attachments": []any{
					map[string]any{
						"url":        "/pg/hermes/files/source.csv",
						"filename":   "source.csv",
						"media_type": "text/csv",
						"size":       float64(120),
					},
				},
			},
			map[string]any{
				"key":  "assistant-1",
				"from": "assistant",
				"versions": []any{
					map[string]any{
						"content": "<think>hidden</think>Done [report](/pg/hermes/files/%E8%B0%83%E7%A0%94%E6%8A%A5%E5%91%8A.md) and /opt/data/baizor-users/7/results/deck.pptx",
					},
				},
			},
		},
	}

	results := ExtractHermesResultsFromConversation(input)
	require.Len(t, results, 3)

	byName := map[string]model.HermesResult{}
	for _, result := range results {
		byName[result.FileName] = result
	}

	assert.Equal(t, model.HermesResultSourceAttachment, byName["source.csv"].Source)
	assert.Equal(t, int64(120), byName["source.csv"].Size)
	assert.Equal(t, model.HermesResultTypeReport, byName["\u8c03\u7814\u62a5\u544a.md"].ResultType)
	assert.Equal(t, model.HermesResultTypePPT, byName["deck.pptx"].ResultType)
	assert.Equal(t, "/pg/hermes/files/baizor-users/7/results/deck.pptx", byName["deck.pptx"].Href)
}

func TestExtractHermesResultsFromConversationCreatesDocumentFallback(t *testing.T) {
	input := HermesResultConversationInput{
		UserId:         7,
		ConversationId: "conversation-2",
		Title:          "Plain answer",
		Messages: []any{
			map[string]any{
				"key":  "assistant-1",
				"from": "assistant",
				"versions": []any{
					map[string]any{"content": "A useful answer without files."},
				},
			},
		},
	}

	results := ExtractHermesResultsFromConversation(input)
	require.Len(t, results, 1)
	assert.Equal(t, model.HermesResultSourceConversation, results[0].Source)
	assert.Equal(t, model.HermesResultTypeDocument, results[0].ResultType)
	assert.Equal(t, "Plain answer", results[0].FileName)
}
