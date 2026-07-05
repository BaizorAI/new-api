package relay

import (
	"bufio"
	"bytes"
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

	// codex WS Responses API protocol: first frame is a response.create event envelope
	//   {"type":"response.create","response":{<actual Responses API request body>}}
	// Extract the inner object so the upstream receives a plain Responses API request.
	requestBody := msgData
	if gjson.GetBytes(msgData, "type").String() == "response.create" {
		if inner := gjson.GetBytes(msgData, "response"); inner.Exists() {
			requestBody = []byte(inner.Raw)
		}
	}
	// The upstream HTTP Responses API requires stream:true for SSE output.
	// Codex relies on the WS transport for streaming and may omit the field.
	if !gjson.GetBytes(requestBody, "stream").Bool() {
		if updated, err := sjson.SetBytes(requestBody, "stream", true); err == nil {
			requestBody = updated
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
