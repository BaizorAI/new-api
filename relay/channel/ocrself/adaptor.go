package ocrself

import (
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/BaizorAI/new-api/dto"
	"github.com/BaizorAI/new-api/relay/channel"
	"github.com/BaizorAI/new-api/relay/channel/ocrali"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	"github.com/BaizorAI/new-api/types"

	"github.com/gin-gonic/gin"
)

// Adaptor implements the channel.Adaptor interface for a self-hosted OCR service.
// It reuses the request/response contract and OpenAI conversion logic from
// relay/channel/ocrali so that the upstream service contract matches Alibaba
// Cloud OCR while the transport and authentication are local.
type Adaptor struct{}

func (a *Adaptor) Init(info *relaycommon.RelayInfo) {}

// GetRequestURL returns the self-hosted OCR endpoint.
// The channel base URL is configurable per channel; we append a fixed path.
func (a *Adaptor) GetRequestURL(info *relaycommon.RelayInfo) (string, error) {
	if info.ChannelBaseUrl == "" {
		return "", errors.New("channel base URL is empty")
	}
	return fmt.Sprintf("%s/v1/ocr", info.ChannelBaseUrl), nil
}

func (a *Adaptor) SetupRequestHeader(c *gin.Context, req *http.Header, info *relaycommon.RelayInfo) error {
	channel.SetupApiRequestHeader(info, c, req)
	req.Set("Authorization", fmt.Sprintf("Bearer %s", info.ApiKey))
	return nil
}

// ConvertOpenAIRequest extracts image data and OCR type from the OpenAI chat
// request and converts it to an OCRRequest. The logic is identical to ocrali.
func (a *Adaptor) ConvertOpenAIRequest(c *gin.Context, info *relaycommon.RelayInfo, request *dto.GeneralOpenAIRequest) (any, error) {
	return (&ocrali.Adaptor{}).ConvertOpenAIRequest(c, info, request)
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

// DoRequest forwards the converted OCR request to the self-hosted service.
func (a *Adaptor) DoRequest(c *gin.Context, info *relaycommon.RelayInfo, requestBody io.Reader) (any, error) {
	return channel.DoApiRequest(a, c, info, requestBody)
}

// DoResponse parses the self-hosted OCR response and formats it as an OpenAI
// chat completion response. The conversion logic is identical to ocrali.
func (a *Adaptor) DoResponse(c *gin.Context, resp *http.Response, info *relaycommon.RelayInfo) (usage any, err *types.NewAPIError) {
	return (&ocrali.Adaptor{}).DoResponse(c, resp, info)
}

func (a *Adaptor) GetModelList() []string {
	return ModelList
}

func (a *Adaptor) GetChannelName() string {
	return ChannelName
}
