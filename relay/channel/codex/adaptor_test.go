package codex

import (
	"testing"

	"github.com/BaizorAI/new-api/dto"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	relayconstant "github.com/BaizorAI/new-api/relay/constant"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestConvertOpenAIResponsesRequestNormalizesDeveloperRole(t *testing.T) {
	req := dto.OpenAIResponsesRequest{
		Model: "huayu-v2",
		Input: []byte(`[
			{"type":"message","role":"developer","content":[{"type":"input_text","text":"rules"}]},
			{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]}
		]`),
	}
	info := &relaycommon.RelayInfo{
		RelayMode:   relayconstant.RelayModeResponses,
		ChannelMeta: &relaycommon.ChannelMeta{},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIResponsesRequest(nil, info, req)

	require.NoError(t, err)
	convertedReq, ok := converted.(dto.OpenAIResponsesRequest)
	require.True(t, ok)
	assert.Equal(t, "system", gjson.GetBytes(convertedReq.Input, "0.role").String())
	assert.Equal(t, "user", gjson.GetBytes(convertedReq.Input, "1.role").String())
	assert.JSONEq(t, `""`, string(convertedReq.Instructions))
	assert.JSONEq(t, `false`, string(convertedReq.Store))
}
