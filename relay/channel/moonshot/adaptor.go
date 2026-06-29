package moonshot

import (
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/BaizorAI/new-api/common"
	channelconstant "github.com/BaizorAI/new-api/constant"
	"github.com/BaizorAI/new-api/dto"
	"github.com/BaizorAI/new-api/relay/channel"
	"github.com/BaizorAI/new-api/relay/channel/claude"
	"github.com/BaizorAI/new-api/relay/channel/openai"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	"github.com/BaizorAI/new-api/relay/constant"
	"github.com/BaizorAI/new-api/service"
	"github.com/BaizorAI/new-api/types"

	"github.com/gin-gonic/gin"
)

type Adaptor struct {
}

const (
	moonshotResponsesInputTypeCustomToolCall       = "custom_tool_call"
	moonshotResponsesInputTypeCustomToolCallOutput = "custom_tool_call_output"
	moonshotResponsesInputTypeFunctionCallOutput   = "function_call_output"
	moonshotResponsesInputTypeFunctionCall         = "function_call"
	moonshotResponsesInputTypeMessage              = "message"

	moonshotKimiK2ContextWindowTokens = 262144
	moonshotKimiK2SafetyReserveTokens = 24000
	moonshotKimiK2DefaultOutputTokens = 4096
)

func (a *Adaptor) ConvertGeminiRequest(*gin.Context, *relaycommon.RelayInfo, *dto.GeminiChatRequest) (any, error) {
	//TODO implement me
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, req *dto.ClaudeRequest) (any, error) {
	adaptor := claude.Adaptor{}
	return adaptor.ConvertClaudeRequest(c, info, req)
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	//TODO implement me
	return nil, errors.New("not supported")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	adaptor := openai.Adaptor{}
	return adaptor.ConvertImageRequest(c, info, request)
}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {
}

func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	baseURL := info.ChannelBaseUrl
	if specialPlan, ok := channelconstant.ChannelSpecialBases[baseURL]; ok {
		if info.RelayFormat == types.RelayFormatClaude {
			return fmt.Sprintf("%s/v1/messages", specialPlan.ClaudeBaseURL), nil
		}
		if info.RelayFormat == types.RelayFormatOpenAI {
			return fmt.Sprintf("%s/chat/completions", specialPlan.OpenAIBaseURL), nil
		}
	}

	switch info.RelayFormat {
	case types.RelayFormatClaude:
		return fmt.Sprintf("%s/anthropic/v1/messages", info.ChannelBaseUrl), nil
	default:
		if info.RelayMode == constant.RelayModeRerank {
			return fmt.Sprintf("%s/v1/rerank", info.ChannelBaseUrl), nil
		} else if info.RelayMode == constant.RelayModeEmbeddings {
			return fmt.Sprintf("%s/v1/embeddings", info.ChannelBaseUrl), nil
		} else if info.RelayMode == constant.RelayModeChatCompletions {
			return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
		} else if info.RelayMode == constant.RelayModeCompletions {
			return fmt.Sprintf("%s/v1/completions", info.ChannelBaseUrl), nil
		}
		return fmt.Sprintf("%s/v1/chat/completions", info.ChannelBaseUrl), nil
	}
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	return nil
}

func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	effectiveModel := request.Model
	if info != nil && info.ChannelMeta != nil && info.UpstreamModelName != "" {
		effectiveModel = info.UpstreamModelName
	}
	if isMoonshotKimiK2Model(effectiveModel) {
		if request.Temperature != nil {
			allowedTemperature := 1.0
			request.Temperature = &allowedTemperature
		}
		if request.TopP != nil {
			allowedTopP := 0.95
			request.TopP = &allowedTopP
		}
		if err := validateMoonshotKimiK2Context(info, request); err != nil {
			return nil, err
		}
	}
	filterMoonshotChatTools(request)
	return request, nil
}

func isMoonshotKimiK2Model(model string) bool {
	model = strings.ToLower(strings.TrimSpace(model))
	model = strings.TrimPrefix(model, "moonshotai/")
	return strings.HasPrefix(model, "kimi-k2")
}

