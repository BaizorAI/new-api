package dto

import (
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestResponsesOutputReasoningJSON(t *testing.T) {
	summary := []ResponsesReasoningSummaryPart{}
	item := ResponsesOutput{
		Type:    "reasoning",
		ID:      "rs_test",
		Status:  "in_progress",
		Summary: &summary,
	}
	b, err := common.Marshal(item)
	require.NoError(t, err)
	json := string(b)

	// Must have summary field
	assert.Contains(t, json, `"summary":[]`)
	// Must not have role (omitempty, empty string)
	assert.NotContains(t, json, `"role"`)
	// Must not have quality or size (omitempty)
	assert.NotContains(t, json, `"quality"`)
	assert.NotContains(t, json, `"size"`)
	// Content is without omitempty — nil → null
	assert.Contains(t, json, `"content":null`)
}

func TestResponsesOutputMessageJSON(t *testing.T) {
	item := ResponsesOutput{
		Type:    "message",
		ID:      "msg_test",
		Status:  "in_progress",
		Role:    "assistant",
		Content: []ResponsesOutputContent{},
	}
	b, err := common.Marshal(item)
	require.NoError(t, err)
	json := string(b)

	// Must have role for message items
	assert.Contains(t, json, `"role":"assistant"`)
	// Must have content (even empty)
	assert.Contains(t, json, `"content":[]`)
	// Must not have summary (nil, omitempty)
	assert.NotContains(t, json, `"summary"`)
}
