package ocrself

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/BaizorAI/new-api/dto"
	relaycommon "github.com/BaizorAI/new-api/relay/common"
	relayconstant "github.com/BaizorAI/new-api/relay/constant"

	"github.com/gin-gonic/gin"
)

// Helper functions for constructing test message objects

func makeImageMsg(role, url string) dto.Message {
	msg := dto.Message{Role: role}
	msg.SetMediaContent([]dto.MediaContent{
		{Type: dto.ContentTypeImageURL, ImageUrl: &dto.MessageImageUrl{Url: url, Detail: "high"}},
	})
	return msg
}

func makeTextAndImageMsg(role, text, url string) dto.Message {
	msg := dto.Message{Role: role}
	msg.SetMediaContent([]dto.MediaContent{
		{Type: dto.ContentTypeText, Text: text},
		{Type: dto.ContentTypeImageURL, ImageUrl: &dto.MessageImageUrl{Url: url, Detail: "high"}},
	})
	return msg
}

// -----------------------------------------------------------------------------
// GetRequestURL
// -----------------------------------------------------------------------------

func TestGetRequestURL(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "https://ocr.example.com",
		},
	}

	adaptor := &Adaptor{}
	got, err := adaptor.GetRequestURL(info)
	if err != nil {
		t.Fatalf("GetRequestURL returned error: %v", err)
	}

	want := "https://ocr.example.com/v1/ocr"
	if got != want {
		t.Fatalf("GetRequestURL() = %q, want %q", got, want)
	}
}

func TestGetRequestURLEmpty(t *testing.T) {
	t.Parallel()

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			ChannelBaseUrl: "",
		},
	}

	adaptor := &Adaptor{}
	_, err := adaptor.GetRequestURL(info)
	if err == nil {
		t.Fatal("expected error for empty base URL, got nil")
	}
}

// -----------------------------------------------------------------------------
// ConvertOpenAIRequest
// -----------------------------------------------------------------------------

func TestConvertOpenAIRequest_IDCard(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	request := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			makeImageMsg("user", "https://example.com/id.jpg"),
		},
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ocr-id-card",
		},
	}

	result, err := adaptor.ConvertOpenAIRequest(c, info, request)
	if err != nil {
		t.Fatalf("ConvertOpenAIRequest returned error: %v", err)
	}

	ocrReq, ok := result.(*OCRRequest)
	if !ok {
		t.Fatalf("expected *OCRRequest, got %T", result)
	}
	if ocrReq.Url != "https://example.com/id.jpg" {
		t.Errorf("Url = %q, want %q", ocrReq.Url, "https://example.com/id.jpg")
	}
	if ocrReq.Type != "IdCard" {
		t.Errorf("Type = %q, want %q", ocrReq.Type, "IdCard")
	}
}

func TestConvertOpenAIRequest_BusinessLicense(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	request := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			makeImageMsg("user", "https://example.com/license.jpg"),
		},
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ocr-business-license",
		},
	}

	result, err := adaptor.ConvertOpenAIRequest(c, info, request)
	if err != nil {
		t.Fatalf("ConvertOpenAIRequest returned error: %v", err)
	}

	ocrReq := result.(*OCRRequest)
	if ocrReq.Type != "BusinessLicense" {
		t.Errorf("Type = %q, want %q", ocrReq.Type, "BusinessLicense")
	}
}

func TestConvertOpenAIRequest_CustomTypeViaMessage(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	request := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			makeTextAndImageMsg("user", "type: Passport", "https://example.com/passport.jpg"),
		},
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ocr-id-card", // model says id-card
		},
	}

	result, err := adaptor.ConvertOpenAIRequest(c, info, request)
	if err != nil {
		t.Fatalf("ConvertOpenAIRequest returned error: %v", err)
	}

	ocrReq := result.(*OCRRequest)
	if ocrReq.Type != "Passport" {
		t.Errorf("Type = %q, want %q (message text should override model)", ocrReq.Type, "Passport")
	}
	if ocrReq.Url != "https://example.com/passport.jpg" {
		t.Errorf("Url = %q, want %q", ocrReq.Url, "https://example.com/passport.jpg")
	}
}

func TestConvertOpenAIRequest_NoImage(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	request := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			{
				Role:    "user",
				Content: "hello, no image here",
			},
		},
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ocr-id-card",
		},
	}

	_, err := adaptor.ConvertOpenAIRequest(c, info, request)
	if err == nil {
		t.Fatal("expected error for missing image, got nil")
	}
}

