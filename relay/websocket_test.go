package relay

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestPrepareResponsesWSRequestBodyUnwrapsNestedCreateFrame(t *testing.T) {
	body := []byte(`{
		"type":"response.create",
		"response":{
			"model":"huayu-v2",
			"input":[
				{"type":"message","role":"developer","content":[{"type":"input_text","text":"rules"}],"internal_chat_message_metadata_passthrough":{"id":"1"}},
				{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]}
			],
			"tools":[
				{"type":"function","name":"read_file","description":"Read","parameters":{"type":"object"}},
				{"type":"namespace","name":"shell"}
			]
		}
	}`)

	got := prepareResponsesWSRequestBody(body, "upstream-model")

	require.JSONEq(t, `{
		"model":"upstream-model",
		"stream":true,
		"input":[
			{"type":"message","role":"system","content":[{"type":"input_text","text":"rules"}]},
			{"type":"message","role":"user","content":[{"type":"input_text","text":"hello"}]}
		],
		"tools":[
			{"type":"function","function":{"name":"read_file","description":"Read","parameters":{"type":"object"}}}
		]
	}`, string(got))
	assert.False(t, gjson.GetBytes(got, "response").Exists())
	assert.False(t, gjson.GetBytes(got, "type").Exists())
}

func TestPrepareResponsesWSRequestBodyKeepsFlatCreateFrameSupport(t *testing.T) {
	body := []byte(`{
		"type":"response.create",
		"model":"huayu-v2",
		"stream":true,
		"input":[{"type":"message","role":"developer","content":[{"type":"input_text","text":"rules"}]}]
	}`)

	got := prepareResponsesWSRequestBody(body, "")

	require.JSONEq(t, `{
		"model":"huayu-v2",
		"stream":true,
		"input":[{"type":"message","role":"system","content":[{"type":"input_text","text":"rules"}]}]
	}`, string(got))
}
