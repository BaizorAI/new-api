package controller

import (
	"crypto"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/logger"
	"github.com/QuantumNous/new-api/model"
	"github.com/QuantumNous/new-api/service"

	"github.com/gin-gonic/gin"
)

// ============================================================================
// WeChat Pay APIv3 — Data Transfer Objects
// ============================================================================

type wechatPayAmount struct {
	Total    int    `json:"total"`    // amount in fen (cents)
	Currency string `json:"currency"` // CNY
}

type wechatPayPayer struct {
	Openid string `json:"openid,omitempty"`
}

type wechatPayNativeRequest struct {
	Appid       string           `json:"appid"`
	Mchid       string           `json:"mchid"`
	Description string           `json:"description"`
	OutTradeNo  string           `json:"out_trade_no"`
	NotifyUrl   string           `json:"notify_url"`
	Amount      wechatPayAmount  `json:"amount"`
	Payer       *wechatPayPayer  `json:"payer,omitempty"`
	TimeExpire  string           `json:"time_expire,omitempty"`
}

type wechatPayNativeResponse struct {
	CodeUrl  string `json:"code_url"`
	PrepayId string `json:"prepay_id"`
}

// wechatPayNotify is the decrypted callback body.
type wechatPayNotifyDecrypted struct {
	ID           string           `json:"id"`
	CreateTime   string           `json:"create_time"`
	ResourceType string           `json:"resource_type"`
	EventType    string           `json:"event_type"`
	Summary      string           `json:"summary"`
	Resource     wechatPayResource `json:"resource"`
}

type wechatPayResource struct {
	Algorithm      string `json:"algorithm"`
	Ciphertext     string `json:"ciphertext"`
	AssociatedData string `json:"associated_data"`
	Nonce          string `json:"nonce"`
	OriginalType   string `json:"original_type"`

	// Plaintext is the decrypted transaction data.
	Plaintext string `json:"plaintext"`
}

type wechatPayTransaction struct {
	Appid          string `json:"appid"`
	Mchid          string `json:"mchid"`
	OutTradeNo     string `json:"out_trade_no"`
	TransactionID  string `json:"transaction_id"`
	TradeType      string `json:"trade_type"`
	TradeState     string `json:"trade_state"`
	TradeStateDesc string `json:"trade_state_desc"`
	BankType       string `json:"bank_type"`
	SuccessTime    string `json:"success_time"`
	Payer          struct {
		Openid string `json:"openid"`
	} `json:"payer"`
	Amount struct {
		Total         int    `json:"total"`
		PayerTotal    int    `json:"payer_total"`
		Currency      string `json:"currency"`
		PayerCurrency string `json:"payer_currency"`
	} `json:"amount"`
}

// ============================================================================
// WeChat Pay APIv3 Client Helpers
// ============================================================================

// getWeChatPayBaseURL returns the WeChat Pay API base URL.
func getWeChatPayBaseURL() string {
	return "https://api.mch.weixin.qq.com"
}

// loadWeChatPayPrivateKey loads the merchant private key from the configured key path.
func loadWeChatPayPrivateKey() (*rsa.PrivateKey, error) {
	keyPath := common.WeChatPayKeyPath
	if keyPath == "" {
		keyPath = "/root/.certs/wechat"
	}

	// Try apiclient_key.pem first
	keyFile := filepath.Join(keyPath, "apiclient_key.pem")
	data, err := os.ReadFile(keyFile)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key %s: %w", keyFile, err)
	}

	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block from %s", keyFile)
	}

	// Try PKCS#8 first (standard WeChat Pay format), then PKCS#1 (legacy format).
	key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		// PKCS#8 failed — try PKCS#1
		rsaKey, pkcs1Err := x509.ParsePKCS1PrivateKey(block.Bytes)
		if pkcs1Err != nil {
			return nil, fmt.Errorf("failed to parse private key as PKCS#8 (%w) or PKCS#1 (%w)", err, pkcs1Err)
		}
		return rsaKey, nil
	}

	rsaKey, ok := key.(*rsa.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("private key is not RSA")
	}

	return rsaKey, nil
}

// wechatPaySign signs a message using SHA256 with RSA (PKCS#1 v1.5) for WeChat Pay APIv3.
func wechatPaySign(privateKey *rsa.PrivateKey, message string) (string, error) {
	hashed := sha256.Sum256([]byte(message))
	signature, err := rsa.SignPKCS1v15(rand.Reader, privateKey, crypto.SHA256, hashed[:])
	if err != nil {
		return "", fmt.Errorf("sign failed: %w", err)
	}
	return base64.StdEncoding.EncodeToString(signature), nil
}

