package model

import (
	"context"
	"fmt"

	"github.com/BaizorAI/new-api/common"
	"github.com/BaizorAI/new-api/logger"
)

// ReconcileDriftThreshold 是额度对账允许的偏差阈值（quota 单位）。
// 小于该阈值的偏差视为正常口径噪声（如 used_quota 与消费日志的异步刷库差异），不上报告警。
// 默认 50,000,000 单位 ≈ 100 美元 ≈ ¥730（按 7.3）。
const ReconcileDriftThreshold int64 = 50_000_000

// quotaReconcileAgg 聚合单个用户在 logs 表中的资金流水。
type quotaReconcileAgg struct {
	UserId int
	Type   int
	Sum    int64
}

// RunQuotaReconciliationOnce 对所有有资金流水的用户校验一次额度不变量：
//
//	quota + used_quota + Σtransfer(个人→团队) − Σtopup + Σrefund ≈ 0
//
// 偏差超过 ReconcileDriftThreshold 时，写一条 LogTypeReconcile 日志用于告警。
// 该函数为只读 best-effort 检测，不修改任何数据；可随时重复执行。
func RunQuotaReconciliationOnce(ctx context.Context) {
	logDB := LOG_DB
	if logDB == nil {
		logDB = DB
	}
	if logDB == nil {
		common.SysLog("quota reconciliation: no database handle, skip")
		return
	}

	var aggRows []quotaReconcileAgg
	if err := logDB.Table("logs").
		Select("user_id, type, COALESCE(SUM(quota), 0) AS sum").
		Where("type IN ?", []int{LogTypeTopup, LogTypeRefund, LogTypeTransfer}).
		Group("user_id, type").
		Scan(&aggRows).Error; err != nil {
		common.SysLog("quota reconciliation: aggregate logs failed: " + err.Error())
		return
	}

	agg := make(map[int]map[int]int64, len(aggRows))
	for _, r := range aggRows {
		m := agg[r.UserId]
		if m == nil {
			m = make(map[int]int64)
			agg[r.UserId] = m
		}
		m[r.Type] = r.Sum
	}

	const pageSize = 500
	lastId := 0
	checked := 0
	drifted := 0

	for {
		if ctx.Err() != nil {
			common.SysLog("quota reconciliation: cancelled")
			return
		}

		var users []User
		if err := DB.Where("id > ?", lastId).Order("id").Limit(pageSize).Find(&users).Error; err != nil {
			common.SysLog("quota reconciliation: scan users failed: " + err.Error())
			return
		}
		if len(users) == 0 {
			break
		}

		for _, u := range users {
			lastId = u.Id
			a := agg[u.Id]
			var topup, refund, transfer int64
			if a != nil {
				topup = a[LogTypeTopup]
				refund = a[LogTypeRefund]
				transfer = a[LogTypeTransfer]
			}
			// 没有任何资金流水的用户无需校验。
			if topup == 0 && refund == 0 && transfer == 0 {
				continue
			}
			checked++

			drift := int64(u.Quota) + int64(u.UsedQuota) + transfer - topup + refund
			if drift > ReconcileDriftThreshold || drift < -ReconcileDriftThreshold {
				drifted++
				RecordLog(u.Id, LogTypeReconcile, fmt.Sprintf(
					"额度对账偏差 %s（当前余额 %s，累计已用 %s，转入团队 %s，累计充值 %s，累计退款 %s）",
					logger.LogQuota(int(drift)),
					logger.LogQuota(u.Quota),
					logger.LogQuota(u.UsedQuota),
					logger.LogQuota(int(transfer)),
					logger.LogQuota(int(topup)),
					logger.LogQuota(int(refund)),
				))
			}
		}

		if len(users) < pageSize {
			break
		}
	}

	common.SysLog(fmt.Sprintf("quota reconciliation done: checked=%d drifted=%d threshold=%d", checked, drifted, ReconcileDriftThreshold))
}
