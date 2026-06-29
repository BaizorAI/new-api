package moonshot

import (
	"testing"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/dto"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	"github.com/stretchr/testify/require"
)

func TestConvertOpenAIRequestKimiK2UsesOnlyAllowedSamplingParams(t *testing.T) {
	tests := []struct {
		name      string
		modelName string
	}{
		{name: "kimi k2.5", modelName: "kimi-k2.5"},
		{name: "kimi k2.6", modelName: "kimi-k2.6"},
		{name: "kimi k2.7 code", modelName: "kimi-k2.7-code"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := &dto.GeneralOpenAIRequest{
				Model:       tt.modelName,
				Temperature: common.GetPointer[float64](0.7),
				TopP:        common.GetPointer[float64](1.0),
			}
			info := &relaycommon.RelayInfo{
				ChannelMeta: &relaycommon.ChannelMeta{
					UpstreamModelName: tt.modelName,
				},
			}

			converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, request)

			require.NoError(t, err)
			convertedRequest, ok := converted.(*dto.GeneralOpenAIRequest)
			require.True(t, ok)
			require.NotNil(t, convertedRequest.Temperature)
			require.Equal(t, 1.0, *convertedRequest.Temperature)
			require.NotNil(t, convertedRequest.TopP)
			require.Equal(t, 0.95, *convertedRequest.TopP)
		})
	}
}

func TestConvertOpenAIRequestKimiK26KeepsOmittedTemperatureOmitted(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "kimi-k2.6",
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "kimi-k2.6",
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, request)

	require.NoError(t, err)
	convertedRequest, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Nil(t, convertedRequest.Temperature)
}

func TestConvertOpenAIRequestOtherMoonshotModelKeepsSamplingParams(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model:       "moonshot-v1-8k",
		Temperature: common.GetPointer[float64](0.7),
		TopP:        common.GetPointer[float64](1.0),
	}
	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "moonshot-v1-8k",
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, info, request)

	require.NoError(t, err)
	convertedRequest, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.NotNil(t, convertedRequest.Temperature)
	require.Equal(t, 0.7, *convertedRequest.Temperature)
	require.NotNil(t, convertedRequest.TopP)
	require.Equal(t, 1.0, *convertedRequest.TopP)
}

func TestGetModelListIncludesConfiguredKimiK27Code(t *testing.T) {
	require.Contains(t, (&Adaptor{}).GetModelList(), "kimi-k2.7-code")
}

func TestConvertOpenAIRequestSanitizesMoonshotToolParameters(t *testing.T) {
	request := &dto.GeneralOpenAIRequest{
		Model: "kimi-k2.7-code",
		Tools: []dto.ToolCallRequest{
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "shell_command",
					Parameters: map[string]any{
						"type": "object",
						"properties": map[string]any{
							"command": map[string]any{
								"description": "Command to run",
							},
							"mode": map[string]any{
								"type":     "string",
								"nullable": true,
								"enum":     []any{"safe", "", nil},
							},
							"timeout_ms": map[string]any{
								"type": "integer",
								"anyOf": []any{
									map[string]any{"type": "integer"},
									map[string]any{"type": "null"},
								},
							},
						},
					},
				},
			},
			{
				Type: "function",
				Function: dto.FunctionRequest{
					Name: "no_params",
				},
			},
		},
	}

	converted, err := (&Adaptor{}).ConvertOpenAIRequest(nil, moonshotRelayInfo("kimi-k2.7-code"), request)

	require.NoError(t, err)
	convertedRequest, ok := converted.(*dto.GeneralOpenAIRequest)
	require.True(t, ok)
	require.Len(t, convertedRequest.Tools, 2)

	params := convertedRequest.Tools[0].Function.Parameters.(map[string]any)
	require.Equal(t, "object", params["type"])
	properties := params["properties"].(map[string]any)
	command := properties["command"].(map[string]any)
	require.Equal(t, "string", command["type"])
	mode := properties["mode"].(map[string]any)
	require.NotContains(t, mode, "nullable")
	require.Equal(t, []any{"safe"}, mode["enum"])
	timeout := properties["timeout_ms"].(map[string]any)
	require.Equal(t, "integer", timeout["type"])
	require.NotContains(t, timeout, "anyOf")

	noParams := convertedRequest.Tools[1].Function.Parameters.(map[string]any)
	require.Equal(t, "object", noParams["type"])
	require.Equal(t, map[string]any{}, noParams["properties"])
}

func moonshotRelayInfo(modelName string) *relaycommon.RelayInfo {
	return &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: modelName,
		},
	}
}
