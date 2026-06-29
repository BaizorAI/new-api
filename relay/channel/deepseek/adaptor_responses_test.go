package deepseek

import (
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
)

func TestConvertOpenAIResponsesRequestAppliesDeepSeekV4ThinkingSuffix(t *testing.T) {
	stream := true
	req := dto.OpenAIResponsesRequest{
		Model:  "deepseek-v4-pro-max",
		Input:  mustDeepSeekRawMessage(t, "hello"),
		Stream: &stream,
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
	assert.Equal(t, "deepseek-v4-pro", chatReq.Model)
	assert.Equal(t, "deepseek-v4-pro", info.UpstreamModelName)
	assert.Equal(t, "max", chatReq.ReasoningEffort)
	assert.Equal(t, "max", info.ReasoningEffort)
	assert.JSONEq(t, `{"type":"enabled"}`, string(chatReq.THINKING))
	require.Len(t, chatReq.Messages, 1)
	assert.Equal(t, "user", chatReq.Messages[0].Role)
	assert.Equal(t, "hello", chatReq.Messages[0].Content)
	assert.Same(t, &stream, chatReq.Stream)
}

func TestDoResponseConvertsChatCompletionToResponses(t *testing.T) {
	oldMode := gin.Mode()
	gin.SetMode(gin.TestMode)
	t.Cleanup(func() { gin.SetMode(oldMode) })

	body := `{"id":"chatcmpl_1","object":"chat.completion","created":1710000000,"model":"deepseek-v4-pro","choices":[{"index":0,"message":{"role":"assistant","content":"hello"},"finish_reason":"stop"}],"usage":{"prompt_tokens":2,"completion_tokens":3,"total_tokens":5}}`
	c, recorder, resp, info := newDeepSeekResponsesContext(t, body)

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

func newDeepSeekResponsesContext(t *testing.T, body string) (*gin.Context, *httptest.ResponseRecorder, *http.Response, *relaycommon.RelayInfo) {
	t.Helper()

	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)
	c.Request = httptest.NewRequest(http.MethodPost, "/v1/responses", nil)
	c.Set(common.RequestIdKey, "deepseek-responses-test")

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Body:       io.NopCloser(strings.NewReader(body)),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "deepseek-v4-pro",
		},
		RelayMode:   relayconstant.RelayModeResponses,
		RelayFormat: types.RelayFormatOpenAIResponses,
	}
	return c, recorder, resp, info
}

func mustDeepSeekRawMessage(t *testing.T, value any) []byte {
	t.Helper()
	raw, err := common.Marshal(value)
	require.NoError(t, err)
	return raw
}
