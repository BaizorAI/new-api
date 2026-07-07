package relayconvert

import (
	"testing"

	"github.com/BaizorAI/new-api/dto"
	"github.com/samber/lo"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/tidwall/gjson"
)

func TestChatCompletionsRequestToResponsesRequestInstructionsAndTools(t *testing.T) {
	req := &dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		N:     lo.ToPtr(1),
		Messages: []dto.Message{
			{Role: "system", Content: "system rules"},
			{Role: "developer", Content: "developer rules"},
			{Role: "user", Content: []any{
				map[string]any{"type": "text", "text": "look"},
				map[string]any{"type": "image_url", "image_url": map[string]any{"url": "https://example.test/a.png"}},
			}},
			assistantMessageWithTool("partial text", "call_1", "lookup", `{"q":"x"}`),
			{Role: "tool", ToolCallId: "call_1", Content: "tool result"},
		},
	}

	got, err := ChatCompletionsRequestToResponsesRequest(req)
	require.NoError(t, err)

	assert.Equal(t, "gpt-test", got.Model)
	assert.Equal(t, `"system rules\n\ndeveloper rules"`, string(got.Instructions))
	assert.Equal(t, "input_image", gjson.GetBytes(got.Input, "0.content.1.type").String())
	assert.Equal(t, "function_call", gjson.GetBytes(got.Input, "2.type").String())
	assert.Equal(t, "call_1", gjson.GetBytes(got.Input, "2.call_id").String())
	assert.Equal(t, "function_call_output", gjson.GetBytes(got.Input, "3.type").String())
}

func TestChatCompletionsRequestToResponsesRequestRejectsMultipleChoices(t *testing.T) {
	_, err := ChatCompletionsRequestToResponsesRequest(&dto.GeneralOpenAIRequest{
		Model: "gpt-test",
		N:     lo.ToPtr(2),
	})
	require.Error(t, err)
	assert.Contains(t, err.Error(), "n>1")
}

func TestResponsesResponseToChatCompletionsPreservesTextAndToolCalls(t *testing.T) {
	resp := &dto.OpenAIResponsesResponse{
		ID:        "resp_1",
		CreatedAt: 123,
		Model:     "gpt-test",
		Status:    []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{
				Type: responsesOutputTypeMessage,
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: "I will call a tool."},
				},
			},
			{
				Type:      responsesOutputTypeFunctionCall,
				ID:        "fc_1",
				CallId:    "call_1",
				Name:      "lookup",
				Arguments: []byte(`{"q":"x"}`),
			},
		},
		Usage: &dto.Usage{InputTokens: 3, OutputTokens: 4, TotalTokens: 7},
	}

	chat, usage, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_1")
	require.NoError(t, err)
	require.NotNil(t, usage)

	require.Len(t, chat.Choices, 1)
	assert.Equal(t, "tool_calls", chat.Choices[0].FinishReason)
	assert.Equal(t, "I will call a tool.", chat.Choices[0].Message.StringContent())
	toolCalls := chat.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, "call_1", toolCalls[0].ID)
	assert.Equal(t, "lookup", toolCalls[0].Function.Name)
	assert.Equal(t, `{"q":"x"}`, toolCalls[0].Function.Arguments)
	assert.Equal(t, 7, usage.TotalTokens)
}

func TestResponsesResponseToChatCompletionsPreservesReasoningSummary(t *testing.T) {
	summary := []dto.ResponsesReasoningSummaryPart{
		{Type: "summary_text", Text: "first summary"},
		{Type: "summary_text", Text: "\n\nsecond summary"},
	}
	resp := &dto.OpenAIResponsesResponse{
		ID:     "resp_1",
		Model:  "gpt-test",
		Status: []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{
				Type:    responsesOutputTypeReasoning,
				Summary: &summary,
			},
			{
				Type: responsesOutputTypeMessage,
				Role: "assistant",
				Content: []dto.ResponsesOutputContent{
					{Type: "output_text", Text: "final"},
				},
			},
		},
	}

	chat, _, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_1")
	require.NoError(t, err)
	assert.Equal(t, "first summary\n\nsecond summary", chat.Choices[0].Message.GetReasoningContent())
	assert.Equal(t, "final", chat.Choices[0].Message.StringContent())
}

