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
import {
  DownloadIcon,
  FileCheck2Icon,
  FileTextIcon,
  FolderOpenIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
  createPlaygroundStorageKeys,
  loadMessages,
} from '@/features/playground/lib'
import type { Message } from '@/features/playground/types'

import {
  formatSessionTime,
  sortSessions,
  type HermesConversation,
} from '../sessions'

interface HermesResultsProps {
  open: boolean
  sessions: HermesConversation[]
  activeSessionId: string
  title?: string
  description?: string
  emptyTitle?: string
  emptyDescription?: string
  onOpenChange: (open: boolean) => void
  onSelectSession: (sessionId: string) => void
}

interface HermesResultItem {
  session: HermesConversation
  messages: Message[]
  assistantMessages: number
  attachmentCount: number
}

export function HermesResults(props: HermesResultsProps) {
  const { t } = useTranslation()

  const results = useMemo<HermesResultItem[]>(() => {
    return sortSessions(props.sessions)
      .map((session) => {
        const messages =
          loadMessages(createPlaygroundStorageKeys(session.storageScope)) ?? []
        return {
          session,
          messages,
          assistantMessages: messages.filter(
            (message) => message.from === 'assistant'
          ).length,
          attachmentCount: messages.reduce(
            (count, message) => count + (message.attachments?.length ?? 0),
            0
          ),
        }
      })
      .filter((item) => item.messages.length > 0)
  }, [props.sessions])

  const exportResult = (item: HermesResultItem) => {
    downloadJson(
      {
        exportedAt: new Date().toISOString(),
        resultType: 'hermes-conversation',
        session: item.session,
        messages: item.messages,
      },
      `${item.session.title || item.session.id}.json`
    )
    toast.success(t('Exported'))
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full gap-0 sm:max-w-xl' side='right'>
        <SheetHeader className='border-b pr-12'>
          <SheetTitle>{props.title ?? t('Hermes results')}</SheetTitle>
          <SheetDescription>
            {props.description ??
              t('Review reusable outputs from Hermes conversations.')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className='min-h-0 flex-1'>
          <div className='space-y-4 p-4'>
            {results.length === 0 ? (
              <Empty className='min-h-40 rounded-lg border p-4'>
                <EmptyMedia variant='icon'>
                  <FileCheck2Icon />
                </EmptyMedia>
                <EmptyTitle>
                  {props.emptyTitle ?? t('No results yet')}
                </EmptyTitle>
                <EmptyDescription>
                  {props.emptyDescription ??
                    t(
                      'Ask Hermes to produce a report, file, skill or analysis result, then export it here.'
                    )}
                </EmptyDescription>
              </Empty>
            ) : (
              <section className='space-y-3'>
                <div className='text-muted-foreground text-xs font-medium'>
                  {t('Conversation results')}
                </div>
                {results.map((item) => (
                  <ResultCard
                    key={item.session.id}
                    active={item.session.id === props.activeSessionId}
                    item={item}
                    onExport={() => exportResult(item)}
                    onOpen={() => {
                      props.onSelectSession(item.session.id)
                      props.onOpenChange(false)
                    }}
                  />
                ))}
              </section>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function ResultCard(props: {
  item: HermesResultItem
  active: boolean
  onExport: () => void
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const { item } = props
  const title = item.session.title || t('New session')
  const timeLabel = formatSessionTime(item.session.updatedAt, t('Just now'))

  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-start gap-3'>
        <div className='bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md'>
          <FileTextIcon className='size-4' />
        </div>
        <div className='min-w-0 flex-1 space-y-2'>
          <div className='flex min-w-0 items-start justify-between gap-2'>
            <div className='min-w-0'>
              <div className='truncate text-sm font-medium'>{title}</div>
              <div className='text-muted-foreground text-xs'>
                {t('Updated {{time}}', { time: timeLabel })}
              </div>
            </div>
            {props.active ? (
              <Badge variant='secondary'>{t('Current')}</Badge>
            ) : null}
          </div>
          <div className='text-muted-foreground flex flex-wrap gap-2 text-xs'>
            <Badge variant='outline'>
              {t('Messages: {{count}}', { count: item.messages.length })}
            </Badge>
            <Badge variant='outline'>
              {t('Assistant replies: {{count}}', {
                count: item.assistantMessages,
              })}
            </Badge>
            {item.attachmentCount > 0 ? (
              <Badge variant='outline'>
                {t('Attachments: {{count}}', { count: item.attachmentCount })}
              </Badge>
            ) : null}
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              type='button'
              variant='outline'
              onClick={props.onOpen}
            >
              <FolderOpenIcon data-icon='inline-start' />
              {t('Open')}
            </Button>
            <Button
              size='sm'
              type='button'
              variant='outline'
              onClick={props.onExport}
            >
              <DownloadIcon data-icon='inline-start' />
              {t('Export')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeDownloadFilename(filename)
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

function sanitizeDownloadFilename(filename: string): string {
  const value = filename.trim().replaceAll(/[\\/:*?"<>|]/g, '_')
  return value || 'hermes-result.json'
}
