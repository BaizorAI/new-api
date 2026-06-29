package moonshot

import (
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/dto"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	relayconstant "github.com/BaizorAI/new-api/relay/constant"
	"github.com/BaizorAI/new-api/types"
	"github.com/gin-gonic/gin"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestConvertOpenAIResponsesRequestKimiK2UsesAllowedSamplingParams(t *testing.T) {
	temperature := 0.0
	topP := 0.1
	req := dto.OpenAIResponsesRequest{
		Model:       "kimi-k2.7-code",
		Input:       mustMoonshotRawMessage(t, "hello"),
		Temperature: &temperature,
		TopP:        &topP,
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: req.Model,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: req.Model,
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, info, req)

	require.NoError(t, err)
	chatReq, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.NotNil(t, chatReq.Temperature)
	assert.Equal(t, 1.0, *chatReq.Temperature)
	require.NotNil(t, chatReq.TopP)
	assert.Equal(t, 0.95, *chatReq.TopP)
	require.Len(t, chatReq.Messages, 1)
	assert.Equal(t, "user", chatReq.Messages[0].Role)
	assert.Equal(t, "hello", chatReq.Messages[0].Content)
}

func TestConvertOpenAIResponsesRequestFlattensNamespaceToolsAndDropsUnsupportedCustomTools(t *testing.T) {
	req := dto.OpenAIResponsesRequest{
		Model: "kimi-k2.7-code",
		Input: mustMoonshotRawMessage(t, "hello"),
		Tools: mustMoonshotRawMessage(t, []map[string]any{
			{
				"type": "namespace",
				"name": "workspace",
				"tools": []map[string]any{
					{
						"type":        "function",
						"name":        "shell_command",
						"description": "Run a shell command",
						"parameters": map[string]any{
							"type": "object",
						},
					},
					{
						"type":  "custom",
						"name":  "apply_patch",
						"input": "patch",
					},
				},
			},
			{
				"type": "custom",
				"name": "freeform",
			},
		}),
		ToolChoice: mustMoonshotRawMessage(t, map[string]any{
			"type": "namespace",
			"name": "workspace",
		}),
	}
	info := &relaycommon.RelayInfo{
		OriginModelName: req.Model,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: req.Model,
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, info, req)

	require.NoError(t, err)
	chatReq, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Len(t, chatReq.Tools, 1)
	assert.Equal(t, "function", chatReq.Tools[0].Type)
	assert.Equal(t, "shell_command", chatReq.Tools[0].Function.Name)
	assert.Contains(t, chatReq.Tools[0].Function.Description, "Namespace: workspace")
	assert.Nil(t, chatReq.ToolChoice)
}

func TestConvertOpenAIResponsesRequestDropsCustomToolCallHistory(t *testing.T) {
	req := dto.OpenAIResponsesRequest{
		Model: "kimi-k2.7-code",
		Input: mustMoonshotRawMessage(t, []map[string]any{
			{
				"role": "assistant",
				"content": []map[string]any{
					{"type": "output_text", "text": "before"},
				},
			},
			{
				"type":    "custom_tool_call",
				"call_id": "call_custom",
				"name":    "apply_patch",
				"input":   "patch body",
			},
			{
				"type":    "custom_tool_call_output",
				"call_id": "call_custom",
				"output":  "ok",
			},
			{
				"type":    "function_call_output",
				"call_id": "call_custom",
				"output":  "legacy custom output",
			},
			{
				"type":      "function_call",
				"call_id":   "call_lookup",
				"name":      "lookup",
				"arguments": map[string]any{"q": "x"},
			},
			{
				"type":    "function_call_output",
				"call_id": "call_lookup",
				"output":  map[string]any{"ok": true},
			},
		}),
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, moonshotResponsesRelayInfo(req.Model), req)

	require.NoError(t, err)
	chatReq, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Len(t, chatReq.Messages, 2)
	assert.Equal(t, "assistant", chatReq.Messages[0].Role)
	assert.Equal(t, "before", chatReq.Messages[0].StringContent())
	assert.Equal(t, "tool", chatReq.Messages[1].Role)
	assert.Equal(t, "call_lookup", chatReq.Messages[1].ToolCallId)

	toolCalls := chatReq.Messages[0].ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "function", toolCalls[0].Type)
	assert.Equal(t, "lookup", toolCalls[0].Function.Name)
	assert.Equal(t, "call_lookup", toolCalls[0].ID)
	assert.False(t, gjson.GetBytes(toolCalls[0].Custom, "type").Exists())
}

