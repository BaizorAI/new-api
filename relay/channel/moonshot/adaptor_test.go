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
