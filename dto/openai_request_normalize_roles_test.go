package dto

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestNormalizeChatMessageRoles(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"developer becomes system", "developer", "system"},
		{"empty becomes user", "", "user"},
		{"system unchanged", "system", "system"},
		{"user unchanged", "user", "user"},
		{"assistant unchanged", "assistant", "assistant"},
		{"tool unchanged", "tool", "tool"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := &GeneralOpenAIRequest{
				Messages: []Message{
					{Role: tt.input, Content: "test"},
				},
			}
			req.NormalizeChatMessageRoles()
			assert.Equal(t, tt.expected, req.Messages[0].Role)
		})
	}
}

func TestNormalizeChatMessageRolesMultipleMessages(t *testing.T) {
	req := &GeneralOpenAIRequest{
		Messages: []Message{
			{Role: "developer", Content: "system instructions"},
			{Role: "user", Content: "hello"},
			{Role: "assistant", Content: "hi"},
			{Role: "", Content: "follow-up"},
			{Role: "developer", Content: "more instructions"},
		},
	}
	req.NormalizeChatMessageRoles()

	assert.Equal(t, "system", req.Messages[0].Role)
	assert.Equal(t, "user", req.Messages[1].Role)
	assert.Equal(t, "assistant", req.Messages[2].Role)
	assert.Equal(t, "user", req.Messages[3].Role)
	assert.Equal(t, "system", req.Messages[4].Role)
}