func TestResponsesResponseToChatCompletionsReasoningContentFallback(t *testing.T) {
	// Backward compatibility: reasoning stored in Content (legacy format)
	resp := &dto.OpenAIResponsesResponse{
		ID:     "resp_2",
		Model:  "gpt-test",
		Status: []byte(`"completed"`),
		Output: []dto.ResponsesOutput{
			{
				Type: responsesOutputTypeReasoning,
				Content: []dto.ResponsesOutputContent{
					{Type: "summary_text", Text: "legacy reasoning"},
				},
			},
		},
	}

	chat, _, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_2")
	require.NoError(t, err)
	assert.Equal(t, "legacy reasoning", chat.Choices[0].Message.GetReasoningContent())
}

func TestResponsesFinishReasonFromIncompleteStatus(t *testing.T) {
	tests := []struct {
		name   string
		reason string
		want   string
	}{
		{name: "max output", reason: responsesIncompleteReasonMaxTokens, want: "length"},
		{name: "content filter", reason: responsesIncompleteReasonContentFilter, want: "content_filter"},
		{name: "unknown", reason: "other", want: "length"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, ok := ResponsesFinishReasonFromStatus(&dto.OpenAIResponsesResponse{
				Status:            []byte(`"incomplete"`),
				IncompleteDetails: &dto.IncompleteDetails{Reason: tt.reason},
			})
			require.True(t, ok)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestResponsesStreamEventToChatChunksUsesOutputIndexForToolArguments(t *testing.T) {
	state := newTestResponsesStreamState()
	outputIndex := 1

	var chunks []dto.ChatCompletionsStreamResponse
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{Type: responsesEventCreated})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{Type: responsesEventOutputTextDelta, Delta: "text before tool"})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventFunctionArgsDelta,
		OutputIndex: &outputIndex,
		Delta:       `{"cmd":"ls"}`,
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeFunctionCall,
			ID:     "fc_1",
			CallId: "call_1",
			Name:   "exec",
		},
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type: responsesEventCompleted,
		Response: &dto.OpenAIResponsesResponse{
			Status: []byte(`"completed"`),
			Usage:  &dto.Usage{InputTokens: 1, OutputTokens: 2, TotalTokens: 3},
		},
	})...)

	require.Len(t, chunks, 4)
	assert.Equal(t, "assistant", chunks[0].Choices[0].Delta.Role)
	assert.Equal(t, "text before tool", chunks[1].Choices[0].Delta.GetContentString())
	tool := chunks[2].Choices[0].Delta.ToolCalls[0]
	require.NotNil(t, tool.Index)
	assert.Equal(t, 0, *tool.Index)
	assert.Equal(t, "call_1", tool.ID)
	assert.Equal(t, "exec", tool.Function.Name)
	assert.Equal(t, `{"cmd":"ls"}`, tool.Function.Arguments)
	require.NotNil(t, chunks[3].Choices[0].FinishReason)
	assert.Equal(t, "tool_calls", *chunks[3].Choices[0].FinishReason)
	assert.Equal(t, 3, state.Usage.TotalTokens)
}

func TestResponsesStreamEventToChatChunksDoesNotDuplicatePendingArgsWithOutputIndexAndItemID(t *testing.T) {
	state := newTestResponsesStreamState()
	outputIndex := 1

	var chunks []dto.ChatCompletionsStreamResponse
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{Type: responsesEventCreated})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventFunctionArgsDelta,
		OutputIndex: &outputIndex,
		ItemID:      "fc_1",
		Delta:       `{"q":"x"}`,
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		ItemID:      "fc_1",
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeFunctionCall,
			ID:     "fc_1",
			CallId: "call_1",
			Name:   "lookup",
		},
	})...)

	require.Len(t, chunks, 2)
	tool := chunks[1].Choices[0].Delta.ToolCalls[0]
	assert.Equal(t, "call_1", tool.ID)
	assert.Equal(t, "lookup", tool.Function.Name)
	assert.Equal(t, `{"q":"x"}`, tool.Function.Arguments)
	assert.Empty(t, state.pendingArgsByOutputIndex)
	assert.Empty(t, state.pendingArgsByItemID)
}

