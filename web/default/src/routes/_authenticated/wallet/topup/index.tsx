/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useState, useEffect, useCallback, useMemo } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { useStatus } from '@/hooks/use-status'
import { useSystemConfig } from '@/hooks/use-system-config'
import { requestWeChatPay, requestWeChatJSAPIPay } from '@/features/wallet/api'
import { BillingHistoryDialog } from '@/features/wallet/components/dialogs/billing-history-dialog'
import { CreemConfirmDialog } from '@/features/wallet/components/dialogs/creem-confirm-dialog'
import { PaymentConfirmDialog } from '@/features/wallet/components/dialogs/payment-confirm-dialog'
import { WeChatPayDialog } from '@/features/wallet/components/dialogs/wechat-pay-dialog'
import { RechargeFormCard } from '@/features/wallet/components/recharge-form-card'
import { DEFAULT_DISCOUNT_RATE } from '@/features/wallet/constants'
import {
  useTopupInfo,
  usePayment,
  useCreemPayment,
  useWaffoPayment,
  useWaffoPancakePayment,
} from '@/features/wallet/hooks'
import {
  getDefaultPaymentType,
  getMinTopupAmount,
  isWaffoPancakePayment,
} from '@/features/wallet/lib'
import type {
  PaymentMethod,
  PresetAmount,
  CreemProduct,
  WeChatPayJSAPIParams,
} from '@/features/wallet/types'

export const Route = createFileRoute('/_authenticated/wallet/topup/')({
  component: WalletTopupPage,
})

function isWeChatBrowser(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    /MicroMessenger/i.test(navigator.userAgent)
  )
}