func validateMoonshotKimiK2Context(info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) error {
	if info == nil || request == nil {
		return nil
	}
	estimatedPromptTokens := info.GetEstimatePromptTokens()
	if estimatedPromptTokens <= 0 {
		return nil
	}

	maxOutputTokens := int(request.GetMaxTokens())
	if maxOutputTokens <= 0 {
		maxOutputTokens = moonshotKimiK2DefaultOutputTokens
	}

	safeLimit := moonshotKimiK2ContextWindowTokens - moonshotKimiK2SafetyReserveTokens
	estimatedTotalTokens := estimatedPromptTokens + maxOutputTokens
	if estimatedTotalTokens <= safeLimit {
		return nil
	}

	return types.NewErrorWithStatusCode(
		fmt.Errorf(
			"%s context limit exceeded for Moonshot: estimated input+output tokens %d exceeds safe limit %d (context window %d). Reduce input or max_output_tokens, or use a longer-context model",
			strings.TrimSpace(request.Model),
			estimatedTotalTokens,
			safeLimit,
			moonshotKimiK2ContextWindowTokens,
		),
		types.ErrorCodeInvalidRequest,
		http.StatusBadRequest,
		types.ErrOptionWithSkipRetry(),
	)
}

func filterMoonshotChatTools(request *dto.GeneralOpenAIRequest) {
	if request == nil || len(request.Tools) == 0 {
		if request != nil {
			request.ToolChoice = nil
		}
		return
	}

	allowedNames := make(map[string]struct{}, len(request.Tools))
	filtered := make([]dto.ToolCallRequest, 0, len(request.Tools))
	for _, tool := range request.Tools {
		if strings.TrimSpace(tool.Type) != "function" {
			continue
		}
		name := strings.TrimSpace(tool.Function.Name)
		if name == "" {
			continue
		}
		tool.Type = "function"
		tool.Function.Name = name
		tool.Function.Parameters = sanitizeMoonshotToolParameters(tool.Function.Parameters)
		filtered = append(filtered, tool)
		allowedNames[name] = struct{}{}
	}

	request.Tools = filtered
	if len(filtered) == 0 {
		request.ToolChoice = nil
		request.ParallelTooCalls = nil
		return
	}
	request.ToolChoice = filterMoonshotToolChoice(request.ToolChoice, allowedNames)
}

func filterMoonshotToolChoice(toolChoice any, allowedNames map[string]struct{}) any {
	if toolChoice == nil {
		return nil
	}
	if choice, ok := toolChoice.(string); ok {
		switch strings.TrimSpace(choice) {
		case "", "none":
			return nil
		default:
			return choice
		}
	}

	choiceMap, ok := toolChoice.(map[string]any)
	if !ok {
		raw, err := common.Marshal(toolChoice)
		if err != nil {
			return nil
		}
		if err := common.Unmarshal(raw, &choiceMap); err != nil {
			return nil
		}
	}

	if strings.TrimSpace(common.Interface2String(choiceMap["type"])) != "function" {
		return nil
	}
	function, ok := choiceMap["function"].(map[string]any)
	if !ok {
		return nil
	}
	name := strings.TrimSpace(common.Interface2String(function["name"]))
	if _, ok := allowedNames[name]; !ok {
		return nil
	}
	return map[string]any{
		"type": "function",
		"function": map[string]any{
			"name": name,
		},
	}
}

func sanitizeMoonshotToolParameters(parameters any) map[string]any {
	schema, ok := copyMoonshotSchemaMap(parameters)
	if !ok {
		return emptyMoonshotObjectSchema()
	}

	repaired, ok := repairMoonshotSchema(schema, true).(map[string]any)
	if !ok {
		return emptyMoonshotObjectSchema()
	}

	if strings.TrimSpace(common.Interface2String(repaired["type"])) != "object" {
		repaired["type"] = "object"
	}
	if _, ok := repaired["properties"].(map[string]any); !ok {
		repaired["properties"] = map[string]any{}
	}
	return repaired
}

func copyMoonshotSchemaMap(value any) (map[string]any, bool) {
	schema, ok := value.(map[string]any)
	if !ok {
		raw, err := common.Marshal(value)
		if err != nil {
			return nil, false
		}
		if err := common.Unmarshal(raw, &schema); err != nil {
			return nil, false
		}
	}
	if schema == nil {
		return nil, false
	}

	raw, err := common.Marshal(schema)
	if err != nil {
		return nil, false
	}
	var copied map[string]any
	if err := common.Unmarshal(raw, &copied); err != nil {
		return nil, false
	}
	return copied, true
}

