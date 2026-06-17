package ocrali

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"math/rand"
	"sort"
	"strings"
	"time"
)

// signOCRApi signs an Alibaba Cloud OpenAPI request using the V1 signature scheme (HMAC-SHA1).
// Documentation: https://help.aliyun.com/document_detail/25490.html
//
// It takes the HTTP method, query parameters (which must include Action, Version, Format, etc.),
// and the AccessKeyId + AccessKeySecret. It adds the Signature parameter to the query params
// and returns the full signed URL (scheme + host + path + query).
func signOCRApi(method string, params map[string]string, accessKeyId, accessKeySecret string) {
	// Add common system parameters
	params["Format"] = "JSON"
	params["SignatureMethod"] = "HMAC-SHA1"
	params["SignatureVersion"] = "1.0"
	params["AccessKeyId"] = accessKeyId
	params["SignatureNonce"] = generateNonce()
	params["Timestamp"] = time.Now().UTC().Format("2006-01-02T15:04:05Z")

	// Sort parameter keys alphabetically
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	// Build the canonical query string:
	// percentEncode(key)=percentEncode(value) joined by &
	var canonicalParts []string
	for _, k := range keys {
		canonicalParts = append(canonicalParts,
			percentEncode(k)+"="+percentEncode(params[k]))
	}
	canonicalQueryString := strings.Join(canonicalParts, "&")

	// Build the string-to-sign:
	// HTTPMethod + "&" + percentEncode("/") + "&" + percentEncode(canonicalQueryString)
	stringToSign := method + "&" +
		percentEncode("/") + "&" +
		percentEncode(canonicalQueryString)

	// Compute HMAC-SHA1 signature
	// The key is AccessKeySecret + "&"
	mac := hmac.New(sha1.New, []byte(accessKeySecret+"&"))
	mac.Write([]byte(stringToSign))
	signature := base64.StdEncoding.EncodeToString(mac.Sum(nil))

	// Add the signature to the params
	params["Signature"] = signature
}

// buildSignedURL constructs the full signed URL for an Alibaba Cloud RPC API call.
// It returns the URL with all parameters as query string.
func buildSignedURL(host string, method string, params map[string]string, accessKeyId, accessKeySecret string) string {
	signOCRApi(method, params, accessKeyId, accessKeySecret)

	// Build the query string (sorted)
	keys := make([]string, 0, len(params))
	for k := range params {
		keys = append(keys, k)
	}
	sort.Strings(keys)

	var queryParts []string
	for _, k := range keys {
		queryParts = append(queryParts,
			fmt.Sprintf("%s=%s", percentEncode(k), percentEncode(params[k])))
	}

	return fmt.Sprintf("https://%s/?%s", host, strings.Join(queryParts, "&"))
}

// percentEncode performs the Alibaba Cloud specific URL encoding.
// Characters are encoded as %XY where XY is the uppercase hex of the byte.
// Special rule: space encodes to %20, NOT +.
// Characters A-Z, a-z, 0-9, hyphen (-), underscore (_), period (.), and tilde (~) are NOT encoded.
func percentEncode(s string) string {
	var result strings.Builder
	for _, b := range []byte(s) {
		if (b >= 'A' && b <= 'Z') ||
			(b >= 'a' && b <= 'z') ||
			(b >= '0' && b <= '9') ||
			b == '-' || b == '_' || b == '.' || b == '~' {
			result.WriteByte(b)
		} else {
			result.WriteString(fmt.Sprintf("%%%02X", b))
		}
	}
	return result.String()
}

// generateNonce creates a random nonce string for the signature.
func generateNonce() string {
	const charset = "abcdefghijklmnopqrstuvwxyz0123456789"
	b := make([]byte, 16)
	for i := range b {
		b[i] = charset[rand.Intn(len(charset))]
	}
	return string(b) + fmt.Sprintf("%d", time.Now().UnixNano())
}

// extractAPIKey extracts the AccessKeyId and AccessKeySecret from the channel Key field.
// The expected format is "accessKeyId|accessKeySecret".
func extractAPIKey(key string) (accessKeyId, accessKeySecret string, err error) {
	parts := strings.Split(key, "|")
	if len(parts) != 2 {
		return "", "", fmt.Errorf("invalid OCR channel key format: expected 'accessKeyId|accessKeySecret', got %d parts", len(parts))
	}
	return strings.TrimSpace(parts[0]), strings.TrimSpace(parts[1]), nil
}

// buildOCRRequestBody constructs the JSON request body for the OCR API.
// It takes the OCR request struct and serializes it.
func buildOCRRequestBody(ocrReq *OCRRequest) ([]byte, error) {
	body, err := json.Marshal(ocrReq)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal OCR request: %w", err)
	}
	return body, nil
}