func TestResponsesStreamEventToChatChunksDrainsItemOnlyPendingArgsWhenOutputIndexArrives(t *testing.T) {
	state := newTestResponsesStreamState()
	outputIndex := 1

	var chunks []dto.ChatCompletionsStreamResponse
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{Type: responsesEventCreated})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:   responsesEventFunctionArgsDelta,
		ItemID: "fc_1",
		Delta:  `{"q":"x"}`,
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		ItemID:      "fc_1",
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeFunctionCall,
			CallId: "call_1",
			Name:   "lookup",
		},
	})...)

	require.Len(t, chunks, 2)
	tool := chunks[1].Choices[0].Delta.ToolCalls[0]
	assert.Equal(t, "call_1", tool.ID)
	assert.Equal(t, "lookup", tool.Function.Name)
	assert.Equal(t, `{"q":"x"}`, tool.Function.Arguments)
	assert.Empty(t, state.pendingArgsByOutputIndex)
	assert.Empty(t, state.pendingArgsByItemID)
}

func TestResponsesStreamEventToChatChunksCustomToolAndReasoning(t *testing.T) {
	state := newTestResponsesStreamState()
	outputIndex := 0

	chunks := mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:  responsesEventReasoningTextDelta,
		Delta: "thinking",
	})
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeCustomToolCall,
			ID:     "ct_1",
			CallId: "call_custom",
			Name:   "apply_patch",
		},
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type:        responsesEventCustomToolInputDelta,
		OutputIndex: &outputIndex,
		Delta:       "patch body",
	})...)
	chunks = append(chunks, mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type: responsesEventIncomplete,
		Response: &dto.OpenAIResponsesResponse{
			IncompleteDetails: &dto.IncompleteDetails{Reason: responsesIncompleteReasonContentFilter},
		},
	})...)

	require.Len(t, chunks, 5)
	assert.Equal(t, "thinking", chunks[1].Choices[0].Delta.GetReasoningContent())
	assert.Equal(t, "apply_patch", chunks[2].Choices[0].Delta.ToolCalls[0].Function.Name)
	assert.Equal(t, "patch body", chunks[3].Choices[0].Delta.ToolCalls[0].Function.Arguments)
	require.NotNil(t, chunks[4].Choices[0].FinishReason)
	assert.Equal(t, "content_filter", *chunks[4].Choices[0].FinishReason)
}

func TestResponsesStreamEventToChatChunksUsesTerminalDoneOutput(t *testing.T) {
	state := newTestResponsesStreamState()
	chunks := mustStreamChunks(t, state, &dto.ResponsesStreamResponse{
		Type: responsesEventDone,
		Response: &dto.OpenAIResponsesResponse{
			Status: []byte(`"completed"`),
			Output: []dto.ResponsesOutput{
				{
					Type: responsesOutputTypeMessage,
					Role: "assistant",
					Content: []dto.ResponsesOutputContent{
						{Type: "output_text", Text: "terminal text"},
					},
				},
				{
					Type:      responsesOutputTypeFunctionCall,
					ID:        "fc_1",
					CallId:    "call_1",
					Name:      "lookup",
					Arguments: []byte(`{"q":"x"}`),
				},
			},
		},
	})

	require.Len(t, chunks, 4)
	assert.Equal(t, "assistant", chunks[0].Choices[0].Delta.Role)
	assert.Equal(t, "terminal text", chunks[1].Choices[0].Delta.GetContentString())
	tool := chunks[2].Choices[0].Delta.ToolCalls[0]
	assert.Equal(t, "lookup", tool.Function.Name)
	assert.Equal(t, `{"q":"x"}`, tool.Function.Arguments)
	require.NotNil(t, chunks[3].Choices[0].FinishReason)
	assert.Equal(t, "tool_calls", *chunks[3].Choices[0].FinishReason)
}

func TestFinalizeResponsesToChatStreamFlushesPendingDeltaOnlyArguments(t *testing.T) {
	state := newTestResponsesStreamState()
	outputIndex := 2
	_, err := ResponsesStreamEventToChatChunks(&dto.ResponsesStreamResponse{
		Type:        responsesEventFunctionArgsDelta,
		OutputIndex: &outputIndex,
		Delta:       `{"pending":true}`,
	}, state)
	require.NoError(t, err)

	chunks := FinalizeResponsesToChatStream(state)
	require.Len(t, chunks, 3)
	tool := chunks[1].Choices[0].Delta.ToolCalls[0]
	assert.Equal(t, "call_output_2", tool.ID)
	assert.Equal(t, `{"pending":true}`, tool.Function.Arguments)
	require.NotNil(t, chunks[2].Choices[0].FinishReason)
	assert.Equal(t, "tool_calls", *chunks[2].Choices[0].FinishReason)
}

