package controller

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

type subscriptionWeChatPayRequest struct {
	PlanId int `json:"plan_id"`
}

// SubscriptionRequestWeChatPay creates a WeChat Pay Native order for a subscription plan.
func SubscriptionRequestWeChatPay(c *gin.Context) {
	if !requirePaymentCompliance(c) {
		return
	}

	if !isWeChatPayTopUpEnabled() {
		common.ApiErrorMsg(c, "微信支付未启用")
		return
	}

	var req subscriptionWeChatPayRequest
	if err := c.ShouldBindJSON(&req); err != nil || req.PlanId <= 0 {
		common.ApiErrorMsg(c, "参数错误")
		return
	}

	plan, err := model.GetSubscriptionPlanById(req.PlanId)
	if err != nil {
		common.ApiError(c, err)
		return
	}
	if !plan.Enabled {
		common.ApiErrorMsg(c, "套餐未启用")
		return
	}
	if plan.PriceAmount < 0.01 {
		common.ApiErrorMsg(c, "套餐金额过低")
		return
	}

	userId := c.GetInt("id")
	if plan.MaxPurchasePerUser > 0 {
		count, err := model.CountUserSubscriptionsByPlan(userId, plan.Id)
		if err != nil {
			common.ApiError(c, err)
			return
		}
		if count >= int64(plan.MaxPurchasePerUser) {
			common.ApiErrorMsg(c, "已达到该套餐购买上限")
			return
		}
	}

	// Generate trade number with SUBUSR prefix for subscription
	tradeNo := fmt.Sprintf("WP%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("SUBUSR%dNO%s", userId, tradeNo)

	// Get callback URL — prefer WECHAT_PAY_NATIVE_CALLBACK_URL env var,
	// fall back to GetCallbackAddress() which reads admin UI settings.
	callBackAddress := common.WeChatPayNativeCallbackURL
	if callBackAddress == "" {
		callBackAddress = service.GetCallbackAddress()
	}
	notifyURL, err := url.JoinPath(callBackAddress, "/api/subscription/wechat-pay/notify")
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 callback URL 构建失败: %s", err.Error()))
		common.ApiErrorMsg(c, "回调地址配置错误")
		return
	}

	// Calculate expiry time
	closeGap := common.WeChatPayNativeCloseOrderGap
	if closeGap <= 0 {
		closeGap = 30
	}
	expireTime := time.Now().Add(time.Duration(closeGap) * time.Minute)
	timeExpire := expireTime.Format(time.RFC3339)

	// Convert yuan to fen (cents)
	amountInFen := int(plan.PriceAmount * 100)
	if amountInFen < 1 {
		amountInFen = 1
	}

	// Build WeChat Pay Native request
	payReq := wechatPayNativeRequest{
		Appid:       common.WeChatPayNativeAppId,
		Mchid:       common.WeChatPayMachId,
		Description: fmt.Sprintf("订阅套餐 - %s", plan.Title),
		OutTradeNo:  tradeNo,
		NotifyUrl:   notifyURL,
		Amount: wechatPayAmount{
			Total:    amountInFen,
			Currency: "CNY",
		},
		TimeExpire: timeExpire,
	}

	bodyBytes, err := common.Marshal(payReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 请求序列化失败: %s", err.Error()))
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	// Call WeChat Pay API
	urlPath := "/v3/pay/transactions/native"
	authHeader, err := wechatPayBuildAuthHeader("POST", urlPath, bodyBytes)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 签名失败: %s", err.Error()))
		common.ApiErrorMsg(c, "支付配置错误")
		return
	}

	httpReq, err := http.NewRequest("POST", getWeChatPayBaseURL()+urlPath, strings.NewReader(string(bodyBytes)))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 请求创建失败: %s", err.Error()))
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}
	httpReq.Header.Set("Authorization", authHeader)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 20 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 API 调用失败: %s", err.Error()))
		common.ApiErrorMsg(c, "支付接口调用失败")
		return
	}
	defer httpResp.Body.Close()

	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 读取响应失败: %s", err.Error()))
		common.ApiErrorMsg(c, "支付接口响应异常")
		return
	}

	if httpResp.StatusCode != 200 {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 API 返回错误: status=%d body=%s", httpResp.StatusCode, string(respBody)))
		common.ApiErrorMsg(c, fmt.Sprintf("微信支付接口返回错误(HTTP %d)，请检查服务器日志获取详细信息", httpResp.StatusCode))
		return
	}

	var payResp wechatPayNativeResponse
	if err := common.Unmarshal(respBody, &payResp); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 响应解析失败: %s", err.Error()))
		common.ApiErrorMsg(c, "支付接口响应解析失败")
		return
	}

	if payResp.CodeUrl == "" {
		logger.LogError(c.Request.Context(), "微信支付订阅 code_url 为空")
		common.ApiErrorMsg(c, "获取支付二维码失败")
		return
	}

	// Create subscription order
	order := &model.SubscriptionOrder{
		UserId:          userId,
		PlanId:          plan.Id,
		Money:           plan.PriceAmount,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWeChatPay,
		PaymentProvider: model.PaymentProviderWeChatPay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	if err := order.Insert(); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 创建订单失败 user_id=%d trade_no=%s plan_id=%d error=%q", userId, tradeNo, plan.Id, err.Error()))
		common.ApiErrorMsg(c, "创建订单失败")
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付订阅 订单创建成功 user_id=%d trade_no=%s plan_id=%d money=%.2f code_url=%s", userId, tradeNo, plan.Id, plan.PriceAmount, payResp.CodeUrl))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"code_url": payResp.CodeUrl,
			"trade_no": tradeNo,
		},
	})
}

