package ocrself

// ModelList defines the models supported by the self-hosted OCR channel.
// The model names are kept identical to ocrali.ModelList so clients can
// switch between AliOCR and OcrSelf without changing request model names.
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
	"ocr-vehicle-registration", // 机动车登记证书
	"ocr-general",              // 通用文字识别
}

// ChannelName identifies this channel for logging and configuration.
var ChannelName = "ocrself"
