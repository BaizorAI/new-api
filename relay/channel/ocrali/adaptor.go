package ocrali

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/dto"
	"github.com/BaizorAI/new-api/logger"
	"github.com/BaizorAI/new-api/relay/channel"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	"github.com/BaizorAI/new-api/service"
	"github.com/BaizorAI/new-api/types"

	"github.com/bytedance/gopkg/util/gopool"
	"github.com/gin-gonic/gin"
)

// Adaptor implements the channel.Adaptor interface for Alibaba Cloud OCR.
type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

// GetRequestURL returns the API endpoint. For RPC-style Alibaba Cloud APIs,
// the actual URL with query parameters is constructed in DoRequest.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.ChannelBaseUrl == "" {
		return "", errors.New("channel base URL is empty")
	}
	return info.ChannelBaseUrl, nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	// Signing is done in DoRequest, not here.
	return errors.New("not implemented")
}

// ConvertOpenAIRequest extracts image data and OCR type from the OpenAI chat request
// and converts it to an Alibaba Cloud OCR request payload.
func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	if request == nil {
		return nil, errors.New("request is nil")
	}

	ocrReq := &OCRRequest{}

	// Determine the OCR document type from the model name
	ocrType, ok := ModelToOCRType[info.UpstreamModelName]
	if !ok {
		// Fallback: use the upstream model name directly as the Type
		ocrType = info.UpstreamModelName
	}
	ocrReq.Type = ocrType

	// Extract image URL or base64 from the messages
	for _, msg := range request.Messages {
		if msg.IsStringContent() {
			// Check for type override in text messages, e.g., "type: IdCard"
			if t := parseTypeOverride(msg.StringContent()); t != "" {
				ocrReq.Type = t
			}
		}
		for _, part := range msg.ParseContent() {
			// Also check text parts within multi-modal content for type overrides
			if part.Type == dto.ContentTypeText {
				if t := parseTypeOverride(part.Text); t != "" {
					ocrReq.Type = t
				}
			}
			switch part.Type {
			case dto.ContentTypeImageURL:
				if imgMedia := part.GetImageMedia(); imgMedia != nil && imgMedia.Url != "" {
					ocrReq.Url = imgMedia.Url
				}
			}
		}
	}

	if ocrReq.Url == "" && ocrReq.ImageBase64 == "" {
		return nil, errors.New("no image found in request: provide an image_url or image_base64 in the messages")
	}

	// Check for optional parameters from ExtraBody
	if request.ExtraBody != nil {
		type extraParams struct {
			OutputCharInfo bool   `json:"output_char_info,omitempty"`
			OutputTable    bool   `json:"output_table,omitempty"`
			OutputPDF      bool   `json:"output_pdf,omitempty"`
			OutputStamp    bool   `json:"output_stamp,omitempty"`
			BarCode        bool   `json:"bar_code,omitempty"`
			OutputFormat   string `json:"output_format,omitempty"`
		}
		var extra extraParams
		if err := common.Unmarshal(request.ExtraBody, &extra); err == nil {
			ocrReq.OutputCharInfo = extra.OutputCharInfo
			ocrReq.OutputTable = extra.OutputTable
			ocrReq.OutputPDF = extra.OutputPDF
			ocrReq.OutputStamp = extra.OutputStamp
			ocrReq.BarCode = extra.BarCode
			if extra.OutputFormat != "" {
				ocrReq.OutputFormat = extra.OutputFormat
			}
		}
	}

	return ocrReq, nil
}

func (a *Adaptor) ConvertRerankRequest(c *gin.Context, relayMode int, request dto.RerankRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertEmbeddingRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.EmbeddingRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertAudioRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.AudioRequest) (io.Reader, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertImageRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.ImageRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertOpenAIResponsesRequest(c *gin.Context, info *relaycommon.RelayInfo, request dto.OpenAIResponsesRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertClaudeRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.ClaudeRequest) (any, error) {
	return nil, errors.New("not implemented")
}

func (a *Adaptor) ConvertGeminiRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeminiChatRequest) (any, error) {
	return nil, errors.New("not implemented")
}

