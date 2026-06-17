package ocrali

// OCRRequest is the request body sent to Alibaba Cloud OCR RecognizeAllText API.
// Ref: https://help.aliyun.com/zh/ocr/developer-reference/api-ocr-api-2021-07-07-recognizealltext
type OCRRequest struct {
	// Url of the image. Either Url or ImageBase64 must be provided.
	Url string `json:"Url,omitempty"`
	// ImageBase64 is the base64-encoded image data (without data URI prefix).
	ImageBase64 string `json:"ImageBase64,omitempty"`
	// Type specifies the document type, e.g. "IdCard", "BusinessLicense", "BankCard".
	Type string `json:"Type"`
	// OutputFormat specifies the response format. Default is "json".
	OutputFormat string `json:"OutputFormat,omitempty"`
	// OutputCharInfo includes character-level position info when set to true.
	OutputCharInfo bool `json:"OutputCharInfo,omitempty"`
	// OutputTable includes table recognition results when set to true.
	OutputTable bool `json:"OutputTable,omitempty"`
	// Output_PDF includes PDF recognition when set to true.
	OutputPDF bool `json:"Output_PDF,omitempty"`
	// OutputStamp includes stamp/seal recognition when set to true.
	OutputStamp bool `json:"OutputStamp,omitempty"`
	// BarCode returns barcode info when set to true.
	BarCode bool `json:"BarCode,omitempty"`
}

// OCRResponse is the response from Alibaba Cloud OCR RecognizeAllText API.
type OCRResponse struct {
	// RequestId is the unique request identifier.
	RequestId string `json:"RequestId"`
	// Code is the status code. Empty or "200" means success.
	Code string `json:"Code"`
	// Message is the error message when Code is non-empty/non-200.
	Message string `json:"Message"`
	// Data is the OCR recognition result.
	Data *OCRData `json:"Data"`
}

// OCRData contains the recognized content.
type OCRData struct {
	// Content is the full recognized text (if OutputFormat is "text").
	Content string `json:"Content"`
	// SubImageCount is the number of sub-images processed.
	SubImageCount int `json:"SubImageCount"`
	// KvInfo contains key-value pair recognition results for structured documents.
	KvInfo []OCRKVItem `json:"KvInfo"`
	// SubImages contains per-region recognition details.
	SubImages []OCRSubImage `json:"SubImages"`
	// Height of the original image.
	Height int `json:"Height"`
	// Width of the original image.
	Width int `json:"Width"`
	// PdfPageSize is the number of PDF pages processed.
	PdfPageSize int `json:"PdfPageSize"`
}

// OCRKVItem is a key-value pair from structured document recognition.
type OCRKVItem struct {
	// Key is the field name (e.g., "Name", "IdNumber").
	Key string `json:"Key"`
	// Value is the recognized value for the field.
	Value string `json:"Value"`
	// Confidence is the confidence score (0-100).
	Confidence float64 `json:"Confidence"`
	// KeyRect is the position of the key in the image.
	KeyRect *OCRRect `json:"KeyRect"`
	// ValueRect is the position of the value in the image.
	ValueRect *OCRRect `json:"ValueRect"`
}

// OCRSubImage represents a sub-region in the recognized image.
type OCRSubImage struct {
	// SubImageIndex is the index of this sub-image.
	SubImageIndex int `json:"SubImageIndex"`
	// KvInfo contains key-value pairs for this sub-image.
	KvInfo []OCRKVItem `json:"KvInfo"`
	// SubImageRect is the position of this sub-image.
	SubImageRect *OCRRect `json:"SubImageRect"`
}

// OCRRect represents a rectangular region in an image.
type OCRRect struct {
	X      int `json:"X"`
	Y      int `json:"Y"`
	Width  int `json:"Width"`
	Height int `json:"Height"`
}

// ModelToOCRType maps internal model names to Alibaba Cloud OCR Type values.
var ModelToOCRType = map[string]string{
	"ocr-id-card":              "IdCard",
	"ocr-business-license":     "BusinessLicense",
	"ocr-bank-card":            "BankCard",
	"ocr-driver-license":       "DriverLicense",
	"ocr-vehicle-license":      "VehicleLicense",
	"ocr-passport":             "Passport",
	"ocr-household-register":   "HouseholdRegister",
	"ocr-marriage-certificate": "MarriageCertificate",
	"ocr-general":              "General",
}
