package ocrali

// OCRRequest is the request body sent to Alibaba Cloud OCR RecognizeAllText API.
// Ref: https://help.aliyun.com/zh/ocr/developer-reference/api-ocr-api-2021-07-07-recognizealltext
type OCRRequest struct {
	Url            string `json:"Url,omitempty"`
	ImageBase64    string `json:"ImageBase64,omitempty"`
	Type           string `json:"Type"`
	OutputFormat   string `json:"OutputFormat,omitempty"`
	OutputCharInfo bool   `json:"OutputCharInfo,omitempty"`
	OutputTable    bool   `json:"OutputTable,omitempty"`
	OutputPDF      bool   `json:"Output_PDF,omitempty"`
	OutputStamp    bool   `json:"OutputStamp,omitempty"`
	BarCode        bool   `json:"BarCode,omitempty"`
}

// OCRResponse is the top-level response from Alibaba Cloud OCR.
type OCRResponse struct {
	RequestId string   `json:"RequestId"`
	Code      string   `json:"Code"`
	Message   string   `json:"Message"`
	Data      *OCRData `json:"Data"`
}

// OCRData contains the recognized content.
type OCRData struct {
	Content        string         `json:"Content"`
	SubImageCount  int            `json:"SubImageCount"`
	SubImages      []OCRSubImage  `json:"SubImages"`
	Height         int            `json:"Height"`
	Width          int            `json:"Width"`
	PdfPageSize    int            `json:"PdfPageSize"`
}

// OCRSubImage represents a sub-region in the recognized image.
type OCRSubImage struct {
	SubImageId  int            `json:"SubImageId"`
	Type        string         `json:"Type"`        // e.g. "身份证正面", "身份证背面"
	Angle       int            `json:"Angle"`
	KvInfo      *OCRKVInfo     `json:"KvInfo"`
	QualityInfo *OCRQualityInfo `json:"QualityInfo"`
}

// OCRKVInfo is the structured key-value recognition result.
// It contains a flat map of field→value and detailed per-field confidence info.
type OCRKVInfo struct {
	KvCount   int                      `json:"KvCount"`
	Data      map[string]string        `json:"Data"`      // field name → value, e.g. "name" → "张三"
	KvDetails map[string]*OCRKVDetail  `json:"KvDetails"` // field name → detailed info
}

// OCRKVDetail contains detailed recognition info for a single field.
type OCRKVDetail struct {
	KeyName         string  `json:"KeyName"`
	Value           string  `json:"Value"`
	KeyConfidence   float64 `json:"KeyConfidence"`
	ValueConfidence float64 `json:"ValueConfidence"`
	ValueAngle      int     `json:"ValueAngle"`
}

// OCRQualityInfo contains quality check results.
type OCRQualityInfo struct {
	IsCopy bool `json:"IsCopy"`
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
	"ocr-vehicle-cert":         "VehicleCertificate",
	"ocr-general":              "General",
}
