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
import { useEffect, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import {
  Link2OffIcon,
  MessageCircleIcon,
  QrCodeIcon,
  RefreshCwIcon,
  WrenchIcon,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { IconWeChat } from '@/assets/brand-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import {
  createHermesWeixinQR,
  disconnectHermesWeixin,
  getHermesWeixinQRStatus,
  getHermesWeixinStatus,
  type HermesWeixinStatus,
  type HermesWeixinStatusValue,
} from '../api'

interface HermesMessagePlatformsProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HermesMessagePlatforms(props: HermesMessagePlatformsProps) {
  const { t } = useTranslation()

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full gap-0 sm:max-w-xl' side='right'>
        <SheetHeader className='border-b pr-12'>
          <SheetTitle>{t('Message platforms')}</SheetTitle>
          <SheetDescription>
            {t('Manage message platform connections for Hermes.')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className='min-h-0 flex-1'>
          <div className='space-y-3 p-4'>
            <WeixinPlatformCard open={props.open} />
            <CompactEmpty
              description={t(
                'More message platforms will appear here after they are enabled.'
              )}
              title={t('No other message platforms')}
            />
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function WeixinPlatformCard(props: { open: boolean }) {
  const { t } = useTranslation()
  const [qrState, setQrState] = useState<HermesWeixinStatus | null>(null)

  const statusQuery = useQuery({
    queryKey: ['hermes-message-platforms', 'weixin', 'status'],
    queryFn: getHermesWeixinStatus,
    enabled: props.open,
  })

  const shouldPoll =
    props.open &&
    !!qrState?.requestId &&
    (qrState.status === 'qr_ready' || qrState.status === 'scanned')
  const qrStatusQuery = useQuery({
    queryKey: ['hermes-message-platforms', 'weixin', 'qr', qrState?.requestId],
    queryFn: () => getHermesWeixinQRStatus(qrState?.requestId ?? ''),
    enabled: shouldPoll,
    refetchInterval: shouldPoll ? 3000 : false,
  })

  const createQRMutation = useMutation({
    mutationFn: createHermesWeixinQR,
    onSuccess: (data) => {
      setQrState(data)
      void statusQuery.refetch()
      toast.success(t('WeChat QR code created'))
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error as Error, t('Failed to create WeChat QR code'))
      )
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: disconnectHermesWeixin,
    onSuccess: () => {
      setQrState(null)
      void statusQuery.refetch()
      toast.success(t('WeChat disconnected'))
    },
    onError: (error) => {
      toast.error(
        getErrorMessage(error as Error, t('Failed to disconnect WeChat'))
      )
    },
  })

  useEffect(() => {
    const data = qrStatusQuery.data
    if (!data) return
    setQrState(data)
    if (data.status === 'connected') {
      void statusQuery.refetch()
    }
  }, [qrStatusQuery.data, statusQuery])

  const current = qrState ?? statusQuery.data
  const qrValue = qrState?.qrcodeUrl || qrState?.qrcode || ''
  const isConnected = current?.status === 'connected'
  const isDisabled = current?.status === 'disabled' || current?.enabled === false
  const isBusy =
    createQRMutation.isPending ||
    disconnectMutation.isPending ||
    statusQuery.isLoading

  return (
    <section className='rounded-lg border p-4'>
      <div className='flex items-start justify-between gap-3'>
        <div className='flex min-w-0 items-start gap-3'>
          <div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded-md'>
            <IconWeChat className='size-5 text-[#07C160]' />
          </div>
          <div className='min-w-0 space-y-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h3 className='text-sm font-medium'>{t('WeChat')}</h3>
              <Badge variant={getWeixinBadgeVariant(current?.status)}>
                {getWeixinStatusLabel(current?.status, t)}
              </Badge>
            </div>
            <p className='text-muted-foreground text-xs'>
              {current?.message ||
                t(
                  'Scan the QR code with WeChat to connect this Hermes account.'
                )}
            </p>
            {current?.accountLabel && (
              <p className='text-muted-foreground text-xs'>
                {t('Connected account')}: {current.accountLabel}
              </p>
            )}
          </div>
        </div>
        <Button
          aria-label={t('Refresh WeChat status')}
          disabled={statusQuery.isFetching}
          onClick={() => void statusQuery.refetch()}
          size='icon-sm'
          type='button'
          variant='ghost'
        >
          <RefreshCwIcon className='size-4' />
        </Button>
      </div>

      <div className='mt-4 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]'>
        <div className='bg-muted/30 flex h-56 w-full items-center justify-center rounded-md border'>
          {qrValue ? (
            isImageDataUrl(qrValue) ? (
              <img
                alt={t('WeChat QR code')}
                className='size-48 rounded bg-white p-2'
                src={qrValue}
              />
            ) : (
              <QRCodeSVG
                className='rounded bg-white p-2'
                size={192}
                value={qrValue}
              />
            )
          ) : (
            <div className='text-muted-foreground flex flex-col items-center gap-2 text-xs'>
              <QrCodeIcon className='size-6' />
              <span>{t('WeChat QR code will be displayed here')}</span>
            </div>
          )}
        </div>

        <div className='flex min-h-56 flex-col justify-between gap-4'>
          <div className='space-y-2 text-sm'>
            <div className='flex items-center gap-2'>
              <MessageCircleIcon className='text-muted-foreground size-4' />
              <span>{getWeixinDetailText(current?.status, t)}</span>
            </div>
            {qrState?.expiresAt && (
              <p className='text-muted-foreground text-xs'>
                {t('Expires at')}: {formatUnixSeconds(qrState.expiresAt)}
              </p>
            )}
          </div>

          <div className='flex flex-wrap gap-2'>
            <Button
              disabled={isDisabled || isBusy}
              onClick={() => createQRMutation.mutate()}
              type='button'
            >
              <QrCodeIcon className='size-4' />
              {isConnected ? t('Reconnect WeChat') : t('Connect WeChat')}
            </Button>
            <Button
              disabled={isDisabled || isBusy || !qrState?.requestId}
              onClick={() => createQRMutation.mutate()}
              type='button'
              variant='outline'
            >
              <RefreshCwIcon className='size-4' />
              {t('Refresh QR code')}
            </Button>
            <Button
              disabled={isBusy || (!isConnected && !qrState)}
              onClick={() => disconnectMutation.mutate()}
              type='button'
              variant='outline'
            >
              <Link2OffIcon className='size-4' />
              {t('Disconnect')}
            </Button>
          </div>
        </div>
      </div>

      {statusQuery.error && (
        <CapabilityError
          message={getErrorMessage(
            statusQuery.error,
            t('Failed to load WeChat status')
          )}
        />
      )}
    </section>
  )
}

function CapabilityError(props: { message: string }) {
  return (
    <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm'>
      {props.message}
    </div>
  )
}

function CompactEmpty(props: { title: string; description: string }) {
  return (
    <Empty className='min-h-32 rounded-lg border p-4'>
      <EmptyMedia variant='icon'>
        <WrenchIcon className='size-4' />
      </EmptyMedia>
      <EmptyTitle>{props.title}</EmptyTitle>
      <EmptyDescription>{props.description}</EmptyDescription>
    </Empty>
  )
}

function getWeixinStatusLabel(
  status: HermesWeixinStatusValue | undefined,
  t: (key: string) => string
): string {
  switch (status) {
    case 'connected':
      return t('Connected')
    case 'qr_ready':
      return t('Waiting for scan')
    case 'scanned':
      return t('Scanned')
    case 'expired':
      return t('Expired')
    case 'failed':
      return t('Failed')
    case 'disabled':
      return t('Disabled')
    case 'disconnected':
    case 'not_connected':
      return t('Not connected')
    default:
      return t('Checking')
  }
}

function getWeixinDetailText(
  status: HermesWeixinStatusValue | undefined,
  t: (key: string) => string
): string {
  switch (status) {
    case 'connected':
      return t('Incoming WeChat messages can now be handled by Hermes.')
    case 'qr_ready':
      return t('Scan the QR code with WeChat, then confirm on your phone.')
    case 'scanned':
      return t('Confirm the connection in WeChat to finish setup.')
    case 'expired':
      return t('The QR code expired. Refresh it and scan again.')
    case 'failed':
      return t('The WeChat connection failed. Refresh the QR code and retry.')
    case 'disabled':
      return t('WeChat QR connection is disabled on this deployment.')
    case 'disconnected':
    case 'not_connected':
      return t('Create a QR code to connect WeChat.')
    default:
      return t('Checking WeChat connection status.')
  }
}

function getWeixinBadgeVariant(status: HermesWeixinStatusValue | undefined) {
  if (status === 'connected') return 'secondary'
  if (status === 'failed' || status === 'expired') return 'destructive'
  return 'outline'
}

function isImageDataUrl(value: string): boolean {
  return value.startsWith('data:image/')
}

function formatUnixSeconds(value: number): string {
  return new Date(value * 1000).toLocaleString()
}

function getErrorMessage(error: Error | null, fallback: string): string {
  if (!error) return fallback
  return error.message || fallback
}
