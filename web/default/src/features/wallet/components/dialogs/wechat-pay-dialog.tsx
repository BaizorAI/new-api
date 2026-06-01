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
import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { queryWeChatPayOrder, closeWeChatPayOrder } from '../../api'

interface WeChatPayDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  codeUrl: string
  tradeNo: string
  amount: number
  onPaymentComplete: () => void
}

type PaymentState = 'pending' | 'paid' | 'expired' | 'error'

export function WeChatPayDialog({
  open,
  onOpenChange,
  codeUrl,
  tradeNo,
  amount,
  onPaymentComplete,
}: WeChatPayDialogProps) {
  const { t } = useTranslation()
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [paymentState, setPaymentState] = useState<PaymentState>('pending')
  const [errorMessage, setErrorMessage] = useState('')
  const [cancelling, setCancelling] = useState(false)

  useEffect(() => {
    if (!open || !tradeNo) return

    setPaymentState('pending')
    setErrorMessage('')

    // Poll order status every 3 seconds
    pollingRef.current = setInterval(async () => {
      try {
        const res = await queryWeChatPayOrder(tradeNo)
        if (res.message === 'success' && res.data === 'paid') {
          setPaymentState('paid')
          if (pollingRef.current) clearInterval(pollingRef.current)
          onPaymentComplete()
        }
        // Keep polling for other states
      } catch {
        // ignore polling errors
      }
    }, 3000)

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [open, tradeNo, onPaymentComplete])

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
      // Auto-close the order when closing the dialog
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
                : t('Scan the QR code with WeChat to pay')}
          </DialogDescription>
        </DialogHeader>

        {paymentState === 'pending' && codeUrl && (
          <div className='flex flex-col items-center gap-4'>
            <div className='rounded-lg border bg-white p-4'>
              <QRCodeSVG value={codeUrl} size={200} />
            </div>
            <p className='text-muted-foreground text-sm text-center'>
              {t('Scan with WeChat to pay')} {amount}
            </p>
            <p className='text-muted-foreground text-xs text-center flex items-center gap-1'>
              <Loader2 className='h-3 w-3 animate-spin' />
              {t('Waiting for payment...')}
            </p>
          </div>
        )}

        {paymentState === 'paid' && (
          <div className='flex flex-col items-center gap-4 py-4'>
            <div className='text-green-500 text-5xl'>✓</div>
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
            <p className='text-red-500 text-sm'>{errorMessage}</p>
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
