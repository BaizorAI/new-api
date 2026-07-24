package common

import (
	"sync"
)

// HermesConfig holds environment-driven configuration for the Hermes sidecar.
// Values are read once on first access so callers do not pay the cost of
// repeated os.Getenv lookups and so defaults live in one place.
type HermesConfig struct {
	SidecarEnabled    bool
	APIURL            string
	APIKey            string
	APIPort           int
	DataDir           string
	Image             string
	WeixinQREnabled   bool
	InferenceBaseURL  string
	InferenceAPIKey   string
	UID               int
	GID               int
	Network           string
	ComfyUIServiceURL string

	WeixinActionRateLimitEnable   bool
	WeixinActionRateLimitNum      int
	WeixinActionRateLimitDuration int64
	WeixinStatusRateLimitEnable   bool
	WeixinStatusRateLimitNum      int
	WeixinStatusRateLimitDuration int64
}

const (
	defaultHermesAPIURL           = "http://hermes:8642"
	defaultHermesAPIPort          = 8642
	defaultHermesDataDir          = "/opt/data"
	defaultHermesImage            = "ccr.ccs.tencentyun.com/lucky/baizor-hermes:1.0.27"
	defaultHermesInferenceBaseURL = "http://new-api:3000/v1"
	defaultHermesUID              = 10000
	defaultHermesGID              = 10000
	defaultHermesNetwork          = "new-api-network"
	defaultComfyUIServiceURL      = "http://hermes:8650"
)

var (
	hermesConfig     HermesConfig
	hermesConfigOnce sync.Once
)

// GetHermesConfig returns the cached Hermes sidecar configuration. The first
// call loads values from environment variables; subsequent calls return the
// same instance. Callers must not mutate the returned struct.
func GetHermesConfig() *HermesConfig {
	hermesConfigOnce.Do(loadHermesConfig)
	return &hermesConfig
}

// ReloadHermesConfig forces the configuration to be re-read from environment
// variables. It is intended for tests and should not be used in production
// hot paths.
func ReloadHermesConfig() {
	hermesConfigOnce = sync.Once{}
	hermesConfigOnce.Do(loadHermesConfig)
}

func loadHermesConfig() {
	hermesConfig = HermesConfig{
		SidecarEnabled:    GetEnvOrDefaultBool("HERMES_SIDECAR_ENABLED", false),
		APIURL:            GetEnvOrDefaultString("HERMES_API_SERVER_URL", defaultHermesAPIURL),
		APIKey:            GetEnvOrDefaultString("HERMES_API_SERVER_KEY", ""),
		APIPort:           GetEnvOrDefault("HERMES_API_SERVER_PORT", defaultHermesAPIPort),
		DataDir:           GetEnvOrDefaultString("HERMES_DATA_DIR", defaultHermesDataDir),
		Image:             GetEnvOrDefaultString("HERMES_IMAGE", defaultHermesImage),
		WeixinQREnabled:   GetEnvOrDefaultBool("HERMES_WEIXIN_QR_ENABLED", true),
		InferenceBaseURL:  GetEnvOrDefaultString("HERMES_INFERENCE_BASE_URL", defaultHermesInferenceBaseURL),
		InferenceAPIKey:   GetEnvOrDefaultString("HERMES_INFERENCE_API_KEY", ""),
		UID:               GetEnvOrDefault("HERMES_UID", defaultHermesUID),
		GID:               GetEnvOrDefault("HERMES_GID", defaultHermesGID),
		Network:           GetEnvOrDefaultString("HERMES_NETWORK", defaultHermesNetwork),
		ComfyUIServiceURL: GetEnvOrDefaultString("COMFTYUI_SERVICE_URL", defaultComfyUIServiceURL),

		WeixinActionRateLimitEnable:   GetEnvOrDefaultBool("HERMES_WEIXIN_ACTION_RATE_LIMIT_ENABLE", true),
		WeixinActionRateLimitNum:      GetEnvOrDefault("HERMES_WEIXIN_ACTION_RATE_LIMIT", 6),
		WeixinActionRateLimitDuration: int64(GetEnvOrDefault("HERMES_WEIXIN_ACTION_RATE_LIMIT_DURATION", 60)),
		WeixinStatusRateLimitEnable:   GetEnvOrDefaultBool("HERMES_WEIXIN_STATUS_RATE_LIMIT_ENABLE", true),
		WeixinStatusRateLimitNum:      GetEnvOrDefault("HERMES_WEIXIN_STATUS_RATE_LIMIT", 40),
		WeixinStatusRateLimitDuration: int64(GetEnvOrDefault("HERMES_WEIXIN_STATUS_RATE_LIMIT_DURATION", 60)),
	}
}