func repairMoonshotSchema(value any, isSchema bool) any {
	switch node := value.(type) {
	case []any:
		out := make([]any, 0, len(node))
		for _, item := range node {
			out = append(out, repairMoonshotSchema(item, true))
		}
		return out
	case map[string]any:
		repaired := make(map[string]any, len(node))
		for key, val := range node {
			switch key {
			case "properties", "patternProperties", "$defs", "definitions":
				if valueMap, ok := val.(map[string]any); ok {
					nextMap := make(map[string]any, len(valueMap))
					for subKey, subVal := range valueMap {
						nextMap[subKey] = repairMoonshotSchema(subVal, true)
					}
					repaired[key] = nextMap
				} else {
					repaired[key] = val
				}
			case "anyOf", "oneOf", "allOf", "prefixItems":
				if values, ok := val.([]any); ok {
					nextValues := make([]any, 0, len(values))
					for _, item := range values {
						nextValues = append(nextValues, repairMoonshotSchema(item, true))
					}
					repaired[key] = nextValues
				} else {
					repaired[key] = val
				}
			case "items", "contains", "not", "additionalProperties", "propertyNames":
				if valueMap, ok := val.(map[string]any); ok {
					repaired[key] = repairMoonshotSchema(valueMap, true)
				} else {
					repaired[key] = val
				}
			default:
				repaired[key] = val
			}
		}

		if !isSchema {
			return repaired
		}

		if rawAnyOf, ok := repaired["anyOf"].([]any); ok {
			delete(repaired, "type")
			nonNull := make([]any, 0, len(rawAnyOf))
			for _, branch := range rawAnyOf {
				branchMap, ok := branch.(map[string]any)
				if !ok || strings.TrimSpace(common.Interface2String(branchMap["type"])) != "null" {
					nonNull = append(nonNull, branch)
				}
			}
			if len(nonNull) > 0 && len(nonNull) < len(rawAnyOf) {
				if len(nonNull) == 1 {
					delete(repaired, "anyOf")
					if branchMap, ok := nonNull[0].(map[string]any); ok {
						for key, val := range branchMap {
							repaired[key] = val
						}
					}
				} else {
					repaired["anyOf"] = nonNull
					return repaired
				}
			} else {
				return repaired
			}
		}

		delete(repaired, "nullable")
		if _, hasRef := repaired["$ref"]; !hasRef {
			fillMoonshotMissingType(repaired)
		}
		cleanMoonshotEnum(repaired)
		return repaired
	default:
		return value
	}
}

func fillMoonshotMissingType(schema map[string]any) {
	if rawType, ok := schema["type"]; ok {
		if values, ok := rawType.([]any); ok {
			for _, value := range values {
				typeValue := strings.TrimSpace(common.Interface2String(value))
				if typeValue != "" && typeValue != "null" {
					schema["type"] = typeValue
					return
				}
			}
			schema["type"] = "string"
			return
		}
		if strings.TrimSpace(common.Interface2String(rawType)) != "" {
			return
		}
	}

	switch {
	case schema["properties"] != nil || schema["required"] != nil || schema["additionalProperties"] != nil:
		schema["type"] = "object"
	case schema["items"] != nil || schema["prefixItems"] != nil:
		schema["type"] = "array"
	case schema["enum"] != nil:
		schema["type"] = moonshotEnumSampleType(schema["enum"])
	default:
		schema["type"] = "string"
	}
}

func cleanMoonshotEnum(schema map[string]any) {
	nodeType := strings.TrimSpace(common.Interface2String(schema["type"]))
	switch nodeType {
	case "string", "integer", "number", "boolean":
	default:
		return
	}

	values, ok := schema["enum"].([]any)
	if !ok {
		return
	}
	cleaned := make([]any, 0, len(values))
	for _, value := range values {
		if value == nil || value == "" {
			continue
		}
		cleaned = append(cleaned, value)
	}
	if len(cleaned) == 0 {
		delete(schema, "enum")
		return
	}
	schema["enum"] = cleaned
}

func moonshotEnumSampleType(rawEnum any) string {
	values, ok := rawEnum.([]any)
	if !ok || len(values) == 0 {
		return "string"
	}
	switch values[0].(type) {
	case bool:
		return "boolean"
	case int, int8, int16, int32, int64:
		return "integer"
	case uint, uint8, uint16, uint32, uint64:
		return "integer"
	case float32, float64:
		return "number"
	default:
		return "string"
	}
}

func emptyMoonshotObjectSchema() map[string]any {
	return map[string]any{
		"type":       "object",
		"properties": map[string]any{},
	}
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	var err error
	request.Input, err = filterMoonshotResponsesInput(request.Input)
	if err != nil {
		return nil, err
	}

	chatReq, err := service.ResponsesRequestToChatCompletionsRequest(&request)
	if err != nil {
		return nil, err
	}
	return a.ConvertOpenAIRequest(c, info, chatReq)
}