func TestResponsesStreamEventToChatChunksFailedEventReturnsError(t *testing.T) {
	_, err := ResponsesStreamEventToChatChunks(&dto.ResponsesStreamResponse{Type: responsesEventFailed}, newTestResponsesStreamState())
	require.Error(t, err)
}

func TestResponsesBufferedAccumulatorSupplementsEmptyTerminalOutput(t *testing.T) {
	acc := NewResponsesBufferedAccumulator()
	outputIndex := 1
	acc.ProcessEvent(&dto.ResponsesStreamResponse{Type: responsesEventOutputTextDelta, Delta: "buffered text"})
	acc.ProcessEvent(&dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeFunctionCall,
			ID:     "fc_1",
			CallId: "call_1",
			Name:   "lookup",
		},
	})
	acc.ProcessEvent(&dto.ResponsesStreamResponse{
		Type:        responsesEventFunctionArgsDelta,
		OutputIndex: &outputIndex,
		Delta:       `{"q":"x"}`,
	})

	resp := &dto.OpenAIResponsesResponse{
		Status: []byte(`"completed"`),
		Model:  "gpt-test",
	}
	acc.SupplementResponseOutput(resp)

	chat, _, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_1")
	require.NoError(t, err)
	assert.Equal(t, "buffered text", chat.Choices[0].Message.StringContent())
	toolCalls := chat.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, `{"q":"x"}`, toolCalls[0].Function.Arguments)
}

func TestResponsesBufferedAccumulatorDoesNotDuplicatePendingArgsWithOutputIndexAndItemID(t *testing.T) {
	acc := NewResponsesBufferedAccumulator()
	outputIndex := 1
	acc.ProcessEvent(&dto.ResponsesStreamResponse{
		Type:        responsesEventFunctionArgsDelta,
		OutputIndex: &outputIndex,
		ItemID:      "fc_1",
		Delta:       `{"q":"x"}`,
	})
	acc.ProcessEvent(&dto.ResponsesStreamResponse{
		Type:        responsesEventOutputItemAdded,
		OutputIndex: &outputIndex,
		ItemID:      "fc_1",
		Item: &dto.ResponsesOutput{
			Type:   responsesOutputTypeFunctionCall,
			ID:     "fc_1",
			CallId: "call_1",
			Name:   "lookup",
		},
	})

	resp := &dto.OpenAIResponsesResponse{
		Status: []byte(`"completed"`),
		Model:  "gpt-test",
	}
	acc.SupplementResponseOutput(resp)

	chat, _, err := ResponsesResponseToChatCompletionsResponse(resp, "chatcmpl_1")
	require.NoError(t, err)
	toolCalls := chat.Choices[0].Message.ParseToolCalls()
	require.Len(t, toolCalls, 1)
	assert.Equal(t, `{"q":"x"}`, toolCalls[0].Function.Arguments)
	assert.Empty(t, acc.pendingByOutputIndex)
	assert.Empty(t, acc.pendingByItemID)
}

func TestChatCompletionsResponseToResponsesPreservesTextToolCallsAndUsage(t *testing.T) {
	chat := &dto.OpenAITextResponse{
		Id:      "chatcmpl_1",
		Model:   "gpt-test",
		Created: 456,
		Choices: []dto.OpenAITextResponseChoice{
			{
				Message:      assistantMessageWithTool("I will call.", "call_1", "lookup", `{"q":"x"}`),
				FinishReason: "tool_calls",
			},
		},
		Usage: dto.Usage{PromptTokens: 3, CompletionTokens: 5, TotalTokens: 8},
	}

	resp, usage, err := ChatCompletionsResponseToResponsesResponse(chat, "resp_1")
	require.NoError(t, err)
	require.NotNil(t, usage)

	assert.Equal(t, "resp_1", resp.ID)
	assert.Equal(t, "response", resp.Object)
	assert.Equal(t, `"completed"`, string(resp.Status))
	assert.Equal(t, 3, resp.Usage.InputTokens)
	assert.Equal(t, 5, resp.Usage.OutputTokens)
	require.Len(t, resp.Output, 2)
	assert.Equal(t, responsesOutputTypeMessage, resp.Output[0].Type)
	assert.Equal(t, "I will call.", resp.Output[0].Content[0].Text)
	assert.Equal(t, responsesOutputTypeFunctionCall, resp.Output[1].Type)
	assert.Equal(t, "call_1", resp.Output[1].CallId)
	assert.Equal(t, "lookup", resp.Output[1].Name)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(resp.Output[1].Arguments))
}