// DoRequest sends the signed request to Alibaba Cloud OCR API.
// Uses RPC-style: ALL parameters (system + business) go in query string,
// signature covers the complete canonical query, body is empty.
func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	// Extract AK/SK from channel key
	accessKeyId, accessKeySecret, err := extractAPIKey(info.ApiKey)
	if err != nil {
		return nil, fmt.Errorf("invalid api key: %w", err)
	}

	// Parse the OCR request from the body
	bodyBytes, err := io.ReadAll(requestBody)
	if err != nil {
		return nil, fmt.Errorf("read request body failed: %w", err)
	}
	var ocrReq OCRRequest
	if err := common.Unmarshal(bodyBytes, &ocrReq); err != nil {
		return nil, fmt.Errorf("unmarshal OCR request failed: %w", err)
	}

	// Store the original image URL for later persistence alongside OCR results.
	if info.ExtraLogData == nil {
		info.ExtraLogData = make(map[string]any)
	}
	info.ExtraLogData["ocr_image_url"] = ocrReq.Url

	// Build the complete params map: system params + business params
	params := map[string]string{
		"Action":  "RecognizeAllText",
		"Version": "2021-07-07",
	}
	for k, v := range buildOCRQueryParams(&ocrReq) {
		params[k] = v
	}

	// Extract host from base URL
	baseURL, err := a.GetRequestURL(info)
	if err != nil {
		return nil, err
	}
	host := strings.TrimPrefix(strings.TrimPrefix(baseURL, "https://"), "http://")

	// Build signed URL with ALL parameters in query string
	signedURL := buildSignedURL(host, "POST", params, accessKeyId, accessKeySecret)

	logger.LogDebug(c, "OCR request URL: %s", signedURL)

	// Send POST with empty body (all params in URL). Must NOT be nil — doRequest
	// calls req.Body.Close() which panics on nil body.
	req, err := http.NewRequest("POST", signedURL, bytes.NewReader([]byte{}))
	if err != nil {
		return nil, fmt.Errorf("create request failed: %w", err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := channel.DoRequest(c, req, info)
	if err != nil {
		return nil, fmt.Errorf("do request failed: %w", err)
	}
	return resp, nil
}

// DoResponse parses the Alibaba Cloud OCR response and formats it as an
// OpenAI chat completion response.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	defer service.CloseResponseBodyGracefully(resp)

	bodyBytes, readErr := io.ReadAll(resp.Body)
	if readErr != nil {
		return nil, types.NewOpenAIError(readErr, types.ErrorCodeReadResponseBodyFailed, http.StatusInternalServerError)
	}

	logger.LogDebug(c, "OCR upstream response: %s", string(bodyBytes))

	// Parse the OCR response
	var ocrResp OCRResponse
	if parseErr := common.Unmarshal(bodyBytes, &ocrResp); parseErr != nil {
		return nil, types.NewOpenAIError(parseErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// Check for API-level errors
	if ocrResp.Code != "" && ocrResp.Code != "200" {
		return nil, types.NewOpenAIError(
			fmt.Errorf("aliyun ocr error [%s]: %s", ocrResp.Code, ocrResp.Message),
			types.ErrorCodeBadResponseBody,
			resp.StatusCode,
		)
	}

	// Build an OpenAI-format chat completion response
	// Serialize the OCR data as the response content
	ocrDataJSON, marshalErr := common.Marshal(ocrResp.Data)
	if marshalErr != nil {
		return nil, types.NewOpenAIError(marshalErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	openAIResp := dto.OpenAITextResponse{
		Id:      fmt.Sprintf("chatcmpl-%s", ocrResp.RequestId),
		Model:   info.OriginModelName,
		Object:  "chat.completion",
		Created: time.Now().Unix(),
		Choices: []dto.OpenAITextResponseChoice{
			{
				Index: 0,
				Message: dto.Message{
					Role:    "assistant",
					Content: string(ocrDataJSON),
				},
				FinishReason: "stop",
			},
		},
		Usage: dto.Usage{
			PromptTokens:     1,
			CompletionTokens: 0,
			TotalTokens:      1,
		},
	}

	openAIBytes, marshalErr := common.Marshal(openAIResp)
	if marshalErr != nil {
		return nil, types.NewOpenAIError(marshalErr, types.ErrorCodeBadResponseBody, http.StatusInternalServerError)
	}

	// Persist raw upstream response, converted result, and original image to disk.
	imageURL := ""
	if info.ExtraLogData != nil {
		if url, ok := info.ExtraLogData["ocr_image_url"].(string); ok {
			imageURL = url
		}
	}
	gopool.Go(func() {
		persistOCRData(ocrResp.RequestId, bodyBytes, openAIBytes, imageURL)
	})

	// Store raw upstream response and converted result for audit/logging.
	if info.ExtraLogData == nil {
		info.ExtraLogData = make(map[string]any)
	}
	info.ExtraLogData["ocr_raw_upstream"] = string(bodyBytes)
	info.ExtraLogData["ocr_converted_openai"] = string(openAIBytes)

	service.IOCopyBytesGracefully(c, resp, openAIBytes)

	return &openAIResp.Usage, nil
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}

// persistOCRData writes the raw upstream response, converted OpenAI result,
// and original input image to disk under /data/ocr/.
func persistOCRData(requestId string, rawBody []byte, convertedBody []byte, imageURL string) {
	if requestId == "" {
		return
	}
	dir := filepath.Join("/", "data", "ocr")
	if err := os.MkdirAll(dir, 0755); err != nil {
		log.Printf("persistOCRData: failed to create dir %s: %v", dir, err)
		return
	}

	rawFile := filepath.Join(dir, requestId+"_raw.json")
	if err := os.WriteFile(rawFile, rawBody, 0644); err != nil {
		log.Printf("persistOCRData: failed to write raw file %s: %v", rawFile, err)
	}

	convFile := filepath.Join(dir, requestId+"_converted.json")
	if err := os.WriteFile(convFile, convertedBody, 0644); err != nil {
		log.Printf("persistOCRData: failed to write converted file %s: %v", convFile, err)
	}

	// Download and save the original image
	if imageURL != "" {
		resp, err := http.Get(imageURL)
		if err != nil {
			log.Printf("persistOCRData: failed to download image %s: %v", imageURL, err)
			return
		}
		defer resp.Body.Close()
		imgBytes, err := io.ReadAll(resp.Body)
		if err != nil {
			log.Printf("persistOCRData: failed to read image body %s: %v", imageURL, err)
			return
		}
		// Determine file extension from URL path or Content-Type
		ext := filepath.Ext(imageURL)
		if ext == "" || len(ext) > 5 {
			ct := resp.Header.Get("Content-Type")
			switch {
			case strings.Contains(ct, "jpeg") || strings.Contains(ct, "jpg"):
				ext = ".jpg"
			case strings.Contains(ct, "png"):
				ext = ".png"
			case strings.Contains(ct, "gif"):
				ext = ".gif"
			case strings.Contains(ct, "webp"):
				ext = ".webp"
			case strings.Contains(ct, "bmp"):
				ext = ".bmp"
			default:
				ext = ".jpg"
			}
		}
		imgFile := filepath.Join(dir, requestId+"_original"+ext)
		if err := os.WriteFile(imgFile, imgBytes, 0644); err != nil {
			log.Printf("persistOCRData: failed to write image file %s: %v", imgFile, err)
		}
	}
}

// parseTypeOverride checks if a text content contains a type override directive.
// Format: "type: IdCard" or "Type: Passport"
func parseTypeOverride(text string) string {
	trimmed := strings.TrimSpace(text)
	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "type:") {
		customType := strings.TrimSpace(trimmed[5:]) // remove "type:" prefix (5 chars)
		if customType != "" {
			return customType
		}
	}
	return ""
}