// wechatPayBuildAuthHeader builds the Authorization header for WeChat Pay APIv3.
func wechatPayBuildAuthHeader(method, urlPath string, body []byte) (string, error) {
	nonceStr := common.GetRandomString(32)
	timestamp := fmt.Sprintf("%d", time.Now().Unix())

	// Build the message to sign: METHOD\nURL\nTIMESTAMP\nNONCE\nBODY\n
	message := fmt.Sprintf("%s\n%s\n%s\n%s\n%s\n", method, urlPath, timestamp, nonceStr, string(body))

	privateKey, err := loadWeChatPayPrivateKey()
	if err != nil {
		return "", err
	}

	signature, err := wechatPaySign(privateKey, message)
	if err != nil {
		return "", err
	}

	mchid := common.WeChatPayMachId
	serial := common.WeChatPaySerial
	if serial == "" {
		return "", fmt.Errorf("WECHAT_PAY_SERIAL is not configured — it must match the certificate serial number uploaded to WeChat Pay merchant platform")
	}

	return fmt.Sprintf(
		`WECHATPAY2-SHA256-RSA2048 mchid="%s",nonce_str="%s",signature="%s",timestamp="%s",serial_no="%s"`,
		mchid, nonceStr, signature, timestamp, serial,
	), nil
}

// wechatPayDecryptNotify decrypts the callback resource.
func wechatPayDecryptNotify(ciphertext, associatedData, nonce string) (string, error) {
	apiV3Key := common.WeChatPayApiV3Key
	if apiV3Key == "" {
		return "", fmt.Errorf("WECHAT_PAY_APIV3_KEY not configured")
	}

	key := []byte(apiV3Key)
	block, err := aes.NewCipher(key)
	if err != nil {
		return "", fmt.Errorf("failed to create AES cipher: %w", err)
	}

	aesgcm, err := cipher.NewGCM(block)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	decoded, err := base64.StdEncoding.DecodeString(ciphertext)
	if err != nil {
		return "", fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	ad := []byte(associatedData)
	if associatedData == "" {
		ad = nil
	}

	plaintext, err := aesgcm.Open(nil, []byte(nonce), decoded, ad)
	if err != nil {
		return "", fmt.Errorf("failed to decrypt: %w", err)
	}

	return string(plaintext), nil
}

// loadWeChatPayPlatformCert loads the WeChat Pay platform certificate.
// It tries, in order:
//  1. wechatpay_{serial}.pem — WeChat Pay's standard naming (serial from callback header)
//  2. wechatpay_cert.pem  — legacy / simple deployment name
func loadWeChatPayPlatformCert(keyPath string, serial string) (*x509.Certificate, error) {
	// Candidate filenames, first match wins.
	candidates := []string{}
	if serial != "" {
		candidates = append(candidates, fmt.Sprintf("wechatpay_%s.pem", serial))
	}
	candidates = append(candidates, "wechatpay_cert.pem")

	var lastErr error
	for _, name := range candidates {
		certFile := filepath.Join(keyPath, name)
		certData, err := os.ReadFile(certFile)
		if err != nil {
			lastErr = err
			continue
		}
		block, _ := pem.Decode(certData)
		if block == nil {
			lastErr = fmt.Errorf("failed to decode PEM from %s", name)
			continue
		}
		cert, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			lastErr = fmt.Errorf("failed to parse certificate from %s: %w", name, err)
			continue
		}
		return cert, nil
	}
	return nil, fmt.Errorf("failed to load platform certificate from %s: %w", keyPath, lastErr)
}

// wechatPayVerifyCallbackSignature verifies the WeChat Pay callback signature.
func wechatPayVerifyCallbackSignature(c *gin.Context) error {
	timestamp := c.GetHeader("Wechatpay-Timestamp")
	nonce := c.GetHeader("Wechatpay-Nonce")
	signature := c.GetHeader("Wechatpay-Signature")
	serial := c.GetHeader("Wechatpay-Serial")

	if timestamp == "" || nonce == "" || signature == "" {
		return fmt.Errorf("missing required WeChat Pay headers")
	}

	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		return fmt.Errorf("failed to read body: %w", err)
	}

	verificationMessage := fmt.Sprintf("%s\n%s\n%s\n", timestamp, nonce, string(bodyBytes))

	keyPath := common.WeChatPayKeyPath
	if keyPath == "" {
		keyPath = "/root/.certs/wechat"
	}

	cert, err := loadWeChatPayPlatformCert(keyPath, serial)
	if err != nil {
		return fmt.Errorf("failed to load platform certificate: %w", err)
	}

	pubKey, ok := cert.PublicKey.(*rsa.PublicKey)
	if !ok {
		return fmt.Errorf("platform certificate public key is not RSA")
	}

	sigBytes, err := base64.StdEncoding.DecodeString(signature)
	if err != nil {
		return fmt.Errorf("failed to decode signature: %w", err)
	}

	hashed := sha256.Sum256([]byte(verificationMessage))
	err = rsa.VerifyPKCS1v15(pubKey, crypto.SHA256, hashed[:], sigBytes)
	if err != nil {
		return fmt.Errorf("signature verification failed: %w", err)
	}

	// Reconstruct body for handlers
	c.Request.Body = io.NopCloser(strings.NewReader(string(bodyBytes)))

	return nil
}

