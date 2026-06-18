package model_setting

import "github.com/BaizorAI/new-api/setting/config"

// CliDefaultModelSettings defines which models the CLI should use by default.
type CliDefaultModelSettings struct {
	Model       string `json:"model"`
	HaikuModel  string `json:"haiku_model"`
	SonnetModel string `json:"sonnet_model"`
	OpusModel   string `json:"opus_model"`
}

var defaultCliDefaultModelSettings = CliDefaultModelSettings{
	Model:       "deepseek-v4-pro-max",
	HaikuModel:  "deepseek-v4-pro-max",
	SonnetModel: "deepseek-v4-pro",
	OpusModel:   "deepseek-v4-pro-max",
}

var cliDefaultModelSettings = defaultCliDefaultModelSettings

func init() {
	config.GlobalConfig.Register("cli_default_model", &cliDefaultModelSettings)
}

// GetCliDefaultModelSettings returns the CLI default model settings.
func GetCliDefaultModelSettings() *CliDefaultModelSettings {
	return &cliDefaultModelSettings
}
