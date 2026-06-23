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
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { IconHermes } from '@/assets/brand-icons'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  clearConversationStorage,
  createHermesConversation,
  HERMES_SESSIONS_CHANGED_EVENT,
  getHermesBaseScope,
  loadActiveConversationId,
  loadHermesConversations,
  requestOpenHermesCapabilities,
  requestOpenHermesMessagePlatforms,
  requestOpenHermesResults,
  saveActiveConversationId,
  saveHermesConversations,
  sortSessions,
  type HermesConversation,
} from '@/features/hermes-playground/sessions'
import {
  createPlaygroundStorageKeys,
  loadMessages,
} from '@/features/playground/lib'
import { useAuthStore } from '@/stores/auth-store'

import { normalizeHref } from '../lib/url-utils'
import type { NavHermesSessions } from '../types'

interface SessionGroup {
  pinned: HermesConversation[]
  recent: HermesConversation[]
  archived: HermesConversation[]
}

export function HermesSessionsItem({ item }: { item: NavHermesSessions }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.auth.user?.id)
  const baseScope = getHermesBaseScope(userId)
  const href = useLocation({ select: (location) => location.href })
  const { state, isMobile, setOpenMobile } = useSidebar()
  const [sessions, setSessions] = useState<HermesConversation[]>(() =>
    loadHermesConversations(baseScope)
  )
  const [activeSessionId, setActiveSessionId] = useState(() =>
    loadActiveConversationId(baseScope, sessions)
  )
  const [renamingSession, setRenamingSession] =
    useState<HermesConversation | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const reloadSessions = useCallback(() => {
    const nextSessions = loadHermesConversations(baseScope)
    setSessions(nextSessions)
    setActiveSessionId(loadActiveConversationId(baseScope, nextSessions))
  }, [baseScope])

  useEffect(() => {
    window.addEventListener(HERMES_SESSIONS_CHANGED_EVENT, reloadSessions)
    window.addEventListener('storage', reloadSessions)
    return () => {
      window.removeEventListener(HERMES_SESSIONS_CHANGED_EVENT, reloadSessions)
      window.removeEventListener('storage', reloadSessions)
    }
  }, [reloadSessions])

  const sessionGroups = useMemo<SessionGroup>(
    () => ({
      pinned: sortSessions(
        sessions.filter((session) => session.pinned && !session.archived)
      ),
      recent: sortSessions(
        sessions.filter((session) => !session.pinned && !session.archived)
      ),
      archived: sortSessions(
        sessions.filter((session) => Boolean(session.archived))
      ),
    }),
    [sessions]
  )

  const normalizedHref = normalizeHref(href)
  const isHermesActive = normalizedHref.startsWith('/hermes-playground')

  const createSession = useCallback(() => {
    const nextSession = createHermesConversation(baseScope)
    const nextSessions = [nextSession, ...sessions]
    saveHermesConversations(baseScope, nextSessions)
    saveActiveConversationId(baseScope, nextSession.id)
    setSessions(nextSessions)
    setActiveSessionId(nextSession.id)
    setOpenMobile(false)
    void navigate({ to: '/hermes-playground' })
  }, [baseScope, navigate, sessions, setOpenMobile])

  const openCapabilities = useCallback(() => {
    requestOpenHermesCapabilities()
    setOpenMobile(false)
    void navigate({ to: '/hermes-playground' })
  }, [navigate, setOpenMobile])

  const openMessagePlatforms = useCallback(() => {
    requestOpenHermesMessagePlatforms()
    setOpenMobile(false)
    void navigate({ to: '/hermes-playground' })
  }, [navigate, setOpenMobile])
  const openResults = useCallback(() => {
    requestOpenHermesResults()
    setOpenMobile(false)
    void navigate({ to: '/hermes-playground' })
  }, [navigate, setOpenMobile])

  const selectSession = useCallback(
    (sessionId: string) => {
      saveActiveConversationId(baseScope, sessionId)
      setActiveSessionId(sessionId)
      setOpenMobile(false)
    },
    [baseScope, setOpenMobile]
  )

  const updateSession = useCallback(
    (
      sessionId: string,
      updater: (session: HermesConversation) => HermesConversation
    ) => {
      const nextSessions = sessions.map((session) =>
        session.id === sessionId
          ? { ...updater(session), updatedAt: Date.now() }
          : session
      )
      saveHermesConversations(baseScope, nextSessions)
      setSessions(nextSessions)
    },
    [baseScope, sessions]
  )

  const copySessionId = useCallback(
    async (session: HermesConversation) => {
      try {
        await navigator.clipboard.writeText(session.hermesSessionId)
        toast.success(t('Copied to clipboard'))
      } catch {
        toast.error(t('Copy failed'))
      }
    },
    [t]
  )

  const exportSession = useCallback(
    (session: HermesConversation) => {
      const storageKeys = createPlaygroundStorageKeys(session.storageScope)
      const messages = loadMessages(storageKeys) ?? []
      downloadJson(
        {
          exportedAt: new Date().toISOString(),
          session,
          messages,
        },
        `${session.title || session.id}.json`
      )
      toast.success(t('Exported'))
    },
    [t]
  )

  const deleteSession = useCallback(
    (session: HermesConversation) => {
      clearConversationStorage(session)

      if (sessions.length <= 1) {
        const nextSession = createHermesConversation(baseScope)
        saveHermesConversations(baseScope, [nextSession])
        saveActiveConversationId(baseScope, nextSession.id)
        setSessions([nextSession])
        setActiveSessionId(nextSession.id)
        return
      }

      const nextSessions = sessions.filter((item) => item.id !== session.id)
      saveHermesConversations(baseScope, nextSessions)
      setSessions(nextSessions)

      if (activeSessionId !== session.id) return

      const nextActive =
        nextSessions.find((item) => !item.archived)?.id ?? nextSessions[0]?.id
      if (!nextActive) return

      saveActiveConversationId(baseScope, nextActive)
      setActiveSessionId(nextActive)
    },
    [activeSessionId, baseScope, sessions]
  )

  const submitRename = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!renamingSession) return
      updateSession(renamingSession.id, (session) => ({
        ...session,
        title: renameValue.trim(),
      }))
      setRenamingSession(null)
      setRenameValue('')
    },
    [renameValue, renamingSession, updateSession]
  )

  const sessionActions = {
    archive: (session: HermesConversation) =>
      updateSession(session.id, (current) => ({
        ...current,
        archived: !current.archived,
        pinned: current.archived ? current.pinned : false,
      })),
    copyId: copySessionId,
    delete: deleteSession,
    export: exportSession,
    openInNewWindow: (session: HermesConversation) => {
      saveActiveConversationId(baseScope, session.id)
      window.open('/hermes-playground', '_blank', 'noopener,noreferrer')
    },
    pin: (session: HermesConversation) =>
      updateSession(session.id, (current) => ({
        ...current,
        archived: false,
        pinned: !current.pinned,
      })),
    rename: (session: HermesConversation) => {
      setRenamingSession(session)
      setRenameValue(session.title)
    },
    select: selectSession,
  }

  if (state === 'collapsed' && !isMobile) {
    return (
      <>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton
                  tooltip={item.title}
                  isActive={isHermesActive}
                />
              }
            >
              {item.icon ? (
                <item.icon className='shrink-0' />
              ) : (
                <IconHermes className='shrink-0' />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side='right' align='start' sideOffset={4}>
              <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createSession}>
                <Plus className='size-4' />
                {t('New session')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openCapabilities}>
                <Sparkles className='size-4' />
                {t('Capabilities')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openResults}>
                <FileCheck2 />
                {t('Results')}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openMessagePlatforms}>
                <MessageCircle className='size-4' />
                {t('Message platforms')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownSessionGroup
                title={t('Pinned')}
                sessions={sessionGroups.pinned}
                activeSessionId={activeSessionId}
                visible={sessionGroups.pinned.length > 0}
                onSelect={selectSession}
              />
              <DropdownSessionGroup
                title={t('Recent')}
                sessions={sessionGroups.recent}
                activeSessionId={activeSessionId}
                visible
                onSelect={selectSession}
              />
              <DropdownSessionGroup
                title={t('Archived')}
                sessions={sessionGroups.archived}
                activeSessionId={activeSessionId}
                visible
                onSelect={selectSession}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
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

  return (
    <>
      <Collapsible
        defaultOpen={isHermesActive}
        className='group/collapsible'
        render={<SidebarMenuItem />}
      >
        <CollapsibleTrigger
          className='group/collapsible-trigger'
          render={<SidebarMenuButton isActive={isHermesActive} />}
        >
          {item.icon ? (
            <item.icon className='shrink-0' />
          ) : (
            <IconHermes className='shrink-0' />
          )}
          <span className='min-w-0 flex-1 truncate'>{item.title}</span>
          <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible-trigger:rotate-90' />
        </CollapsibleTrigger>
        <SidebarMenuAction
          showOnHover
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            createSession()
          }}
          aria-label={t('New session')}
          title={t('New session')}
        >
          <Plus className='size-3.5' />
        </SidebarMenuAction>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton onClick={createSession}>
                <Plus className='size-3.5' />
                <span>{t('New session')}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton onClick={openCapabilities}>
                <Sparkles className='size-3.5' />
                <span>{t('Capabilities')}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton onClick={openResults}>
                <FileCheck2 />
                <span>{t('Results')}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton onClick={openMessagePlatforms}>
                <MessageCircle className='size-3.5' />
                <span>{t('Message platforms')}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarSessionGroup
              title={t('Pinned')}
              sessions={sessionGroups.pinned}
              activeSessionId={activeSessionId}
              visible={sessionGroups.pinned.length > 0}
              actions={sessionActions}
            />
            <SidebarSessionGroup
              title={t('Recent')}
              sessions={sessionGroups.recent}
              activeSessionId={activeSessionId}
              visible
              actions={sessionActions}
            />
            <SidebarSessionGroup
              title={t('Archived')}
              sessions={sessionGroups.archived}
              activeSessionId={activeSessionId}
              visible
              actions={sessionActions}
            />
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
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

function SidebarSessionGroup(props: {
  title: string
  sessions: HermesConversation[]
  activeSessionId: string
  visible: boolean
  actions: SessionActions
}) {
  if (!props.visible) return null

  return (
    <>
      <SidebarMenuSubItem>
        <div className='text-sidebar-foreground/60 px-2 pt-2 pb-1 text-[11px] font-medium'>
          {props.title}
        </div>
      </SidebarMenuSubItem>
      {props.sessions.map((session) => (
        <SidebarSessionItem
          key={session.id}
          session={session}
          active={props.activeSessionId === session.id}
          actions={props.actions}
        />
      ))}
    </>
  )
}

function SidebarSessionItem(props: {
  session: HermesConversation
  active: boolean
  actions: SessionActions
}) {
  const { t } = useTranslation()

  return (
    <SidebarMenuSubItem className='group/hermes-session'>
      <SidebarMenuSubButton
        isActive={props.active}
        render={
          <Link
            to='/hermes-playground'
            onClick={() => props.actions.select(props.session.id)}
          />
        }
        className='pr-7'
      >
        {props.session.pinned && !props.session.archived ? (
          <Pin className='size-3.5' />
        ) : null}
        <span>{props.session.title || t('New session')}</span>
      </SidebarMenuSubButton>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              className='text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-md opacity-100 md:opacity-0 md:group-hover/hermes-session:opacity-100'
              aria-label={t('Open menu')}
            />
          }
        >
          <MoreHorizontal className='size-3.5' />
        </DropdownMenuTrigger>
        <SessionMenu session={props.session} actions={props.actions} />
      </DropdownMenu>
    </SidebarMenuSubItem>
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
          <PinOff className='size-4' />
        ) : (
          <Pin className='size-4' />
        )}
        {props.session.pinned ? t('Unpin') : t('Pin')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.copyId(props.session)}>
        <Copy className='size-4' />
        {t('Copy ID')}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => props.actions.openInNewWindow(props.session)}
      >
        <ExternalLink className='size-4' />
        {t('Open in new window')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.export(props.session)}>
        <Download className='size-4' />
        {t('Export')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.rename(props.session)}>
        <Pencil className='size-4' />
        {t('Rename')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.archive(props.session)}>
        {props.session.archived ? (
          <ArchiveRestore className='size-4' />
        ) : (
          <Archive className='size-4' />
        )}
        {props.session.archived ? t('Restore') : t('Archive')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant='destructive'
        onClick={() => props.actions.delete(props.session)}
      >
        <Trash2 className='size-4' />
        {t('Delete')}
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

function DropdownSessionGroup(props: {
  title: string
  sessions: HermesConversation[]
  activeSessionId: string
  visible: boolean
  onSelect: (sessionId: string) => void
}) {
  if (!props.visible) return null

  return (
    <>
      <DropdownMenuLabel>{props.title}</DropdownMenuLabel>
      {props.sessions.map((session) => (
        <DropdownMenuItem
          key={session.id}
          render={
            <Link
              to='/hermes-playground'
              className={
                props.activeSessionId === session.id ? 'bg-secondary' : ''
              }
              onClick={() => props.onSelect(session.id)}
            />
          }
        >
          {session.title || props.title}
        </DropdownMenuItem>
      ))}
    </>
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
            value={props.value}
            onChange={(event) => props.onValueChange(event.target.value)}
            aria-label={t('Session name')}
            autoFocus
          />
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => props.onOpenChange(false)}
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

function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeDownloadFilename(filename)
  anchor.click()
  URL.revokeObjectURL(url)
}

function sanitizeDownloadFilename(filename: string): string {
  const filenameWithoutPathChars = filename
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, '_')
  const safeName = [...filenameWithoutPathChars]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
  return safeName || 'hermes-session.json'
}