// ============================================================================
// Wallet Info Extension — add WeChat Pay methods
// ============================================================================

func isWeChatPayTopUpEnabled() bool {
	if !isPaymentComplianceConfirmed() {
		common.SysLog("[WeChat Pay] disabled: payment compliance not confirmed")
		return false
	}
	if !common.WeChatPayNativeEnabled {
		common.SysLog("[WeChat Pay] disabled: WECHAT_PAY_NATIVE_ENABLED=false")
		return false
	}
	if strings.TrimSpace(common.WeChatPayNativeAppId) == "" {
		common.SysLog("[WeChat Pay] disabled: WECHAT_PAY_NATIVE_APPID is empty")
		return false
	}
	if strings.TrimSpace(common.WeChatPayMachId) == "" {
		common.SysLog("[WeChat Pay] disabled: WECHAT_PAY_MACHID is empty")
		return false
	}
	if strings.TrimSpace(common.WeChatPayApiV3Key) == "" {
		common.SysLog("[WeChat Pay] disabled: WECHAT_PAY_APIV3_KEY is empty")
		return false
	}
	if strings.TrimSpace(common.WeChatPaySerial) == "" {
		common.SysLog("[WeChat Pay] disabled: WECHAT_PAY_SERIAL is empty — must match the certificate serial number uploaded to WeChat Pay merchant platform")
		return false
	}
	if strings.TrimSpace(common.WeChatPayKeyPath) == "" {
		common.SysLog("[WeChat Pay] disabled: WECHAT_PAY_KEY_PATH is empty — must point to directory containing apiclient_key.pem")
		return false
	}
	return true
}

// ============================================================================
// WeChat Pay Request DTOs
// ============================================================================

type wechatPayTopUpRequest struct {
	Amount int64 `json:"amount"`
}

// ============================================================================
// RequestWeChatPay — create a WeChat Pay Native order
// ============================================================================