function WalletTopupPage() {
  const { t } = useTranslation()

  const [topupAmount, setTopupAmount] = useState(0)
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>()
  const [paymentLoading, setPaymentLoading] = useState<string | null>(null)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [billingDialogOpen, setBillingDialogOpen] = useState(false)
  const [creemDialogOpen, setCreemDialogOpen] = useState(false)
  const [selectedCreemProduct, setSelectedCreemProduct] =
    useState<CreemProduct | null>(null)

  const [wechatPayDialogOpen, setWeChatPayDialogOpen] = useState(false)
  const [wechatPayCodeUrl, setWeChatPayCodeUrl] = useState('')
  const [wechatPayTradeNo, setWeChatPayTradeNo] = useState('')
  const [wechatPayMode, setWeChatPayMode] = useState<'native' | 'jsapi'>(
    'native'
  )
  const [wechatPayJSAPIParams, setWeChatPayJSAPIParams] =
    useState<WeChatPayJSAPIParams | null>(null)

  const { status } = useStatus()
  const { currency } = useSystemConfig()
  const { topupInfo, presetAmounts, loading: topupLoading } = useTopupInfo()

  const effectiveUsdExchangeRate = useMemo(() => {
    return currency?.quotaDisplayType === 'USD'
      ? 1
      : currency?.usdExchangeRate || 1
  }, [currency?.quotaDisplayType, currency?.usdExchangeRate])

  const {
    amount: paymentAmount,
    calculating,
    processing,
    calculatePaymentAmount,
    processPayment,
  } = usePayment()
  const { processing: creemProcessing, processCreemPayment } = useCreemPayment()
  const { processWaffoPayment } = useWaffoPayment()
  const { processing: pancakeProcessing, processWaffoPancakePayment } =
    useWaffoPancakePayment()

  useEffect(() => {
    if (topupInfo && topupAmount === 0) {
      const minTopup = getMinTopupAmount(topupInfo)
      setTopupAmount(minTopup)
      calculatePaymentAmount(minTopup, getDefaultPaymentType(topupInfo))
    }
  }, [topupInfo, topupAmount, calculatePaymentAmount])

  const getCurrentPaymentType = useCallback(() => {
    return selectedPaymentMethod?.type || getDefaultPaymentType(topupInfo)
  }, [selectedPaymentMethod, topupInfo])

  const handleSelectPreset = (preset: PresetAmount) => {
    setTopupAmount(preset.value)
    setSelectedPreset(preset.value)
    calculatePaymentAmount(preset.value, getCurrentPaymentType())
  }

  const handleTopupAmountChange = (amount: number) => {
    setTopupAmount(amount)
    setSelectedPreset(null)
    calculatePaymentAmount(amount, getCurrentPaymentType())
  }

  const handlePaymentMethodSelect = async (method: PaymentMethod) => {
    setSelectedPaymentMethod(method)
    setPaymentLoading(method.type)
    try {
      const minTopup = getMinTopupAmount(topupInfo)
      if (topupAmount < minTopup) return
      await calculatePaymentAmount(topupAmount, method.type)
      setConfirmDialogOpen(true)
    } finally {
      setPaymentLoading(null)
    }
  }

  const handlePaymentConfirm = async () => {
    if (!selectedPaymentMethod) return
    const isPancake = isWaffoPancakePayment(selectedPaymentMethod.type)
    const success = isPancake
      ? await processWaffoPancakePayment(topupAmount)
      : await processPayment(topupAmount, selectedPaymentMethod.type)
    if (success) setConfirmDialogOpen(false)
  }

  const handleCreemProductSelect = (product: CreemProduct) => {
    setSelectedCreemProduct(product)
    setCreemDialogOpen(true)
  }

  const handleCreemConfirm = async () => {
    if (!selectedCreemProduct) return
    const success = await processCreemPayment(selectedCreemProduct.productId)
    if (success) {
      setCreemDialogOpen(false)
      setSelectedCreemProduct(null)
    }
  }

  const handleWaffoMethodSelect = async (_method: unknown, index: number) => {
    const loadingKey = `waffo-${index}`
    setPaymentLoading(loadingKey)
    try {
      await processWaffoPayment(topupAmount, index)
    } finally {
      setPaymentLoading(null)
    }
  }

  const handleWeChatPaySelect = async () => {
    setPaymentLoading('wechat_pay')
    try {
      if (isWeChatBrowser()) {
        const res = await requestWeChatJSAPIPay({
          amount: topupAmount,
          payment_method: 'wechat_pay',
        })
        if (res.message === 'success' && res.data) {
          setWeChatPayJSAPIParams(res.data)
          setWeChatPayTradeNo(res.data.trade_no)
          setWeChatPayMode('jsapi')
          setWeChatPayCodeUrl('')
          setWeChatPayDialogOpen(true)
        }
      } else {
        const res = await requestWeChatPay({
          amount: topupAmount,
          payment_method: 'wechat_pay',
        })
        if (res.message === 'success' && res.data?.code_url) {
          setWeChatPayCodeUrl(res.data.code_url)
          setWeChatPayTradeNo(res.data.trade_no)
          setWeChatPayMode('native')
          setWeChatPayJSAPIParams(null)
          setWeChatPayDialogOpen(true)
        }
      }
    } finally {
      setPaymentLoading(null)
    }
  }

  const getDiscountRate = useCallback(() => {
    return topupInfo?.discount?.[topupAmount] || DEFAULT_DISCOUNT_RATE
  }, [topupInfo, topupAmount])

  return (
    <>
      <SectionPageLayout>
        <SectionPageLayout.Title>{t('Add Funds')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <div className='mx-auto w-full max-w-2xl'>
            <RechargeFormCard
              topupInfo={topupInfo}
              presetAmounts={presetAmounts}
              selectedPreset={selectedPreset}
              onSelectPreset={handleSelectPreset}
              topupAmount={topupAmount}
              onTopupAmountChange={handleTopupAmountChange}
              paymentAmount={paymentAmount}
              calculating={calculating}
              onPaymentMethodSelect={handlePaymentMethodSelect}
              paymentLoading={paymentLoading}
              topupLink={topupInfo?.topup_link}
              loading={topupLoading}
              priceRatio={(status?.price as number) || 1}
              usdExchangeRate={effectiveUsdExchangeRate}
              onOpenBilling={() => setBillingDialogOpen(true)}
              creemProducts={topupInfo?.creem_products}
              enableCreemTopup={topupInfo?.enable_creem_topup}
              onCreemProductSelect={handleCreemProductSelect}
              enableWaffoTopup={topupInfo?.enable_waffo_topup}
              waffoPayMethods={topupInfo?.waffo_pay_methods}
              waffoMinTopup={topupInfo?.waffo_min_topup}
              onWaffoMethodSelect={handleWaffoMethodSelect}
              enableWaffoPancakeTopup={topupInfo?.enable_waffo_pancake_topup}
              enableWeChatPayTopup={topupInfo?.enable_wechat_pay_topup}
              onWeChatPaySelect={handleWeChatPaySelect}
            />
          </div>
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <PaymentConfirmDialog
        open={confirmDialogOpen}
        onOpenChange={setConfirmDialogOpen}
        onConfirm={handlePaymentConfirm}
        topupAmount={topupAmount}
        paymentAmount={paymentAmount}
        paymentMethod={selectedPaymentMethod}
        calculating={calculating}
        processing={processing || pancakeProcessing}
        discountRate={getDiscountRate()}
        usdExchangeRate={effectiveUsdExchangeRate}
      />

      <BillingHistoryDialog
        open={billingDialogOpen}
        onOpenChange={setBillingDialogOpen}
      />

      <CreemConfirmDialog
        open={creemDialogOpen}
        onOpenChange={setCreemDialogOpen}
        onConfirm={handleCreemConfirm}
        product={selectedCreemProduct}
        processing={creemProcessing}
      />

      <WeChatPayDialog
        open={wechatPayDialogOpen}
        onOpenChange={setWeChatPayDialogOpen}
        codeUrl={wechatPayCodeUrl}
        tradeNo={wechatPayTradeNo}
        amount={topupAmount}
        onPaymentComplete={() => {}}
        mode={wechatPayMode}
        jsapiParams={wechatPayJSAPIParams}
      />
    </>
  )
}
