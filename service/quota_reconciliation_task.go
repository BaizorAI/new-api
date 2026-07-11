package service

import (
	"context"
	"os"
	"strconv"
	"sync"
	"time"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/logger"
	"github.com/BaizorAI/new-api/model"
	"github.com/bytedance/gopkg/util/gopool"
)

const quotaReconcileDefaultInterval = 30 * time.Minute

var quotaReconcileOnce sync.Once

func quotaReconcileInterval() time.Duration {
	if v := os.Getenv("QUOTA_RECONCILE_INTERVAL_MIN"); v != "" {
		if n, err := strconv.Atoi(v); err == nil && n > 0 {
			return time.Duration(n) * time.Minute
		}
	}
	return quotaReconcileDefaultInterval
}

// StartQuotaReconciliationTask 启动额度对账周期任务（仅主节点运行）。
// 定期调用 model.RunQuotaReconciliationOnce 校验「个人钱包 + 团队池 + 充值/退款/划拨」
// 的一致性，偏差超过 model.ReconcileDriftThreshold 时写入 LogTypeReconcile 告警日志。
// 可通过环境变量 QUOTA_RECONCILE_INTERVAL_MIN（分钟）调整周期，默认 30 分钟。
func StartQuotaReconciliationTask() {
	quotaReconcileOnce.Do(func() {
		if !common.IsMasterNode {
			return
		}
		interval := quotaReconcileInterval()
		gopool.Go(func() {
			logger.LogInfo(context.Background(), "quota reconciliation task started: tick="+interval.String())
			ticker := time.NewTicker(interval)
			defer ticker.Stop()
			model.RunQuotaReconciliationOnce(context.Background())
			for range ticker.C {
				model.RunQuotaReconciliationOnce(context.Background())
			}
		})
	})
}
