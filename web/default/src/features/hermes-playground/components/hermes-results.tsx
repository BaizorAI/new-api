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
import { useQuery } from '@tanstack/react-query'
import {
  ClockIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileArchiveIcon,
  FileCheck2Icon,
  FileTextIcon,
  FolderOpenIcon,
  PresentationIcon,
  SearchIcon,
  UserIcon,
  UsersIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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
import { Input } from '@/components/ui/input'
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
import {
  extractHermesFileArtifacts,
  renderHermesDataPathsAsLinks,
} from '@/features/playground/lib/hermes-file-links'
import { parseThinkTags } from '@/features/playground/lib/message-utils'
import type { FileAttachment, Message } from '@/features/playground/types'

import { listHermesResults, type HermesResultRecord } from '../api'
import {
  formatSessionTime,
  sortSessions,
  type HermesConversation,
} from '../sessions'

export type HermesResultScope = 'all' | 'mine' | 'team'
export type HermesResultType =
  | 'all'
  | 'ppt'
  | 'report'
  | 'document'
  | 'attachment'

interface HermesResultsProps {
  open: boolean
  sessions: HermesConversation[]
  activeSessionId: string
  title?: string
  description?: string
  emptyTitle?: string
  emptyDescription?: string
  initialScope?: HermesResultScope
  initialType?: HermesResultType
  selectedTeamId?: number
  selectedTeamName?: string
  workspaceMode?: 'personal' | 'team'
  onOpenChange: (open: boolean) => void
  onSelectSession: (session: HermesConversation) => void
}

type HermesResultFileSource = 'artifact' | 'attachment'

interface HermesResultFile {
  id: string
  filename: string
  href: string
  mediaType?: string
  size?: number
  source: HermesResultFileSource
  type: HermesResultType
}

interface HermesResultItem {
  session: HermesConversation
  messages: Message[]
  assistantMessages: number
  files: HermesResultFile[]
  generatedFileCount: number
  uploadedFileCount: number
  types: Set<HermesResultType>
  serverBacked?: boolean
  createdBy?: number
  updatedBy?: number
}

export function HermesResults(props: HermesResultsProps) {
  const { t } = useTranslation()

  const [activeScope, setActiveScope] = useState<HermesResultScope>(
    () => props.initialScope ?? getDefaultScope(props.workspaceMode)
  )
  const [activeType, setActiveType] = useState<HermesResultType>(
    () => props.initialType ?? 'all'
  )
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!props.open) return
    setActiveScope(props.initialScope ?? getDefaultScope(props.workspaceMode))
    setActiveType(props.initialType ?? 'all')
  }, [props.initialScope, props.initialType, props.open, props.workspaceMode])

  const serverResultsQuery = useQuery({
    queryKey: [
      'hermes-results',
      props.workspaceMode ?? 'personal',
      props.selectedTeamId ?? 0,
      activeType,
      query.trim(),
    ],
    queryFn: () =>
      listHermesResults({
        teamId:
          props.workspaceMode === 'team' ? props.selectedTeamId : undefined,
        type: activeType,
        query: query.trim() || undefined,
        limit: 100,
      }),
    enabled:
      props.open &&
      (props.workspaceMode !== 'team' || Boolean(props.selectedTeamId)),
  })

  const localResults = useMemo<HermesResultItem[]>(() => {
    return sortSessions(props.sessions)
      .map((session) => {
        const messages =
          loadMessages(createPlaygroundStorageKeys(session.storageScope)) ?? []
        const files = extractResultFiles(session, messages)
        const assistantMessages = messages.filter(
          (message) => message.from === 'assistant'
        ).length
        const types = new Set<HermesResultType>()
        if (assistantMessages > 0) types.add('document')
        for (const file of files) types.add(file.type)

        return {
          session,
          messages,
          assistantMessages,
          files,
          generatedFileCount: files.filter((file) => file.source === 'artifact')
            .length,
          uploadedFileCount: files.filter(
            (file) => file.source === 'attachment'
          ).length,
          types,
        }
      })
      .filter((item) => item.messages.length > 0)
  }, [props.sessions])

  const serverResults = useMemo(() => {
    return buildServerResultItems(serverResultsQuery.data ?? [], props.sessions)
  }, [props.sessions, serverResultsQuery.data])

  const allResults = useMemo(() => {
    return mergeServerAndLocalResults(serverResults, localResults)
  }, [localResults, serverResults])

  const results = useMemo(() => {
    return allResults.filter(
      (item) =>
        resultMatchesType(item, activeType) && resultMatchesQuery(item, query)
    )
  }, [activeType, allResults, query])

  const totalFiles = allResults.reduce(
    (count, item) => count + item.files.length,
    0
  )
  const generatedFiles = allResults.reduce(
    (count, item) => count + item.generatedFileCount,
    0
  )

  const exportResult = (item: HermesResultItem) => {
    downloadJson(
      {
        exportedAt: new Date().toISOString(),
        resultType: 'hermes-conversation',
        session: item.session,
        files: item.files,
        messages: item.messages,
      },
      `${item.session.title || item.session.id}.json`
    )
    toast.success(t('Exported'))
  }

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full gap-0 sm:max-w-2xl' side='right'>
        <SheetHeader className='border-b pr-12'>
          <SheetTitle>
            {props.title ?? getResultsTitle(activeType, t)}
          </SheetTitle>
          <SheetDescription>
            {props.description ??
              t('Review reusable outputs from Hermes conversations.')}
          </SheetDescription>
        </SheetHeader>

        <div className='space-y-3 border-b p-4'>
          <div className='grid gap-2 sm:grid-cols-3'>
            <ResultStat
              icon={FileCheck2Icon}
              label={t('Result sessions')}
              value={String(allResults.length)}
            />
            <ResultStat
              icon={FileCheck2Icon}
              label={t('Generated files')}
              value={String(generatedFiles)}
            />
            <ResultStat
              icon={FileArchiveIcon}
              label={t('All files')}
              value={String(totalFiles)}
            />
          </div>

          <div className='relative'>
            <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
            <Input
              className='pl-8'
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t('Search results')}
              value={query}
            />
          </div>

          <div className='flex flex-wrap gap-1.5'>
            {getResultTypeOptions(t).map((option) => (
              <Button
                aria-pressed={activeType === option.value}
                key={option.value}
                onClick={() => setActiveType(option.value)}
                size='xs'
                type='button'
                variant={activeType === option.value ? 'secondary' : 'outline'}
              >
                <option.icon className='size-3.5' />
                {option.label}
              </Button>
            ))}
          </div>

          <div className='flex flex-wrap gap-1.5'>
            {getResultScopeOptions(props.workspaceMode, t).map((option) => (
              <Button
                aria-pressed={activeScope === option.value}
                disabled={option.disabled}
                key={option.value}
                onClick={() => setActiveScope(option.value)}
                size='xs'
                type='button'
                variant={activeScope === option.value ? 'secondary' : 'outline'}
              >
                <option.icon className='size-3.5' />
                {option.label}
              </Button>
            ))}
            {props.selectedTeamName ? (
              <Badge variant='outline'>{props.selectedTeamName}</Badge>
            ) : null}
          </div>
        </div>

        <ScrollArea className='min-h-0 flex-1'>
          <div className='space-y-4 p-4'>
            {results.length === 0 ? (
              <Empty className='min-h-40 rounded-lg border p-4'>
                <EmptyMedia variant='icon'>
                  <FileCheck2Icon />
                </EmptyMedia>
                <EmptyTitle>
                  {props.emptyTitle ?? getEmptyTitle(activeType, t)}
                </EmptyTitle>
                <EmptyDescription>
                  {getEmptyDescription(props.emptyDescription, activeType, t)}
                </EmptyDescription>
              </Empty>
            ) : (
              <section className='space-y-3'>
                <div className='flex flex-wrap items-center justify-between gap-2'>
                  <div className='text-muted-foreground text-xs font-medium'>
                    {getResultsTitle(activeType, t)}
                  </div>
                  <div className='flex flex-wrap gap-1.5'>
                    <Badge variant='outline'>
                      {getResultScopeLabel(activeScope, t)}
                    </Badge>
                    <Badge variant='outline'>
                      {getResultTypeLabel(activeType, t)}
                    </Badge>
                    <Badge variant='secondary'>
                      {t('{{count}} results', { count: results.length })}
                    </Badge>
                  </div>
                </div>
                {results.map((item) => (
                  <ResultCard
                    key={item.session.id}
                    active={item.session.id === props.activeSessionId}
                    item={item}
                    onExport={() => exportResult(item)}
                    scopeLabel={getResultScopeLabel(activeScope, t)}
                    onOpen={() => {
                      props.onSelectSession(item.session)
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
  scopeLabel: string
  onExport: () => void
  onOpen: () => void
}) {
  const { t } = useTranslation()
  const { item } = props
  const title = item.session.title || t('New session')
  const timeLabel = formatSessionTime(item.session.updatedAt, t('Just now'))
  const primaryType = getPrimaryResultType(item)
  const showConversationResult = item.files.length === 0 && item.serverBacked

  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-start gap-3'>
        <div className='bg-muted text-muted-foreground mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-md'>
          <ResultTypeIcon type={primaryType} />
        </div>
        <div className='min-w-0 flex-1 space-y-3'>
          <div className='flex min-w-0 items-start justify-between gap-2'>
            <div className='min-w-0'>
              <div className='flex flex-wrap items-center gap-1.5'>
                <div className='truncate text-sm font-medium'>{title}</div>
                {props.active ? (
                  <Badge variant='secondary'>{t('Current')}</Badge>
                ) : null}
              </div>
              <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs'>
                <span className='inline-flex items-center gap-1'>
                  <ClockIcon className='size-3' />
                  {t('Updated {{time}}', { time: timeLabel })}
                </span>
                <span>{props.scopeLabel}</span>
              </div>
            </div>
          </div>

          <div className='text-muted-foreground flex flex-wrap gap-2 text-xs'>
            {item.messages.length > 0 ? (
              <Badge variant='outline'>
                {t('Messages: {{count}}', { count: item.messages.length })}
              </Badge>
            ) : null}
            <Badge variant='outline'>
              {t('Assistant replies: {{count}}', {
                count: item.assistantMessages,
              })}
            </Badge>
            {item.serverBacked ? (
              <Badge variant='outline'>{t('Saved')}</Badge>
            ) : null}
            {item.createdBy ? (
              <Badge variant='outline'>
                {t('Creator: {{id}}', { id: item.createdBy })}
              </Badge>
            ) : null}
            {item.generatedFileCount > 0 ? (
              <Badge variant='outline'>
                {t('Generated files: {{count}}', {
                  count: item.generatedFileCount,
                })}
              </Badge>
            ) : null}
            {item.uploadedFileCount > 0 ? (
              <Badge variant='outline'>
                {t('Attachments: {{count}}', { count: item.uploadedFileCount })}
              </Badge>
            ) : null}
          </div>

          {item.files.length > 0 ? <ResultFileList files={item.files} /> : null}
          {showConversationResult ? (
            <div className='bg-muted/20 text-muted-foreground rounded-md border p-2 text-xs'>
              {t('Conversation result')}
            </div>
          ) : null}

          <div className='flex flex-wrap gap-2'>
            <Button
              size='sm'
              type='button'
              variant='outline'
              onClick={props.onOpen}
            >
              <FolderOpenIcon data-icon='inline-start' />
              {t('Back to session')}
            </Button>
            <Button
              size='sm'
              type='button'
              variant='outline'
              onClick={props.onExport}
            >
              <DownloadIcon data-icon='inline-start' />
              {t('Export conversation')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function ResultStat(props: {
  icon: typeof FileCheck2Icon
  label: string
  value: string
}) {
  return (
    <div className='rounded-lg border p-3'>
      <div className='text-muted-foreground flex items-center gap-1.5 text-xs'>
        <props.icon className='size-3.5' />
        {props.label}
      </div>
      <div className='mt-1 text-lg font-semibold'>{props.value}</div>
    </div>
  )
}

function ResultFileList(props: { files: HermesResultFile[] }) {
  const { t } = useTranslation()
  const shownFiles = props.files.slice(0, 4)

  return (
    <div className='bg-muted/20 space-y-2 rounded-md border p-2'>
      <div className='text-muted-foreground text-xs font-medium'>
        {t('Result files')}
      </div>
      <div className='grid gap-2 sm:grid-cols-2'>
        {shownFiles.map((file) => (
          <ResultFileCard file={file} key={file.id} />
        ))}
      </div>
      {props.files.length > shownFiles.length ? (
        <div className='text-muted-foreground text-xs'>
          {t('{{count}} more files', {
            count: props.files.length - shownFiles.length,
          })}
        </div>
      ) : null}
    </div>
  )
}

function ResultFileCard(props: { file: HermesResultFile }) {
  const { t } = useTranslation()
  const { file } = props
  const fileDescription = [
    getResultTypeLabel(file.type, t),
    getFileSourceLabel(file.source, t),
    file.mediaType,
    formatFileSize(file.size),
  ]
    .filter(Boolean)
    .join(' / ')

  return (
    <div className='bg-background flex min-w-0 items-center gap-2 rounded-md border p-2 text-xs'>
      <div className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded'>
        <ResultTypeIcon type={file.type} />
      </div>
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium'>{file.filename}</div>
        <div className='text-muted-foreground truncate'>{fileDescription}</div>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        <a
          aria-label={t('Open')}
          className='hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors'
          href={file.href}
          rel='noreferrer'
          target='_blank'
        >
          <ExternalLinkIcon className='size-3.5' />
        </a>
        <a
          aria-label={t('Download')}
          className='hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors'
          download={file.filename}
          href={file.href}
        >
          <DownloadIcon className='size-3.5' />
        </a>
        <button
          aria-label={t('Copy link')}
          className='hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors'
          onClick={() => copyFileLink(file.href, t('Copied to clipboard'))}
          type='button'
        >
          <CopyIcon className='size-3.5' />
        </button>
      </div>
    </div>
  )
}

function ResultTypeIcon(props: { type: HermesResultType }) {
  switch (props.type) {
    case 'ppt':
      return <PresentationIcon className='size-4' />
    case 'attachment':
      return <FileArchiveIcon className='size-4' />
    case 'report':
    case 'document':
    default:
      return <FileTextIcon className='size-4' />
  }
}

function mergeServerAndLocalResults(
  serverResults: HermesResultItem[],
  localResults: HermesResultItem[]
): HermesResultItem[] {
  if (serverResults.length === 0) return localResults
  const serverSessionIds = new Set(serverResults.map((item) => item.session.id))
  return [
    ...serverResults,
    ...localResults.filter((item) => !serverSessionIds.has(item.session.id)),
  ]
}

function buildServerResultItems(
  records: HermesResultRecord[],
  sessions: HermesConversation[]
): HermesResultItem[] {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]))
  const grouped = new Map<string, HermesResultRecord[]>()

  for (const record of records) {
    const conversationId = record.conversationId || record.resultKey
    const existing = grouped.get(conversationId) ?? []
    existing.push(record)
    grouped.set(conversationId, existing)
  }

  return [...grouped.entries()].map(([conversationId, group]) => {
    const newest = [...group].sort(
      (a, b) =>
        normalizeResultTime(b.updatedAt) - normalizeResultTime(a.updatedAt)
    )[0]
    const session =
      sessionsById.get(conversationId) ??
      createSessionFromResult(conversationId, newest)
    const messages =
      loadMessages(createPlaygroundStorageKeys(session.storageScope)) ?? []
    const files = group
      .filter((record) => record.href)
      .map((record) => normalizeServerFile(record))
    const generatedFileCount = files.filter(
      (file) => file.source === 'artifact'
    ).length
    const uploadedFileCount = files.filter(
      (file) => file.source === 'attachment'
    ).length
    const types = new Set<HermesResultType>()
    for (const record of group) types.add(record.resultType)

    return {
      session,
      messages,
      assistantMessages:
        messages.filter((message) => message.from === 'assistant').length ||
        (group.some((record) => record.source === 'conversation') ? 1 : 0),
      files,
      generatedFileCount,
      uploadedFileCount,
      types,
      serverBacked: true,
      createdBy: newest.createdBy || undefined,
      updatedBy: newest.updatedBy || undefined,
    }
  })
}

function createSessionFromResult(
  conversationId: string,
  result: HermesResultRecord
): HermesConversation {
  const updatedAt = normalizeResultTime(result.updatedAt || result.createdAt)
  return {
    id: conversationId,
    title: result.title || result.fileName || conversationId,
    storageScope: result.storageScope || conversationId,
    hermesSessionId: result.hermesSessionId || conversationId,
    createdAt: normalizeResultTime(result.createdAt) || updatedAt || Date.now(),
    updatedAt: updatedAt || Date.now(),
    pinned: false,
    archived: false,
  }
}

function normalizeServerFile(record: HermesResultRecord): HermesResultFile {
  const source = record.source === 'attachment' ? 'attachment' : 'artifact'
  return {
    id: record.resultKey || `${record.conversationId}-${record.href}`,
    filename:
      record.fileName || decodeFilenameFromHref(record.href) || record.href,
    href: record.href,
    mediaType: record.mediaType || undefined,
    size: record.size || undefined,
    source,
    type: record.resultType,
  }
}

function normalizeResultTime(value: number): number {
  if (!value || !Number.isFinite(value)) return 0
  return value < 1000000000000 ? value * 1000 : value
}

function extractResultFiles(
  session: HermesConversation,
  messages: Message[]
): HermesResultFile[] {
  const files = new Map<string, HermesResultFile>()

  for (const message of messages) {
    for (const attachment of message.attachments ?? []) {
      const normalized = normalizeAttachmentFile(session, message, attachment)
      if (normalized) files.set(normalized.id, normalized)
    }

    if (message.from !== 'assistant') continue
    for (const version of message.versions) {
      const visibleContent = renderHermesDataPathsAsLinks(
        parseThinkTags(version.content).visibleContent
      )
      for (const artifact of extractHermesFileArtifacts(visibleContent)) {
        const normalized = normalizeArtifactFile(session, message, artifact)
        files.set(normalized.id, normalized)
      }
    }
  }

  return [...files.values()]
}

function normalizeAttachmentFile(
  session: HermesConversation,
  message: Message,
  attachment: FileAttachment
): HermesResultFile | null {
  if (!attachment.url) return null
  const filename = attachment.filename || decodeFilenameFromHref(attachment.url)
  const type = inferResultType(filename, attachment.mediaType)
  return {
    id: `${session.id}-${message.key}-attachment-${attachment.url}`,
    filename: filename || attachment.url,
    href: attachment.url,
    mediaType: attachment.mediaType,
    size: attachment.size,
    source: 'attachment',
    type: type === 'all' ? 'attachment' : type,
  }
}

function normalizeArtifactFile(
  session: HermesConversation,
  message: Message,
  artifact: { href: string; filename: string; label: string }
): HermesResultFile {
  const filename = artifact.filename || artifact.label || artifact.href
  const type = inferResultType(filename)
  return {
    id: `${session.id}-${message.key}-artifact-${artifact.href}`,
    filename,
    href: artifact.href,
    source: 'artifact',
    type: type === 'all' ? 'document' : type,
  }
}

function resultMatchesType(
  item: HermesResultItem,
  type: HermesResultType
): boolean {
  if (type === 'all') return true
  if (type === 'attachment') {
    return item.files.some((file) => file.source === 'attachment')
  }
  if (item.files.some((file) => file.type === type)) return true
  return type === 'document' && item.assistantMessages > 0
}

function resultMatchesQuery(item: HermesResultItem, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return true
  return getResultHaystack(item).toLowerCase().includes(normalizedQuery)
}

function getResultHaystack(item: HermesResultItem): string {
  const messageText = item.messages
    .flatMap((message) => message.versions.map((version) => version.content))
    .join(' ')
  const fileText = item.files
    .map((file) =>
      [file.filename, file.mediaType, file.href].filter(Boolean).join(' ')
    )
    .join(' ')
  return [item.session.title, messageText, fileText].join(' ')
}

function getPrimaryResultType(item: HermesResultItem): HermesResultType {
  if (item.files.some((file) => file.type === 'ppt')) return 'ppt'
  if (item.files.some((file) => file.type === 'report')) return 'report'
  if (item.files.some((file) => file.type === 'document')) return 'document'
  if (item.files.length > 0) return 'attachment'
  return 'document'
}

function inferResultType(
  filename?: string,
  mediaType?: string
): HermesResultType {
  const haystack = `${filename ?? ''} ${mediaType ?? ''}`.toLowerCase()
  if (/\.(ppt|pptx)\b|powerpoint|presentation|\bppt\b/.test(haystack)) {
    return 'ppt'
  }
  if (/report|research|\u8c03\u7814|\u62a5\u544a/.test(haystack)) {
    return 'report'
  }
  if (
    /\.(doc|docx|md|pdf|txt|xlsx|xls)\b|document|markdown|pdf|text|\u6587\u6863|\u6750\u6599/.test(
      haystack
    )
  ) {
    return 'document'
  }
  return 'attachment'
}

function getDefaultScope(
  workspaceMode?: 'personal' | 'team'
): HermesResultScope {
  return workspaceMode === 'team' ? 'team' : 'mine'
}

function getResultScopeLabel(
  scope: HermesResultScope,
  t: (key: string) => string
): string {
  if (scope === 'mine') return t('My results')
  if (scope === 'team') return t('Team results')
  return t('All results')
}

function getFileSourceLabel(
  source: HermesResultFileSource,
  t: (key: string) => string
): string {
  return source === 'artifact' ? t('Generated file') : t('Attachment')
}

function getResultTypeLabel(
  type: HermesResultType,
  t: (key: string) => string
): string {
  switch (type) {
    case 'ppt':
      return t('PPT')
    case 'report':
      return t('Reports')
    case 'document':
      return t('Documents')
    case 'attachment':
      return t('Attachment results')
    default:
      return t('All result types')
  }
}

function getResultsTitle(
  type: HermesResultType,
  t: (key: string) => string
): string {
  if (type === 'all') return t('Hermes results')
  return getResultTypeLabel(type, t)
}

function getEmptyTitle(
  type: HermesResultType,
  t: (key: string) => string
): string {
  if (type === 'all') return t('No results yet')
  return t('No results match the current result filter.')
}
function getEmptyDescription(
  fallback: string | undefined,
  type: HermesResultType,
  t: (key: string) => string
): string {
  if (fallback) return fallback
  if (type !== 'all') {
    return t('No results match the current result filter.')
  }
  return t(
    'Ask Hermes to produce a report, file, skill or analysis result, then export it here.'
  )
}

function getResultTypeOptions(t: (key: string) => string) {
  return [
    { value: 'all' as const, label: t('All results'), icon: FileCheck2Icon },
    { value: 'ppt' as const, label: t('PPT'), icon: PresentationIcon },
    { value: 'report' as const, label: t('Reports'), icon: FileTextIcon },
    { value: 'document' as const, label: t('Documents'), icon: FileTextIcon },
    {
      value: 'attachment' as const,
      label: t('Attachment results'),
      icon: FileArchiveIcon,
    },
  ]
}

function getResultScopeOptions(
  workspaceMode: 'personal' | 'team' | undefined,
  t: (key: string) => string
) {
  const isTeam = workspaceMode === 'team'
  return [
    { value: 'all' as const, label: t('All results'), icon: FileCheck2Icon },
    {
      value: 'mine' as const,
      label: t('My results'),
      icon: UserIcon,
      disabled: isTeam,
    },
    {
      value: 'team' as const,
      label: t('Team results'),
      icon: UsersIcon,
      disabled: !isTeam,
    },
  ]
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

function copyFileLink(href: string, successMessage: string) {
  const absoluteUrl = new URL(href, window.location.origin).toString()
  void navigator.clipboard.writeText(absoluteUrl).then(() => {
    toast.success(successMessage)
  })
}

function sanitizeDownloadFilename(filename: string): string {
  const value = filename.trim().replaceAll(/[\\/:*?"<>|]/g, '_')
  return value || 'hermes-result.json'
}

function decodeFilenameFromHref(href: string): string {
  const rawFilename = href.split('/').reverse().find(Boolean) ?? ''
  if (!rawFilename) return ''
  try {
    return decodeURIComponent(rawFilename)
  } catch {
    return rawFilename
  }
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return ''
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}
