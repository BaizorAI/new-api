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
  ArchiveIcon,
  ArchiveRestoreIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PinIcon,
  PinOffIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react'
import { useMemo, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
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
  formatSessionTime,
  sortSessions,
  type HermesConversation,
} from '../sessions'

interface HermesSessionsSheetProps {
  open: boolean
  sessions: HermesConversation[]
  activeSessionId: string
  isLoading?: boolean
  title: string
  description: string
  onOpenChange: (open: boolean) => void
  onCreateSession: () => void
  onDeleteSession: (session: HermesConversation) => void
  onExportSession: (session: HermesConversation) => void
  onOpenSessionInNewWindow: (session: HermesConversation) => void
  onSelectSession: (sessionId: string) => void
  onUpdateSession: (
    sessionId: string,
    updater: (session: HermesConversation) => HermesConversation
  ) => void
}

interface SessionGroup {
  title: string
  sessions: HermesConversation[]
  visible: boolean
}

export function HermesSessionsSheet(props: HermesSessionsSheetProps) {
  const { t } = useTranslation()
  const [renamingSession, setRenamingSession] =
    useState<HermesConversation | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const groups = useMemo<SessionGroup[]>(
    () => [
      {
        title: t('Pinned'),
        sessions: sortSessions(
          props.sessions.filter(
            (session) => session.pinned && !session.archived
          )
        ),
        visible: props.sessions.some(
          (session) => session.pinned && !session.archived
        ),
      },
      {
        title: t('Recent'),
        sessions: sortSessions(
          props.sessions.filter(
            (session) => !session.pinned && !session.archived
          )
        ),
        visible: true,
      },
      {
        title: t('Archived'),
        sessions: sortSessions(
          props.sessions.filter((session) => Boolean(session.archived))
        ),
        visible: props.sessions.some((session) => Boolean(session.archived)),
      },
    ],
    [props.sessions, t]
  )

  const submitRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!renamingSession) return
    props.onUpdateSession(renamingSession.id, (session) => ({
      ...session,
      title: renameValue.trim(),
    }))
    setRenamingSession(null)
    setRenameValue('')
  }

  const copySessionId = async (session: HermesConversation) => {
    try {
      await navigator.clipboard.writeText(session.hermesSessionId)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }

  const actions = {
    archive: (session: HermesConversation) =>
      props.onUpdateSession(session.id, (current) => ({
        ...current,
        archived: !current.archived,
        pinned: current.archived ? current.pinned : false,
      })),
    copyId: copySessionId,
    delete: props.onDeleteSession,
    export: props.onExportSession,
    openInNewWindow: props.onOpenSessionInNewWindow,
    pin: (session: HermesConversation) =>
      props.onUpdateSession(session.id, (current) => ({
        ...current,
        archived: false,
        pinned: !current.pinned,
      })),
    rename: (session: HermesConversation) => {
      setRenamingSession(session)
      setRenameValue(session.title)
    },
    select: (sessionId: string) => {
      props.onSelectSession(sessionId)
      props.onOpenChange(false)
    },
  }

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className='w-full gap-0 sm:max-w-xl' side='right'>
          <SheetHeader className='border-b pr-12'>
            <div className='flex items-start justify-between gap-3'>
              <div className='min-w-0'>
                <SheetTitle>{props.title}</SheetTitle>
                <SheetDescription>{props.description}</SheetDescription>
              </div>
              <Button
                className='shrink-0'
                disabled={props.isLoading}
                onClick={props.onCreateSession}
                size='sm'
                type='button'
              >
                <PlusIcon data-icon='inline-start' />
                {t('New session')}
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className='min-h-0 flex-1'>
            <div className='space-y-4 p-4'>
              {props.sessions.length === 0 ? (
                <Empty className='min-h-44 rounded-lg border p-4'>
                  <EmptyMedia variant='icon'>
                    <MessageSquareIcon />
                  </EmptyMedia>
                  <EmptyTitle>{t('No team sessions yet')}</EmptyTitle>
                  <EmptyDescription>
                    {t('Create a shared team session to start collaborating.')}
                  </EmptyDescription>
                </Empty>
              ) : (
                groups.map((group) => (
                  <SessionGroupList
                    key={group.title}
                    activeSessionId={props.activeSessionId}
                    actions={actions}
                    group={group}
                  />
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>

      <RenameDialog
        open={Boolean(renamingSession)}
        value={renameValue}
        onOpenChange={(open) => {
          if (!open) setRenamingSession(null)
        }}
        onSubmit={submitRename}
        onValueChange={setRenameValue}
      />
    </>
  )
}

interface SessionActions {
  archive: (session: HermesConversation) => void
  copyId: (session: HermesConversation) => void
  delete: (session: HermesConversation) => void
  export: (session: HermesConversation) => void
  openInNewWindow: (session: HermesConversation) => void
  pin: (session: HermesConversation) => void
  rename: (session: HermesConversation) => void
  select: (sessionId: string) => void
}

function SessionGroupList(props: {
  group: SessionGroup
  activeSessionId: string
  actions: SessionActions
}) {
  if (!props.group.visible) return null

  return (
    <section className='space-y-2'>
      <div className='text-muted-foreground text-xs font-medium'>
        {props.group.title}
      </div>
      {props.group.sessions.map((session) => (
        <SessionCard
          key={session.id}
          active={session.id === props.activeSessionId}
          actions={props.actions}
          session={session}
        />
      ))}
    </section>
  )
}

function SessionCard(props: {
  session: HermesConversation
  active: boolean
  actions: SessionActions
}) {
  const { t } = useTranslation()
  const title = props.session.title || t('New session')
  const timeLabel = formatSessionTime(props.session.updatedAt, t('Just now'))

  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-start gap-3'>
        <div className='bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md'>
          <MessageSquareIcon className='size-4' />
        </div>
        <div className='min-w-0 flex-1 space-y-2'>
          <div className='flex min-w-0 items-start justify-between gap-2'>
            <div className='min-w-0'>
              <div className='flex min-w-0 items-center gap-1.5'>
                {props.session.pinned && !props.session.archived ? (
                  <PinIcon className='text-muted-foreground size-3.5 shrink-0' />
                ) : null}
                <div className='truncate text-sm font-medium'>{title}</div>
              </div>
              <div className='text-muted-foreground text-xs'>
                {t('Updated {{time}}', { time: timeLabel })}
              </div>
            </div>
            <div className='flex shrink-0 items-center gap-1'>
              {props.active ? (
                <Badge variant='secondary'>{t('Current')}</Badge>
              ) : null}
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger
                  render={
                    <Button
                      aria-label={t('Open menu')}
                      size='icon-sm'
                      type='button'
                      variant='ghost'
                    />
                  }
                >
                  <MoreHorizontalIcon className='size-4' />
                </DropdownMenuTrigger>
                <SessionMenu actions={props.actions} session={props.session} />
              </DropdownMenu>
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            <Button
              onClick={() => props.actions.select(props.session.id)}
              size='sm'
              type='button'
              variant={props.active ? 'secondary' : 'outline'}
            >
              <MessageSquareIcon data-icon='inline-start' />
              {t('Open')}
            </Button>
            <Button
              onClick={() => props.actions.export(props.session)}
              size='sm'
              type='button'
              variant='outline'
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

function SessionMenu(props: {
  session: HermesConversation
  actions: SessionActions
}) {
  const { t } = useTranslation()

  return (
    <DropdownMenuContent align='end' className='w-44'>
      <DropdownMenuItem onClick={() => props.actions.pin(props.session)}>
        {props.session.pinned ? (
          <PinOffIcon className='size-4' />
        ) : (
          <PinIcon className='size-4' />
        )}
        {props.session.pinned ? t('Unpin') : t('Pin')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.copyId(props.session)}>
        <CopyIcon className='size-4' />
        {t('Copy ID')}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => props.actions.openInNewWindow(props.session)}
      >
        <ExternalLinkIcon className='size-4' />
        {t('Open in new window')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.export(props.session)}>
        <DownloadIcon className='size-4' />
        {t('Export')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.rename(props.session)}>
        <PencilIcon className='size-4' />
        {t('Rename')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.archive(props.session)}>
        {props.session.archived ? (
          <ArchiveRestoreIcon className='size-4' />
        ) : (
          <ArchiveIcon className='size-4' />
        )}
        {props.session.archived ? t('Restore') : t('Archive')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => props.actions.delete(props.session)}
        variant='destructive'
      >
        <Trash2Icon className='size-4' />
        {t('Delete')}
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

function RenameDialog(props: {
  open: boolean
  value: string
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onValueChange: (value: string) => void
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <form onSubmit={props.onSubmit} className='space-y-4'>
          <DialogHeader>
            <DialogTitle>{t('Rename session')}</DialogTitle>
          </DialogHeader>
          <Input
            aria-label={t('Session name')}
            autoFocus
            onChange={(event) => props.onValueChange(event.target.value)}
            value={props.value}
          />
          <DialogFooter>
            <Button
              onClick={() => props.onOpenChange(false)}
              type='button'
              variant='outline'
            >
              {t('Cancel')}
            </Button>
            <Button type='submit'>{t('Save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
