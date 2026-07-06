package relay

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/dto"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	"github.com/BaizorAI/new-api/relay/channel"
	"github.com/BaizorAI/new-api/relay/helper"
	"github.com/BaizorAI/new-api/service"
	"github.com/BaizorAI/new-api/types"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"github.com/tidwall/gjson"
	"github.com/tidwall/sjson"
)

func WssHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	info.InitChannelMeta(c)

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	statusCodeMappingStr := c.GetString("status_code_mapping")
	resp, err := adaptor.DoRequest(c, info, nil)
	if err != nil {
		return types.NewError(err, types.ErrorCodeDoRequestFailed)
	}

	if resp != nil {
		info.TargetWs = resp.(*websocket.Conn)
		defer info.TargetWs.Close()
	}

	usage, newAPIError := adaptor.DoResponse(c, nil, info)
	if newAPIError != nil {
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}
	service.PostWssConsumeQuota(c, info, info.UpstreamModelName, usage.(*dto.RealtimeUsage), "")
	return nil
}

// WssResponsesHelper handles a WebSocket connection to GET /v1/responses.
// codex connects via WebSocket, sends the request JSON as the first text frame,
// and expects SSE events forwarded back as WebSocket text frames.
func WssResponsesHelper(c *gin.Context, info *relaycommon.RelayInfo) (newAPIError *types.NewAPIError) {
	statusCodeMappingStr := c.GetString("status_code_mapping")

	// The first WS frame may have been read early by controller/relay.go (for model
	// extraction before ModelPriceHelper). Use that buffered data when present;
	// otherwise read the frame now (covers the ?model= query-param case).
	var msgData []byte
	if stored, ok := c.Get("ws_responses_first_frame_data"); ok {
		msgData = stored.([]byte)
	} else {
		msgType, frameData, wsErr := info.ClientWs.ReadMessage()
		if wsErr != nil {
			return types.NewError(wsErr, types.ErrorCodeReadRequestBodyFailed, types.ErrOptionWithSkipRetry())
		}
		if msgType != websocket.TextMessage {
			return types.NewError(
				fmt.Errorf("expected text message, got type %d", msgType),
				types.ErrorCodeInvalidRequest,
				types.ErrOptionWithSkipRetry(),
			)
		}
		msgData = frameData
	}

	info.InitChannelMeta(c)

	adaptor := GetAdaptor(info.ApiType)
	if adaptor == nil {
		return types.NewError(fmt.Errorf("invalid api type: %d", info.ApiType), types.ErrorCodeInvalidApiType, types.ErrOptionWithSkipRetry())
	}
	adaptor.Init(info)

	// codex first frame: {"type":"response.create","model":"...","input":[...],...}
	// The fields are flat at top level (no nested "response" wrapper).
	// Strip "type" and forward the rest as a plain Responses API request body.
	requestBody := msgData
	if gjson.GetBytes(requestBody, "type").Exists() {
		if updated, err := sjson.DeleteBytes(requestBody, "type"); err == nil {
			requestBody = updated
		}
	}
	// codex attaches OpenAI-internal fields (prefixed "internal_") to input items.
	// Standard upstream Responses API providers reject them with 400.
	var reqMap map[string]interface{}
	if err := common.Unmarshal(requestBody, &reqMap); err == nil {
		modified := false
		if inputSlice, ok := reqMap["input"].([]interface{}); ok {
			for _, item := range inputSlice {
				if itemMap, ok := item.(map[string]interface{}); ok {
					for k := range itemMap {
						if strings.HasPrefix(k, "internal_") {
							delete(itemMap, k)
							modified = true
						}
					}
				}
			}
		}
		if modified {
			if updated, err := common.Marshal(reqMap); err == nil {
				requestBody = updated
			}
		}
	}
	// The upstream HTTP Responses API requires stream:true for SSE output.
	// Codex relies on the WS transport for streaming and may omit the field.
	if !gjson.GetBytes(requestBody, "stream").Bool() {
		if updated, err := sjson.SetBytes(requestBody, "stream", true); err == nil {
			requestBody = updated
		}
	}
	// Convert Responses API flat function tools → Chat Completions nested format.
	// Also filter out non-function types (e.g. "namespace") that are codex-internal
	// and not valid upstream tool types.
	// Codex sends: {"type":"function","name":"...","description":"...","parameters":{...}}
	// Upstream expects: {"type":"function","function":{"name":"...","description":"...","parameters":{...}}}
	if toolsVal := gjson.GetBytes(requestBody, "tools"); toolsVal.IsArray() {
		var tools []map[string]json.RawMessage
		if err := common.Unmarshal([]byte(toolsVal.Raw), &tools); err == nil {
			var filtered []map[string]json.RawMessage
			changed := false
			for _, tool := range tools {
				var toolType string
				if typeRaw, ok := tool["type"]; ok {
					_ = common.Unmarshal(typeRaw, &toolType)
				}
				if toolType != "function" {
					// Drop internal codex tool types (e.g. "namespace") that upstream doesn't accept.
					changed = true
					continue
				}
				if len(tool["function"]) == 0 {
					// Wrap flat function definition into nested {"type":"function","function":{...}}.
					funcBody := make(map[string]json.RawMessage, len(tool))
					for k, v := range tool {
						if k != "type" {
							funcBody[k] = v
						}
					}
					funcBodyBytes, err := common.Marshal(funcBody)
					if err == nil {
						tool = map[string]json.RawMessage{
							"type":     tool["type"],
							"function": funcBodyBytes,
						}
						changed = true
					}
				}
				filtered = append(filtered, tool)
			}
			if changed {
				if toolsBytes, err := common.Marshal(filtered); err == nil {
					if updated, err := sjson.SetRawBytes(requestBody, "tools", toolsBytes); err == nil {
						requestBody = updated
					}
				}
			}
		}
	}
	// Normalize "developer" role → "system" in Responses API input items.
	// Codex sets the system prompt as role:"developer" for reasoning models; upstream
	// providers that don't support this role (e.g. Claude, non-o-series OpenAI) reject the request.
	if inputVal := gjson.GetBytes(requestBody, "input"); inputVal.IsArray() {
		var items []map[string]json.RawMessage
		if err := common.Unmarshal([]byte(inputVal.Raw), &items); err == nil {
			changed := false
			for _, item := range items {
				roleRaw, ok := item["role"]
				if !ok {
					continue
				}
				var role string
				if err := common.Unmarshal(roleRaw, &role); err != nil || role != "developer" {
					continue
				}
				normalized, err := common.Marshal("system")
				if err == nil {
					item["role"] = normalized
					changed = true
				}
			}
			if changed {
				if inputBytes, err := common.Marshal(items); err == nil {
					if updated, err := sjson.SetRawBytes(requestBody, "input", inputBytes); err == nil {
						requestBody = updated
					}
				}
			}
		}
	}
	// Apply channel model mapping so the upstream receives the remapped model name.
	if info.UpstreamModelName != "" {
		if updated, err := sjson.SetBytes(requestBody, "model", info.UpstreamModelName); err == nil {
			requestBody = updated
		}
	}

	// Build the upstream HTTP POST URL via the adaptor.
	fullRequestURL, urlErr := adaptor.GetRequestURL(info)
	if urlErr != nil {
		return types.NewError(urlErr, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}

	upstreamReq, reqErr := http.NewRequest(http.MethodPost, fullRequestURL, bytes.NewReader(requestBody))
	if reqErr != nil {
		return types.NewError(reqErr, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	if hErr := adaptor.SetupRequestHeader(c, &upstreamReq.Header, info); hErr != nil {
		return types.NewError(hErr, types.ErrorCodeDoRequestFailed, types.ErrOptionWithSkipRetry())
	}
	upstreamReq.Header.Set("Content-Type", "application/json")
	upstreamReq.Header.Set("Accept", "text/event-stream")

	headerOverride, hoErr := channel.ResolveHeaderOverride(info, c)
	if hoErr != nil {
		return types.NewError(hoErr, types.ErrorCodeChannelHeaderOverrideInvalid, types.ErrOptionWithSkipRetry())
	}
	for k, v := range headerOverride {
		upstreamReq.Header.Set(k, v)
	}

	resp, rErr := channel.DoRequest(c, upstreamReq, info)
	if rErr != nil {
		return types.NewError(rErr, types.ErrorCodeDoRequestFailed)
	}
	defer service.CloseResponseBodyGracefully(resp)

	if resp.StatusCode != http.StatusOK {
		apiErr := service.RelayErrorHandler(c.Request.Context(), resp, false)
		service.ResetStatusCode(apiErr, statusCodeMappingStr)
		return apiErr
	}

	usage, newAPIError := streamResponsesSSEtoWS(c, info, resp)
	if newAPIError != nil {
		service.ResetStatusCode(newAPIError, statusCodeMappingStr)
		return newAPIError
	}

	service.PostTextConsumeQuota(c, info, usage, nil)
	return nil
}

// streamResponsesSSEtoWS reads the upstream SSE stream and forwards each JSON
// event payload as a WebSocket text frame to the client. Usage is extracted
// from the response.completed event.
func streamResponsesSSEtoWS(c *gin.Context, info *relaycommon.RelayInfo, resp *http.Response) (*dto.Usage, *types.NewAPIError) {
	usage := &dto.Usage{}
	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 64<<10), 128<<20)

	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := line[6:]
		if data == "[DONE]" {
			break
		}

		if wsErr := helper.WssString(c, info.ClientWs, data); wsErr != nil {
			// Client disconnected; stop forwarding.
			break
		}
		info.SetFirstResponseTime()

		// Extract usage from the response.completed event.
		var event dto.ResponsesStreamResponse
		if err := common.UnmarshalJsonStr(data, &event); err == nil && event.Type == "response.completed" {
			if event.Response != nil && event.Response.Usage != nil {
				u := event.Response.Usage
				if u.InputTokens != 0 {
					usage.PromptTokens = u.InputTokens
				}
				if u.OutputTokens != 0 {
					usage.CompletionTokens = u.OutputTokens
				}
				if u.TotalTokens != 0 {
					usage.TotalTokens = u.TotalTokens
				}
				if u.InputTokensDetails != nil {
					usage.PromptTokensDetails.CachedTokens = u.InputTokensDetails.CachedTokens
				}
			}
		}
	}

	if err := scanner.Err(); err != nil {
		return usage, types.NewError(err, types.ErrorCodeReadResponseBodyFailed)
	}

	if usage.PromptTokens == 0 && usage.CompletionTokens != 0 {
		usage.PromptTokens = info.GetEstimatePromptTokens()
	}
	usage.TotalTokens = usage.PromptTokens + usage.CompletionTokens
	return usage, nil
}
