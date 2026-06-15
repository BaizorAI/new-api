package system_setting

import (
	"github.com/BaizorAI/new-api/setting/config"
)

type ThemeSettings struct {
	Frontend string `json:"frontend"`
}

var themeSettings = ThemeSettings{
	Frontend: "default",
}

func init() {
	config.GlobalConfig.Register("theme", &themeSettings)
	// Theme is locked to "default" — classic theme has been removed.
}

func GetThemeSettings() *ThemeSettings {
	return &themeSettings
}