func filterMoonshotResponsesInput(raw []byte) ([]byte, error) {
	if !moonshotRawJSONPresent(raw) || common.GetJsonType(raw) != "array" {
		return raw, nil
	}

	var items []map[string]any
	if err := common.Unmarshal(raw, &items); err != nil {
		return nil, err
	}

	skippedCallIDs := make(map[string]struct{})
	for _, item := range items {
		if !moonshotShouldSkipResponsesItem(item) {
			continue
		}
		for _, key := range []string{"call_id", "id"} {
			if callID := strings.TrimSpace(common.Interface2String(item[key])); callID != "" {
				skippedCallIDs[callID] = struct{}{}
			}
		}
	}

	filtered := make([]map[string]any, 0, len(items))
	for _, item := range items {
		itemType := strings.TrimSpace(common.Interface2String(item["type"]))
		if moonshotShouldSkipResponsesItem(item) {
			continue
		}
		switch itemType {
		case moonshotResponsesInputTypeFunctionCallOutput:
			if _, ok := skippedCallIDs[strings.TrimSpace(common.Interface2String(item["call_id"]))]; ok {
				continue
			}
		}
		if moonshotIsResponsesMessageItem(item) {
			sanitized, ok := sanitizeMoonshotResponsesMessageItem(item)
			if !ok {
				continue
			}
			item = sanitized
		}
		filtered = append(filtered, item)
	}

	return common.Marshal(filtered)
}

func moonshotShouldSkipResponsesItem(item map[string]any) bool {
	itemType := strings.TrimSpace(common.Interface2String(item["type"]))
	switch itemType {
	case "", moonshotResponsesInputTypeMessage, moonshotResponsesInputTypeFunctionCall, moonshotResponsesInputTypeFunctionCallOutput:
		return false
	case moonshotResponsesInputTypeCustomToolCall, moonshotResponsesInputTypeCustomToolCallOutput:
		return true
	default:
		return true
	}
}

func moonshotIsResponsesMessageItem(item map[string]any) bool {
	itemType := strings.TrimSpace(common.Interface2String(item["type"]))
	return itemType == "" || itemType == moonshotResponsesInputTypeMessage
}

func sanitizeMoonshotResponsesMessageItem(item map[string]any) (map[string]any, bool) {
	normalizeMoonshotResponsesMessageRole(item)

	content, exists := item["content"]
	if !exists {
		return item, true
	}

	switch value := content.(type) {
	case string:
		return item, strings.TrimSpace(value) != ""
	case []any:
		filtered := sanitizeMoonshotResponsesContentParts(value)
		if len(filtered) == 0 {
			return nil, false
		}
		item["content"] = filtered
		return item, true
	case []map[string]any:
		parts := make([]any, 0, len(value))
		for _, part := range value {
			parts = append(parts, part)
		}
		filtered := sanitizeMoonshotResponsesContentParts(parts)
		if len(filtered) == 0 {
			return nil, false
		}
		item["content"] = filtered
		return item, true
	default:
		return item, true
	}
}

func normalizeMoonshotResponsesMessageRole(item map[string]any) {
	role := strings.TrimSpace(common.Interface2String(item["role"]))
	switch role {
	case "", "system", "user", "assistant", "tool":
		return
	case "developer":
		item["role"] = "system"
	default:
		item["role"] = "user"
	}
}

func sanitizeMoonshotResponsesContentParts(parts []any) []any {
	filtered := make([]any, 0, len(parts))
	for _, rawPart := range parts {
		part, ok := rawPart.(map[string]any)
		if !ok {
			continue
		}
		switch strings.TrimSpace(common.Interface2String(part["type"])) {
		case "input_text", "output_text", "text":
			filtered = append(filtered, part)
		}
	}
	return filtered
}

func moonshotRawJSONPresent(raw []byte) bool {
	if len(raw) == 0 {
		return false
	}
	return common.GetJsonType(raw) != "null"
}

func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return request, nil
}

func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	if info.RelayMode == constant.RelayModeResponses {
		if info.IsStream {
			return openai.OaiChatToResponsesStreamHandler(c, info, resp)
		}
		return openai.OaiChatToResponsesHandler(c, info, resp)
	}

	switch info.RelayFormat {
	case types.RelayFormatClaude:
		adaptor := claude.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	default:
		adaptor := openai.Adaptor{}
		return adaptor.DoResponse(c, resp, info)
	}
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