func TestChatCompletionsResponseToResponsesMapsIncompleteFinishReasons(t *testing.T) {
	tests := []struct {
		name         string
		finishReason string
		wantReason   string
	}{
		{name: "length", finishReason: "length", wantReason: responsesIncompleteReasonMaxTokens},
		{name: "content filter", finishReason: "content_filter", wantReason: responsesIncompleteReasonContentFilter},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resp, _, err := ChatCompletionsResponseToResponsesResponse(&dto.OpenAITextResponse{
				Id:    "chatcmpl_1",
				Model: "gpt-test",
				Choices: []dto.OpenAITextResponseChoice{
					{
						Message:      dto.Message{Role: "assistant", Content: "partial"},
						FinishReason: tt.finishReason,
					},
				},
			}, "resp_1")
			require.NoError(t, err)

			assert.Equal(t, `"incomplete"`, string(resp.Status))
			require.NotNil(t, resp.IncompleteDetails)
			assert.Equal(t, tt.wantReason, resp.IncompleteDetails.Reason)
			require.Len(t, resp.Output, 1)
			assert.Equal(t, "incomplete", resp.Output[0].Status)
		})
	}
}

func TestChatCompletionsStreamToResponsesEventsAggregatesUsageAndToolArgs(t *testing.T) {
	state := NewChatToResponsesStreamState("resp_1", "gpt-test")
	state.Created = 123
	toolIndex := 0

	var events []ChatToResponsesStreamEvent
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Id:      "chatcmpl_1",
		Model:   "gpt-test",
		Created: 123,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Role: "assistant"}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{Content: lo.ToPtr("hello")}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: &toolIndex, ID: "call_1", Type: "function", Function: dto.FunctionResponse{Name: "lookup"}},
			}}},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{ToolCalls: []dto.ToolCallResponse{
				{Index: &toolIndex, Function: dto.FunctionResponse{Arguments: `{"q":"x"}`}},
			}}},
		},
	})...)
	finishReason := "tool_calls"
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, FinishReason: &finishReason},
		},
	})...)
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Usage: &dto.Usage{PromptTokens: 2, CompletionTokens: 4, TotalTokens: 6},
	})...)
	events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

	require.Len(t, events, 10)
	assert.Equal(t, responsesEventCreated, events[0].Type)
	assert.Equal(t, responsesEventOutputTextDelta, events[2].Type)
	assert.Equal(t, "hello", events[2].Payload.Delta)
	assert.Equal(t, responsesEventFunctionArgsDelta, events[4].Type)
	assert.Equal(t, `{"q":"x"}`, events[4].Payload.Delta)
	assert.Equal(t, responsesEventCompleted, events[9].Type)
	require.NotNil(t, events[9].Payload.Response)
	assert.Equal(t, 6, events[9].Payload.Response.Usage.TotalTokens)
	require.Len(t, events[9].Payload.Response.Output, 2)
	assert.Equal(t, "hello", events[9].Payload.Response.Output[0].Content[0].Text)
	assert.Equal(t, `"{\"q\":\"x\"}"`, string(events[9].Payload.Response.Output[1].Arguments))
}

