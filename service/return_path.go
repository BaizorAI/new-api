package service

import (
	"strings"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/setting/system_setting"
)

func PaymentReturnURL(suffix string) string {
	base := strings.TrimRight(system_setting.ServerAddress, "/")
	return base + common.ThemeAwarePath(suffix)
}
