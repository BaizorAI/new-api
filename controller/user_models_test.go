package controller

import (
	"testing"

	"github.com/BaizorAI/new-api/constant"
	"github.com/stretchr/testify/assert"
)

func TestModelSupportsChatEndpoint(t *testing.T) {
	tests := []struct {
		name      string
		modelName string
		endpoints []constant.EndpointType
		want      bool
	}{
		{
			name:      "openai chat completion endpoint is chat capable",
			modelName: "gpt-5.5",
			endpoints: []constant.EndpointType{constant.EndpointTypeOpenAI},
			want:      true,
		},
		{
			name:      "anthropic native endpoint can be used for chat",
			modelName: "claude-sonnet-4",
			endpoints: []constant.EndpointType{constant.EndpointTypeAnthropic},
			want:      true,
		},
		{
			name:      "responses endpoint is chat capable through platform conversion",
			modelName: "o3-pro",
			endpoints: []constant.EndpointType{constant.EndpointTypeOpenAIResponse},
			want:      true,
		},
		{
			name:      "embedding models are not chat capable",
			modelName: "text-embedding-3-large",
			endpoints: []constant.EndpointType{constant.EndpointTypeOpenAI},
			want:      false,
		},
		{
			name:      "codex models do not support chat completions",
			modelName: "gpt-5.3-codex",
			endpoints: []constant.EndpointType{constant.EndpointTypeOpenAI},
			want:      false,
		},
		{
			name:      "image generation models are not chat capable even when channel also exposes openai",
			modelName: "gpt-image-1",
			endpoints: []constant.EndpointType{constant.EndpointTypeImageGeneration, constant.EndpointTypeOpenAI},
			want:      false,
		},
		{
			name:      "rerank endpoint is not chat capable",
			modelName: "jina-reranker-v2",
			endpoints: []constant.EndpointType{constant.EndpointTypeJinaRerank},
			want:      false,
		},
		{
			name:      "unknown endpoint metadata is not chat capable",
			modelName: "custom-batch-model",
			endpoints: nil,
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			assert.Equal(t, tt.want, modelSupportsChatEndpoint(tt.modelName, tt.endpoints))
		})
	}
}