func TestChatCompletionsStreamToResponsesReasoningSummaryEmitsPartEvents(t *testing.T) {
	state := NewChatToResponsesStreamState("resp_1", "gpt-test")
	state.Created = 100

	var events []ChatToResponsesStreamEvent

	// First chunk: reasoning content delta — should trigger output_item.added +
	// reasoning_summary_part.added + reasoning_summary_text.delta
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Id:      "chatcmpl_1",
		Model:   "gpt-test",
		Created: 100,
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
				ReasoningContent: lo.ToPtr("thinking step 1"),
			}},
		},
	})...)

	// Second chunk: more reasoning content
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, Delta: dto.ChatCompletionsStreamResponseChoiceDelta{
				ReasoningContent: lo.ToPtr(" and step 2"),
			}},
		},
	})...)

	// Third chunk: finish reason
	finishReason := "stop"
	events = append(events, mustResponsesEventsFromChatChunk(t, state, &dto.ChatCompletionsStreamResponse{
		Choices: []dto.ChatCompletionsStreamResponseChoice{
			{Index: 0, FinishReason: &finishReason},
		},
	})...)

	// Finalize
	events = append(events, FinalizeChatCompletionsStreamToResponses(state)...)

	// Extract event types for assertion
	types := make([]string, len(events))
	for i, e := range events {
		types[i] = e.Type
	}

	// Verify the complete reasoning summary event sequence:
	// 1. response.created
	// 2. response.output_item.added        (reasoning output item)
	// 3. response.reasoning_summary_part.added  (opens the summary part)
	// 4. response.reasoning_summary_text.delta  (first delta)
	// 5. response.reasoning_summary_text.delta  (second delta)
	// 6. response.reasoning_summary_text.done   (closes text)
	// 7. response.reasoning_summary_part.done   (closes part)
	// 8. response.output_item.done              (closes reasoning item)
	// 9. response.completed
	expectedTypes := []string{
		responsesEventCreated,
		responsesEventOutputItemAdded,
		responsesEventReasoningSummaryPartAdd,
		responsesEventReasoningSummaryDelta,
		responsesEventReasoningSummaryDelta,
		responsesEventReasoningSummaryDone,
		responsesEventReasoningSummaryPartDone,
		responsesEventOutputItemDone,
		responsesEventCompleted,
	}
	assert.Equal(t, expectedTypes, types, "reasoning summary event sequence must match OpenAI Responses API protocol")

	// Verify the part.added event has empty text (initial state)
	partAdded := events[2].Payload
	require.NotNil(t, partAdded.Part)
	assert.Equal(t, "summary_text", partAdded.Part.Type)
	assert.Equal(t, "", partAdded.Part.Text)

	// Verify delta payloads carry the correct text fragments
	assert.Equal(t, "thinking step 1", events[3].Payload.Delta)
	assert.Equal(t, " and step 2", events[4].Payload.Delta)

	// Verify reasoning_summary_text.done carries the full accumulated text
	summaryDone := events[5].Payload
	require.NotNil(t, summaryDone.Part)
	assert.Equal(t, "thinking step 1 and step 2", summaryDone.Part.Text)

	// Verify reasoning_summary_part.done also carries the full text
	partDone := events[6].Payload
	require.NotNil(t, partDone.Part)
	assert.Equal(t, "thinking step 1 and step 2", partDone.Part.Text)

	// Verify the final completed response includes reasoning output with summary
	require.NotNil(t, events[8].Payload.Response)
	require.Len(t, events[8].Payload.Response.Output, 1)
	assert.Equal(t, responsesOutputTypeReasoning, events[8].Payload.Response.Output[0].Type)
	require.NotNil(t, events[8].Payload.Response.Output[0].Summary)
	require.Len(t, *events[8].Payload.Response.Output[0].Summary, 1)
	assert.Equal(t, "thinking step 1 and step 2", (*events[8].Payload.Response.Output[0].Summary)[0].Text)

	// Verify output_item.added carries summary field (required by Codex CLI)
	addedItem := events[1].Payload.Item
	require.NotNil(t, addedItem)
	require.NotNil(t, addedItem.Summary, "reasoning output_item.added must include summary field for Codex CLI compatibility")
	assert.Empty(t, *addedItem.Summary)
	assert.Empty(t, addedItem.Role, "reasoning items must not have role field")
}

func assistantMessageWithTool(content string, id string, name string, args string) dto.Message {
	msg := dto.Message{Role: "assistant", Content: content}
	msg.SetToolCalls([]dto.ToolCallRequest{
		{
			ID:   id,
			Type: "function",
			Function: dto.FunctionRequest{
				Name:      name,
				Arguments: args,
			},
		},
	})
	return msg
}

func newTestResponsesStreamState() *ResponsesToChatStreamState {
	state := NewResponsesToChatStreamState("gpt-test", false)
	state.ID = "chatcmpl_test"
	state.Created = 123
	return state
}

func mustStreamChunks(t *testing.T, state *ResponsesToChatStreamState, event *dto.ResponsesStreamResponse) []dto.ChatCompletionsStreamResponse {
	t.Helper()
	chunks, err := ResponsesStreamEventToChatChunks(event, state)
	require.NoError(t, err)
	return chunks
}

func mustResponsesEventsFromChatChunk(t *testing.T, state *ChatToResponsesStreamState, chunk *dto.ChatCompletionsStreamResponse) []ChatToResponsesStreamEvent {
	t.Helper()
	events, err := ChatCompletionsStreamChunkToResponsesEvents(chunk, state)
	require.NoError(t, err)
	return events
}