func TestConvertOpenAIResponsesRequestDropsResponsesItemsUnsupportedByMoonshotChat(t *testing.T) {
	req := dto.OpenAIResponsesRequest{
		Model: "kimi-k2.7-code",
		Input: mustMoonshotRawMessage(t, []map[string]any{
			{
				"type": "reasoning",
				"text": "hidden chain",
			},
			{
				"type": "computer_call",
				"id":   "call_computer",
			},
			{
				"type":    "custom_tool_call",
				"call_id": "call_custom",
				"name":    "apply_patch",
				"input":   "patch body",
			},
			{
				"type":    "function_call_output",
				"call_id": "call_custom",
				"output":  "custom result",
			},
			{
				"type": "message",
				"role": "user",
				"content": []map[string]any{
					{"type": "input_text", "text": "keep this"},
					{"type": "input_file", "file_data": "unsupported"},
					{"type": "input_audio", "input_audio": map[string]any{"data": "unsupported", "format": "wav"}},
				},
			},
			{
				"type": "message",
				"role": "user",
				"content": []map[string]any{
					{"type": "input_file", "file_data": "drop whole message"},
				},
			},
		}),
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, moonshotResponsesRelayInfo(req.Model), req)

	require.NoError(t, err)
	chatReq, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Len(t, chatReq.Messages, 1)
	assert.Equal(t, "user", chatReq.Messages[0].Role)
	assert.Equal(t, "keep this", chatReq.Messages[0].StringContent())
}

func TestConvertOpenAIResponsesRequestRejectsKimiK2ContextAboveSafeLimit(t *testing.T) {
	maxOutputTokens := uint(20_000)
	req := dto.OpenAIResponsesRequest{
		Model:           "kimi-k2.7-code",
		Input:           mustMoonshotRawMessage(t, "hello"),
		MaxOutputTokens: &maxOutputTokens,
	}
	info := moonshotResponsesRelayInfo(req.Model)
	info.SetEstimatePromptTokens(moonshotKimiK2ContextWindowTokens - moonshotKimiK2SafetyReserveTokens - 10_000)

	_, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, info, req)

	require.Error(t, err)
	var apiErr *types.NewAPIError
	require.True(t, errors.As(err, &apiErr))
	assert.Equal(t, http.StatusBadRequest, apiErr.StatusCode)
	assert.Equal(t, types.ErrorCodeInvalidRequest, apiErr.GetErrorCode())
	assert.Contains(t, apiErr.Error(), "context limit exceeded")
	assert.True(t, types.IsSkipRetryError(apiErr))
}

func TestDoResponseConvertsChatCompletionToResponses(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"chatcmpl_1","object":"chat.completion","created":1710000000,"model":"kimi-k2.7-code","choices":[{"index":0,"message":{"role":"assistant","content":"hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`
	c, recorder, resp, info := newMoonshotResponsesContext(t, body)

	usage, apiErr := (&Adaptor{}).DoResponse(c, resp, info)

	require.Nil(t, apiErr)
	usageDTO, ok := usage.(*dto.Usage)
	require.True(t, ok)
	assert.Equal(t, 2, usageDTO.PromptTokens)
	assert.Equal(t, 3, usageDTO.CompletionTokens)
	assert.Equal(t, 5, usageDTO.TotalTokens)

	got := recorder.Body.String()
	assert.Contains(t, got, `"object":"response"`)
	assert.Contains(t, got, `"type":"message"`)
	assert.Contains(t, got, `"type":"output_text"`)
	assert.Contains(t, got, `"text":"hello"`)
}

func newMoonshotResponsesContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "moonshot-responses-test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "kimi-k2.7-code",
		},
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAIResponses,
	}
	return c, recorder, resp, info
}

func mustMoonshotRawMessage(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := common.Marshal(value)
	require.NoError(t, err)
	return raw
}

func moonshotResponsesRelayInfo(modelName string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		OriginModelName: modelName,
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: modelName,
		},
	}
}
