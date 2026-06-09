#!/bin/bash
#
# sendmail.sh — SMTP 测试邮件发送脚本
#
# 用法:
#   ./sendmail.sh <收件邮箱>
#
# 示例:
#   ./sendmail.sh lucky@lanhc.com
#
# 环境变量 (可选):
#   API_BASE_URL     — API 服务地址, 默认 http://localhost:3000
#   USERNAME         — 登录用户名, 默认 lucky
#   PASSWORD         — 登录密码 (必填, 无默认值)

set -euo pipefail

# ===== 自动加载同目录下的 .env 文件 =====
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ -f "$SCRIPT_DIR/.env" ]; then
    set -a
    source "$SCRIPT_DIR/.env"
    set +a
fi

# ===== 配置 (环境变量可覆盖 .env) =====
API_BASE_URL="${API_BASE_URL:-https://baizor.com}"
USERNAME="${USERNAME:-lucky}"
PASSWORD="${PASSWORD:-}"

# ===== 参数检查 =====
TO_EMAIL="${1:-}"
if [ -z "$TO_EMAIL" ]; then
    echo "用法: $0 <收件邮箱>"
    echo "示例: $0 lucky@lanhc.com"
    exit 1
fi

if [ -z "$PASSWORD" ]; then
    # 密码未通过环境变量设置, 交互式读取
    read -rsp "请输入用户 '$USERNAME' 的密码: " PASSWORD
    echo
    if [ -z "$PASSWORD" ]; then
        echo "错误: 密码不能为空"
        exit 1
    fi
fi

COOKIE_FILE=$(mktemp /tmp/sendmail_cookies.XXXXXX)
trap 'rm -f "$COOKIE_FILE"' EXIT

echo "========== 1. 登录 =========="
LOGIN_RESP=$(curl -s -w "\n%{http_code}" \
    -c "$COOKIE_FILE" \
    -X POST "$API_BASE_URL/api/user/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USERNAME\",\"password\":\"$PASSWORD\"}")

HTTP_CODE=$(echo "$LOGIN_RESP" | tail -1)
BODY=$(echo "$LOGIN_RESP" | sed '$d')

if [ "$HTTP_CODE" != "200" ]; then
    echo "登录失败 (HTTP $HTTP_CODE): $BODY"
    exit 1
fi

echo "登录响应: $BODY"

# 检查是否需要2FA
if echo "$BODY" | grep -q '"require_2fa":true'; then
    echo "错误: 该用户启用了2FA, 脚本不支持2FA登录。请使用 Web UI 或关闭2FA后重试。"
    exit 1
fi

# 检查登录是否成功
SUCCESS=$(echo "$BODY" | grep -o '"success":\s*\(true\|false\)' | grep -o 'true\|false')
if [ "$SUCCESS" != "true" ]; then
    echo "登录失败: $BODY"
    exit 1
fi

echo "========== 2. 获取 Access Token =========="
TOKEN_RESP=$(curl -s \
    -b "$COOKIE_FILE" \
    "$API_BASE_URL/api/user/self/token")

TOKEN=$(echo "$TOKEN_RESP" | grep -o '"data":"[^"]*"' | sed 's/"data":"//;s/"//')
if [ -z "$TOKEN" ]; then
    echo "获取 Token 失败: $TOKEN_RESP"
    exit 1
fi

echo "Token: ${TOKEN:0:8}... (已截断显示)"

echo "========== 3. 发送测试邮件到 $TO_EMAIL =========="
SMTP_RESP=$(curl -s \
    -H "Authorization: Bearer $TOKEN" \
    "$API_BASE_URL/api/smtp/test?email=$TO_EMAIL")

echo "响应: $SMTP_RESP"

SUCCESS=$(echo "$SMTP_RESP" | grep -o '"success":\s*\(true\|false\)' | grep -o 'true\|false')
if [ "$SUCCESS" = "true" ]; then
    echo
    echo "✓ 测试邮件发送成功！请检查收件箱 $TO_EMAIL"
else
    echo
    echo "✗ 测试邮件发送失败，请检查 SMTP 配置"
fi