func RequestWeChatPay(c *gin.Context) {
	if !isWeChatPayTopUpEnabled() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "微信支付未启用"})
		return
	}

	var req wechatPayTopUpRequest
	err := c.ShouldBindJSON(&req)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "参数错误"})
		return
	}

	if req.Amount < getMinTopup() {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("充值数量不能小于 %d", getMinTopup())})
		return
	}

	id := c.GetInt("id")
	group, err := model.GetUserGroup(id, true)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取用户分组失败"})
		return
	}

	payMoney := getPayMoney(req.Amount, group)
	if payMoney < 0.01 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "充值金额过低"})
		return
	}

	// Convert yuan to fen (cents)
	amountInFen := int(payMoney * 100)
	if amountInFen < 1 {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付金额过低"})
		return
	}

	// Generate trade number
	tradeNo := fmt.Sprintf("WP%s%d", common.GetRandomString(6), time.Now().Unix())
	tradeNo = fmt.Sprintf("USR%dNO%s", id, tradeNo)

	// Get callback URL — prefer WECHAT_PAY_NATIVE_CALLBACK_URL env var,
	// fall back to GetCallbackAddress() which reads admin UI settings.
	callBackAddress := common.WeChatPayNativeCallbackURL
	if callBackAddress == "" {
		callBackAddress = service.GetCallbackAddress()
	}
	notifyURL, err := url.JoinPath(callBackAddress, "/api/wechat-pay/notify")
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 callback URL 构建失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "回调地址配置错误"})
		return
	}

	// Calculate expiry time
	closeGap := common.WeChatPayNativeCloseOrderGap
	if closeGap <= 0 {
		closeGap = 30
	}
	expireTime := time.Now().Add(time.Duration(closeGap) * time.Minute)
	timeExpire := expireTime.Format(time.RFC3339)

	// Build WeChat Pay request
	payReq := wechatPayNativeRequest{
		Appid:       common.WeChatPayNativeAppId,
		Mchid:       common.WeChatPayMachId,
		Description: fmt.Sprintf("API额度充值 - %d", req.Amount),
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
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 请求序列化失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	// Call WeChat Pay API
	urlPath := "/v3/pay/transactions/native"
	authHeader, err := wechatPayBuildAuthHeader("POST", urlPath, bodyBytes)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 签名失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}

	httpReq, err := http.NewRequest("POST", getWeChatPayBaseURL()+urlPath, strings.NewReader(string(bodyBytes)))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 请求创建失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}
	httpReq.Header.Set("Authorization", authHeader)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 20 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 API 调用失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付接口调用失败"})
		return
	}
	defer httpResp.Body.Close()

	respBody, err := io.ReadAll(httpResp.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 读取响应失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付接口响应异常"})
		return
	}

	if httpResp.StatusCode != 200 {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 API 返回错误: status=%d body=%s", httpResp.StatusCode, string(respBody)))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": fmt.Sprintf("微信支付接口返回错误(HTTP %d)，请检查服务器日志获取详细信息", httpResp.StatusCode)})
		return
	}

	var payResp wechatPayNativeResponse
	if err := common.Unmarshal(respBody, &payResp); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 响应解析失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付接口响应解析失败"})
		return
	}

	if payResp.CodeUrl == "" {
		logger.LogError(c.Request.Context(), "微信支付 code_url 为空")
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "获取支付二维码失败"})
		return
	}

	// Create topup record
	topUp := &model.TopUp{
		UserId:          id,
		Amount:          req.Amount,
		Money:           payMoney,
		TradeNo:         tradeNo,
		PaymentMethod:   model.PaymentMethodWeChatPay,
		PaymentProvider: model.PaymentProviderWeChatPay,
		CreateTime:      time.Now().Unix(),
		Status:          common.TopUpStatusPending,
	}
	err = topUp.Insert()
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 创建充值订单失败 user_id=%d trade_no=%s amount=%d error=%q", id, tradeNo, req.Amount, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "创建订单失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 充值订单创建成功 user_id=%d trade_no=%s amount=%d money=%.2f code_url=%s", id, tradeNo, req.Amount, payMoney, payResp.CodeUrl))

	c.JSON(http.StatusOK, gin.H{
		"message": "success",
		"data": gin.H{
			"code_url": payResp.CodeUrl,
			"trade_no": tradeNo,
		},
	})
}

// ============================================================================
// WeChatPayNotify — handle WeChat Pay callback
// ============================================================================

func WeChatPayNotify(c *gin.Context) {
	// Verify the callback signature
	if err := wechatPayVerifyCallbackSignature(c); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 回调签名验证失败: %s", err.Error()))
		c.JSON(http.StatusForbidden, gin.H{"code": "FAIL", "message": "签名验证失败"})
		return
	}

	// Parse the callback body
	bodyBytes, err := io.ReadAll(c.Request.Body)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 回调读取body失败: %s", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "读取请求失败"})
		return
	}

	var notify wechatPayNotifyDecrypted
	if err := common.Unmarshal(bodyBytes, &notify); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 回调解析失败: %s", err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "解析请求失败"})
		return
	}

	// Only process successful transactions
	if notify.EventType != "TRANSACTION.SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 回调事件类型 %s 不需要处理", notify.EventType))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": ""})
		return
	}

	// Decrypt the resource
	plaintext, err := wechatPayDecryptNotify(notify.Resource.Ciphertext, notify.Resource.AssociatedData, notify.Resource.Nonce)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 解密回调资源失败: %s", err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": "解密失败"})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 回调解密成功: %s", plaintext))

	var transaction wechatPayTransaction
	if err := common.Unmarshal([]byte(plaintext), &transaction); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 解析交易数据失败: %s", err.Error()))
		c.JSON(http.StatusBadRequest, gin.H{"code": "FAIL", "message": "解析交易数据失败"})
		return
	}

	// Only process SUCCESS state
	if transaction.TradeState != "SUCCESS" {
		logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 交易状态为 %s，跳过处理", transaction.TradeState))
		c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": ""})
		return
	}

	// Complete the recharge
	if err := model.RechargeWeChatPay(transaction.OutTradeNo, transaction.TransactionID, c.ClientIP()); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 充值失败 trade_no=%s transaction_id=%s error=%q", transaction.OutTradeNo, transaction.TransactionID, err.Error()))
		c.JSON(http.StatusInternalServerError, gin.H{"code": "FAIL", "message": err.Error()})
		return
	}

	logger.LogInfo(c.Request.Context(), fmt.Sprintf("微信支付 充值成功 trade_no=%s transaction_id=%s amount=%d", transaction.OutTradeNo, transaction.TransactionID, transaction.Amount.Total))

	c.JSON(http.StatusOK, gin.H{"code": "SUCCESS", "message": ""})
}

