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
import { Loader2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { queryWeChatPayOrder, closeWeChatPayOrder } from '../../api'
import type { WeChatPayJSAPIParams } from '../../types'

interface WeChatPayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  codeUrl: string
  tradeNo: string
  amount: number
  onPaymentComplete: () => void
  /** Payment mode: native = QR code, jsapi = in-app WeixinJSBridge */
  mode?: 'native' | 'jsapi'
  /** JSAPI prepay parameters (required when mode='jsapi') */
  jsapiParams?: WeChatPayJSAPIParams | null
}

type PaymentState = 'pending' | 'paid' | 'expired' | 'error'

declare global {
  interface Window {
    WeixinJSBridge?: {
      invoke: (
        method: string,
        params: Record<string, unknown>,
        callback: (res: { err_msg: string }) => void
      ) => void
    }
  }
}

export function WeChatPayDialog({
  open,
  onOpenChange,
  codeUrl,
  tradeNo,
  amount,
  onPaymentComplete,
  mode = 'native',
  jsapiParams,
}: WeChatPayDialogProps) {
  const { t } = useTranslation()
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [paymentState, setPaymentState] = useState<PaymentState>('pending')
  const [errorMessage, setErrorMessage] = useState('')
  const [cancelling, setCancelling] = useState(false)
  const onCompleteRef = useRef(onPaymentComplete)
  onCompleteRef.current = onPaymentComplete
  const jsapiInvokedRef = useRef(false)

  // JSAPI mode: invoke WeixinJSBridge
  useEffect(() => {
    if (mode !== 'jsapi' || !open || !jsapiParams || jsapiInvokedRef.current)
      return
    jsapiInvokedRef.current = true

    const invokePay = () => {
      if (typeof window.WeixinJSBridge === 'undefined') {
        setPaymentState('error')
        setErrorMessage(t('WeChat JSAPI not available'))
        return
      }

      window.WeixinJSBridge.invoke(
        'getBrandWCPayRequest',
        {
          appId: jsapiParams.appId,
          timeStamp: jsapiParams.timeStamp,
          nonceStr: jsapiParams.nonceStr,
          package: jsapiParams.package,
          signType: jsapiParams.signType,
          paySign: jsapiParams.paySign,
        },
        (res) => {
          if (res.err_msg === 'get_brand_wcpay_request:ok') {
            setPaymentState('paid')
            onCompleteRef.current()
          } else if (res.err_msg === 'get_brand_wcpay_request:cancel') {
            setPaymentState('expired')
          } else {
            setPaymentState('error')
            setErrorMessage(res.err_msg || t('Payment failed'))
          }
        }
      )
    }

    // WeixinJSBridge may not be ready immediately; retry if needed
    if (typeof window.WeixinJSBridge !== 'undefined') {
      invokePay()
    } else {
      // Wait for WeixinJSBridge to be ready
      const handleReady = () => {
        invokePay()
      }
      document.addEventListener('WeixinJSBridgeReady', handleReady, false)
      // Timeout fallback
      const timer = setTimeout(() => {
        document.removeEventListener('WeixinJSBridgeReady', handleReady)
        if (!jsapiInvokedRef.current) {
          setPaymentState('error')
          setErrorMessage(t('WeChat JSAPI timeout'))
        }
      }, 10000)
      return () => {
        clearTimeout(timer)
        document.removeEventListener('WeixinJSBridgeReady', handleReady)
      }
    }
  }, [mode, open, jsapiParams, t])

  // Native mode: poll for payment status
  useEffect(() => {
    if (mode !== 'native' || !open || !tradeNo) return

    setPaymentState('pending')
    setErrorMessage('')

    const poll = async () => {
      try {
        const res = await queryWeChatPayOrder(tradeNo)
        if (res.message === 'success' && res.data === 'paid') {
          setPaymentState('paid')
          if (pollingRef.current) {
            clearInterval(pollingRef.current)
            pollingRef.current = null
          }
          onCompleteRef.current()
        }
      } catch {
        // ignore polling errors
      }
    }

    poll()
    pollingRef.current = setInterval(poll, 3000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [mode, open, tradeNo])

  const handleClose = async () => {
    setCancelling(true)
    try {
      await closeWeChatPayOrder(tradeNo)
      setPaymentState('expired')
    } catch {
      setErrorMessage(t('Failed to cancel the order'))
    } finally {
      setCancelling(false)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }

  const handleDialogChange = (open: boolean) => {
    if (!open && paymentState === 'pending') {
      handleClose()
    }
    onOpenChange(open)
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className='max-w-sm'>
        <DialogHeader className='text-left'>
          <DialogTitle>{t('WeChat Pay')}</DialogTitle>
          <DialogDescription>
            {paymentState === 'paid'
              ? t('Payment successful!')
              : paymentState === 'expired'
                ? t('Order has been cancelled')
                : mode === 'jsapi'
                  ? t('WeChat Pay popup should appear...')
                  : t('Scan the QR code with WeChat to pay')}
          </DialogDescription>
        </DialogHeader>

        {paymentState === 'pending' && mode === 'native' && codeUrl && (
          <div className='flex flex-col items-center gap-4'>
            <div className='rounded-lg border bg-white p-4'>
              <QRCodeSVG value={codeUrl} size={200} />
            </div>
            <p className='text-muted-foreground text-center text-sm'>
              {t('Scan with WeChat to pay')} {amount}
            </p>
            <p className='text-muted-foreground flex items-center gap-1 text-center text-xs'>
              <Loader2 className='h-3 w-3 animate-spin' />
              {t('Waiting for payment...')}
            </p>
          </div>
        )}

        {paymentState === 'pending' && mode === 'jsapi' && (
          <div className='flex flex-col items-center gap-4 py-4'>
            <Loader2 className='text-primary h-10 w-10 animate-spin' />
            <p className='text-muted-foreground text-center text-sm'>
              {t('Launching WeChat Pay...')}
            </p>
          </div>
        )}

        {paymentState === 'paid' && (
          <div className='flex flex-col items-center gap-4 py-4'>
            <div className='text-5xl text-green-500'>✓</div>
            <p className='text-lg font-semibold text-green-600'>
              {t('Payment Successful')}
            </p>
          </div>
        )}

        {paymentState === 'expired' && (
          <div className='flex flex-col items-center gap-4 py-4'>
            <p className='text-muted-foreground text-sm'>
              {t('The order has been cancelled.')}
            </p>
          </div>
        )}

        {paymentState === 'error' && errorMessage && (
          <div className='flex flex-col items-center gap-4 py-4'>
            <p className='text-sm text-red-500'>{errorMessage}</p>
          </div>
        )}

        {paymentState !== 'paid' && (
          <div className='flex justify-end gap-2'>
            <Button
              variant='outline'
              onClick={handleClose}
              disabled={cancelling || paymentState === 'expired'}
            >
              {cancelling ? (
                <Loader2 className='mr-2 h-4 w-4 animate-spin' />
              ) : null}
              {t('Cancel')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
