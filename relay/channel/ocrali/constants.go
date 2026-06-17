package ocrali

// ModelList defines the models supported by this channel.
// The model name maps to the Alibaba Cloud OCR API's Type parameter
// which specifies the document type to recognize.
var ModelList = []string{
	"ocr-id-card",              // 身份证
	"ocr-business-license",     // 营业执照
	"ocr-bank-card",            // 银行卡
	"ocr-driver-license",       // 驾驶证
	"ocr-vehicle-license",      // 行驶证
	"ocr-passport",             // 护照
	"ocr-household-register",   // 户口本
	"ocr-marriage-certificate", // 结婚证
	"ocr-vehicle-cert",         // 车辆合格证
	"ocr-general",              // 通用文字识别
}

// ChannelName identifies this channel for logging and configuration.
var ChannelName = "ocrali"