// ============================================================================
// QueryWeChatPayOrder — query a WeChat Pay order status
// ============================================================================

func QueryWeChatPayOrder(c *gin.Context) {
	tradeNo := c.Param("trade_no")
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "缺少订单号"})
		return
	}

	// Query the order from WeChat Pay API
	mchid := common.WeChatPayMachId
	urlPath := fmt.Sprintf("/v3/pay/transactions/out-trade-no/%s?mchid=%s", url.QueryEscape(tradeNo), mchid)

	authHeader, err := wechatPayBuildAuthHeader("GET", urlPath, nil)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 查询签名失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}

	httpReq, err := http.NewRequest("GET", getWeChatPayBaseURL()+urlPath, nil)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 查询请求创建失败 trade_no=%s error=%q", tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "查询失败"})
		return
	}
	httpReq.Header.Set("Authorization", authHeader)
	httpReq.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 10 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 查询API调用失败 trade_no=%s error=%q", tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "查询接口调用失败"})
		return
	}
	defer httpResp.Body.Close()

	respBody, _ := io.ReadAll(httpResp.Body)

	if httpResp.StatusCode != 200 {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 查询返回非200 trade_no=%s status=%d body=%s", tradeNo, httpResp.StatusCode, string(respBody)))
		// Check local database for completed order
		topUp := model.GetTopUpByTradeNo(tradeNo)
		if topUp != nil && topUp.Status == common.TopUpStatusSuccess {
			c.JSON(http.StatusOK, gin.H{"message": "success", "data": "paid"})
			return
		}
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "查询失败"})
		return
	}

	var transaction wechatPayTransaction
	if err := common.Unmarshal(respBody, &transaction); err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 查询响应解析失败 trade_no=%s error=%q body=%s", tradeNo, err.Error(), string(respBody)))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "解析失败"})
		return
	}

	if transaction.TradeState == "SUCCESS" {
		// Complete the order locally if it's still pending
		_ = model.RechargeWeChatPay(transaction.OutTradeNo, transaction.TransactionID, c.ClientIP())
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": "paid"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "success", "data": transaction.TradeState})
}

// ============================================================================
// CloseWeChatPayOrder — close a pending WeChat Pay order
// ============================================================================

func CloseWeChatPayOrder(c *gin.Context) {
	tradeNo := c.Param("trade_no")
	if tradeNo == "" {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "缺少订单号"})
		return
	}

	mchid := common.WeChatPayMachId
	urlPath := fmt.Sprintf("/v3/pay/transactions/out-trade-no/%s/close", url.QueryEscape(tradeNo))

	closeBody, err := common.Marshal(map[string]string{"mchid": mchid})
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "序列化失败"})
		return
	}

	authHeader, err := wechatPayBuildAuthHeader("POST", urlPath, closeBody)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 关闭签名失败: %s", err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "支付配置错误"})
		return
	}

	httpReq, err := http.NewRequest("POST", getWeChatPayBaseURL()+urlPath, strings.NewReader(string(closeBody)))
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 关闭请求创建失败 trade_no=%s error=%q", tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "关闭失败"})
		return
	}
	httpReq.Header.Set("Authorization", authHeader)
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json")

	client := http.Client{Timeout: 10 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 关闭API调用失败 trade_no=%s error=%q", tradeNo, err.Error()))
		c.JSON(http.StatusOK, gin.H{"message": "error", "data": "关闭订单API调用失败"})
		return
	}
	defer httpResp.Body.Close()

	if httpResp.StatusCode == 204 || httpResp.StatusCode == 200 {
		// Mark the order as expired locally
		_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderWeChatPay, common.TopUpStatusExpired)
		c.JSON(http.StatusOK, gin.H{"message": "success", "data": "订单已关闭"})
		return
	}

	// If the order doesn't exist at WeChat, mark it expired locally
	respBody, _ := io.ReadAll(httpResp.Body)
	logger.LogError(c.Request.Context(), fmt.Sprintf("微信支付 关闭订单失败 trade_no=%s status=%d body=%s", tradeNo, httpResp.StatusCode, string(respBody)))
	_ = model.UpdatePendingTopUpStatus(tradeNo, model.PaymentProviderWeChatPay, common.TopUpStatusExpired)
	c.JSON(http.StatusOK, gin.H{"message": "success", "data": "订单已标记为过期"})
}