// SubscriptionWeChatPayNotify handles the WeChat Pay callback for subscription orders.
func SubscriptionWeChatPayNotify(c *gin.Context) {
	// Verify the callback signature
	if err := wechatPayVerifyCallbackSignature(c); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 回调签名验证失败: %s", err.Error()))
		c.JSON(http.StatusForbidden, gin.H{"code": "FAIL", "message": "签名验证失败"})
		return
	}

	// Parse the callback body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 回调读取body失败: %s", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "读取请求失败"})
		return
	}

	var notify wechatPayNotifyDecrypted
	if err := common.Unmarshal(bodyBytes, &notify); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 回调解析失败: %s", err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "解析请求失败"})
		return
	}

	// Only process successful transactions
	if notify.EventType != "TRANSACTION.SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付订阅 回调事件类型 %s 不需要处理", notify.EventType))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": ""})
		return
	}

	// Decrypt the resource
	plaintext, err := wechatPayDecryptNotify(notify.Resource.Ciphertext, notify.Resource.AssociatedData, notify.Resource.Nonce)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 解密回调资源失败: %s", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "解密失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付订阅 回调解密成功: %s", plaintext))

	var transaction wechatPayTransaction
	if err := common.Unmarshal([]byte(plaintext), &transaction); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 解析交易数据失败: %s", err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "解析交易数据失败"})
		return
	}

	// Only process SUCCESS state
	if transaction.TradeState != "SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付订阅 交易状态为 %s，跳过处理", transaction.TradeState))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": ""})
		return
	}

	// Complete the subscription order
	LockOrder(transaction.OutTradeNo)
	defer UnlockOrder(transaction.OutTradeNo)

	if err := model.CompleteSubscriptionOrder(transaction.OutTradeNo, transaction.TransactionID, model.PaymentProviderWeChatPay, model.PaymentMethodWeChatPay); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付订阅 完成订单失败 trade_no=%s transaction_id=%s error=%q", transaction.OutTradeNo, transaction.TransactionID, err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": err.Error()})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付订阅 支付成功 trade_no=%s transaction_id=%s amount=%d", transaction.OutTradeNo, transaction.TransactionID, transaction.Amount.Total))

	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": ""})
}