func TestConvertOpenAIRequest_ExtraBody(t *testing.T) {
	t.Parallel()

	adaptor := &Adaptor{}
	gin.SetMode(gin.TestMode)
	c, _ := gin.CreateTestContext(httptest.NewRecorder())

	request := &dto.GeneralOpenAIRequest{
		Messages: []dto.Message{
			makeImageMsg("user", "https://example.com/id.jpg"),
		},
		ExtraBody: json.RawMessage(`{"output_char_info":true,"output_table":true}`),
	}

	info := &relaycommon.RelayInfo{
		ChannelMeta: &relaycommon.ChannelMeta{
			UpstreamModelName: "ocr-id-card",
		},
	}

	result, err := adaptor.ConvertOpenAIRequest(c, info, request)
	if err != nil {
		t.Fatalf("ConvertOpenAIRequest returned error: %v", err)
	}

	ocrReq := result.(*OCRRequest)
	if !ocrReq.OutputCharInfo {
		t.Error("OutputCharInfo should be true")
	}
	if !ocrReq.OutputTable {
		t.Error("OutputTable should be true")
	}
}

// -----------------------------------------------------------------------------
// DoResponse
// -----------------------------------------------------------------------------

func TestDoResponse_Success(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	ocrResp := OCRResponse{
		RequestId: "test-request-id-12345",
		Data: &OCRData{
			Height:        800,
			Width:         600,
			SubImageCount: 1,
			SubImages: []OCRSubImage{
				{
					SubImageId: 0,
					Type:       "身份证正面",
					KvInfo: &OCRKVInfo{
						KvCount: 2,
						Data: map[string]string{
							"name":     "张三",
							"idNumber": "110101199001011234",
						},
						KvDetails: map[string]*OCRKVDetail{
							"name":     {KeyName: "name", Value: "张三", KeyConfidence: 99.5, ValueConfidence: 99.5},
							"idNumber": {KeyName: "idNumber", Value: "110101199001011234", KeyConfidence: 98.2, ValueConfidence: 98.2},
						},
					},
				},
			},
		},
	}
	respBody, _ := json.Marshal(ocrResp)

	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "ocr-id-card",
	}

	resp := &http.Response{
		StatusCode: http.StatusOK,
		Header:     make(http.Header),
	}
	resp.Body = ioNopCloser(string(respBody))

	adaptor := &Adaptor{}
	usage, apiErr := adaptor.DoResponse(c, resp, info)
	if apiErr != nil {
		t.Fatalf("DoResponse returned error: %v", apiErr)
	}
	if usage == nil {
		t.Fatal("DoResponse returned nil usage")
	}

	body := recorder.Body.String()
	t.Logf("Response body: %s", body)

	var oaiResp map[string]any
	if err := json.Unmarshal([]byte(body), &oaiResp); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}

	if oaiResp["object"] != "chat.completion" {
		t.Errorf("object = %q, want %q", oaiResp["object"], "chat.completion")
	}
	if oaiResp["model"] != "ocr-id-card" {
		t.Errorf("model = %q, want %q", oaiResp["model"], "ocr-id-card")
	}

	choices, ok := oaiResp["choices"].([]any)
	if !ok || len(choices) == 0 {
		t.Fatal("choices is empty or missing")
	}
	choice := choices[0].(map[string]any)
	message := choice["message"].(map[string]any)
	content := message["content"].(string)

	var ocrData OCRData
	if err := json.Unmarshal([]byte(content), &ocrData); err != nil {
		t.Fatalf("choice content is not valid OCRData JSON: %v", err)
	}
	if len(ocrData.SubImages) == 0 || ocrData.SubImages[0].KvInfo == nil || ocrData.SubImages[0].KvInfo.KvCount != 2 {
		t.Errorf("expected 2 KvInfo items, got %v", ocrData.SubImages)
	}
}

func TestDoResponse_APIError(t *testing.T) {
	t.Parallel()

	gin.SetMode(gin.TestMode)
	recorder := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(recorder)

	ocrResp := OCRResponse{
		RequestId: "error-request-id",
		Code:      "InvalidParameter",
		Message:   "The specified parameter Type is not valid.",
	}
	respBody, _ := json.Marshal(ocrResp)

	info := &relaycommon.RelayInfo{
		RelayMode:       relayconstant.RelayModeChatCompletions,
		OriginModelName: "ocr-id-card",
	}

	resp := &http.Response{
		StatusCode: http.StatusBadRequest,
		Header:     make(http.Header),
	}
	resp.Body = ioNopCloser(string(respBody))

	adaptor := &Adaptor{}
	_, apiErr := adaptor.DoResponse(c, resp, info)
	if apiErr == nil {
		t.Fatal("expected error for API-level error, got nil")
	}
	t.Logf("Expected error: %v", apiErr)
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

type nopCloser struct {
	*strings.Reader
}

func (n nopCloser) Close() error { return nil }

func ioNopCloser(body string) nopCloser {
	return nopCloser{Reader: strings.NewReader(body)}
}
