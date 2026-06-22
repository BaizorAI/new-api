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
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { useAuthStore } from '@/stores/auth-store'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
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
  createPlaygroundConversation,
  PLAYGROUND_SESSIONS_CHANGED_EVENT,
  getPlaygroundBaseScope,
  loadActiveConversationId,
  loadPlaygroundConversations,
  saveActiveConversationId,
  savePlaygroundConversations,
  sortConversations,
  type PlaygroundConversation,
} from '@/features/playground/sessions'
import { createPlaygroundStorageKeys, loadMessages } from '@/features/playground/lib'
import { normalizeHref } from '../lib/url-utils'
import type { NavPlaygroundSessions } from '../types'

interface ConversationGroup {
  pinned: PlaygroundConversation[]
  recent: PlaygroundConversation[]
  archived: PlaygroundConversation[]
}

export function PlaygroundSessionsItem({ item }: { item: NavPlaygroundSessions }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.auth.user?.id)
  const baseScope = getPlaygroundBaseScope(userId)
  const href = useLocation({ select: (location) => location.href })
  const { state, isMobile, setOpenMobile } = useSidebar()
  const [conversations, setConversations] = useState<PlaygroundConversation[]>(() =>
    loadPlaygroundConversations(baseScope)
  )
  const [activeConversationId, setActiveConversationId] = useState(() =>
    loadActiveConversationId(baseScope, conversations)
  )
  const [renamingConversation, setRenamingConversation] =
    useState<PlaygroundConversation | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const reloadConversations = useCallback(() => {
    const next = loadPlaygroundConversations(baseScope)
    setConversations(next)
    setActiveConversationId(loadActiveConversationId(baseScope, next))
  }, [baseScope])

  useEffect(() => {
    window.addEventListener(PLAYGROUND_SESSIONS_CHANGED_EVENT, reloadConversations)
    window.addEventListener('storage', reloadConversations)
    return () => {
      window.removeEventListener(PLAYGROUND_SESSIONS_CHANGED_EVENT, reloadConversations)
      window.removeEventListener('storage', reloadConversations)
    }
  }, [reloadConversations])

  const conversationGroups = useMemo<ConversationGroup>(
    () => ({
      pinned: sortConversations(
        conversations.filter((c) => c.pinned && !c.archived)
      ),
      recent: sortConversations(
        conversations.filter((c) => !c.pinned && !c.archived)
      ),
      archived: sortConversations(
        conversations.filter((c) => Boolean(c.archived))
      ),
    }),
    [conversations]
  )

  const normalizedHref = normalizeHref(href)
  const isPlaygroundActive = normalizedHref.startsWith('/playground')

  const createConversation = useCallback(() => {
    const next = createPlaygroundConversation(baseScope)
    const nextConversations = [next, ...conversations]
    savePlaygroundConversations(baseScope, nextConversations)
    saveActiveConversationId(baseScope, next.id)
    setConversations(nextConversations)
    setActiveConversationId(next.id)
    setOpenMobile(false)
    void navigate({ to: '/playground' })
  }, [baseScope, navigate, conversations, setOpenMobile])

  const selectConversation = useCallback(
    (conversationId: string) => {
      saveActiveConversationId(baseScope, conversationId)
      setActiveConversationId(conversationId)
      setOpenMobile(false)
    },
    [baseScope, setOpenMobile]
  )

  const updateConversation = useCallback(
    (
      conversationId: string,
      updater: (c: PlaygroundConversation) => PlaygroundConversation
    ) => {
      const next = conversations.map((c) =>
        c.id === conversationId
          ? { ...updater(c), updatedAt: Date.now() }
          : c
      )
      savePlaygroundConversations(baseScope, next)
      setConversations(next)
    },
    [baseScope, conversations]
  )

  const copyConversationId = useCallback(
    async (c: PlaygroundConversation) => {
      try {
        await navigator.clipboard.writeText(c.id)
        toast.success(t('Copied to clipboard'))
      } catch {
        toast.error(t('Copy failed'))
      }
    },
    [t]
  )

  const exportConversation = useCallback(
    (c: PlaygroundConversation) => {
      const storageKeys = createPlaygroundStorageKeys(c.storageScope)
      const messages = loadMessages(storageKeys) ?? []
      downloadJson(
        {
          exportedAt: new Date().toISOString(),
          conversation: c,
          messages,
        },
        `${c.title || c.id}.json`
      )
      toast.success(t('Exported'))
    },
    [t]
  )

  const deleteConversation = useCallback(
    (c: PlaygroundConversation) => {
      clearConversationStorage(c)

      if (conversations.length <= 1) {
        const next = createPlaygroundConversation(baseScope)
        savePlaygroundConversations(baseScope, [next])
        saveActiveConversationId(baseScope, next.id)
        setConversations([next])
        setActiveConversationId(next.id)
        return
      }

      const next = conversations.filter((item) => item.id !== c.id)
      savePlaygroundConversations(baseScope, next)
      setConversations(next)

      if (activeConversationId !== c.id) return

      const nextActive =
        next.find((item) => !item.archived)?.id ?? next[0]?.id
      if (!nextActive) return

      saveActiveConversationId(baseScope, nextActive)
      setActiveConversationId(nextActive)
    },
    [activeConversationId, baseScope, conversations]
  )

  const submitRename = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!renamingConversation) return
      updateConversation(renamingConversation.id, (c) => ({
        ...c,
        title: renameValue.trim(),
      }))
      setRenamingConversation(null)
      setRenameValue('')
    },
    [renameValue, renamingConversation, updateConversation]
  )

  const conversationActions = {
    archive: (c: PlaygroundConversation) =>
      updateConversation(c.id, (current) => ({
        ...current,
        archived: !current.archived,
        pinned: current.archived ? current.pinned : false,
      })),
    copyId: copyConversationId,
    delete: deleteConversation,
    export: exportConversation,
    openInNewWindow: (c: PlaygroundConversation) => {
      saveActiveConversationId(baseScope, c.id)
      window.open('/playground', '_blank', 'noopener,noreferrer')
    },
    pin: (c: PlaygroundConversation) =>
      updateConversation(c.id, (current) => ({
        ...current,
        archived: false,
        pinned: !current.pinned,
      })),
    rename: (c: PlaygroundConversation) => {
      setRenamingConversation(c)
      setRenameValue(c.title)
    },
    select: selectConversation,
  }

  if (state === 'collapsed' && !isMobile) {
    return (
      <>
        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <SidebarMenuButton tooltip={item.title} isActive={isPlaygroundActive} />
              }
            >
              {item.icon ? (
                <item.icon className='shrink-0' />
              ) : (
                <Plus className='shrink-0' />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent side='right' align='start' sideOffset={4}>
              <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={createConversation}>
                <Plus className='size-4' />
                {t('New session')}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownConversationGroup
                title={t('Pinned')}
                conversations={conversationGroups.pinned}
                activeId={activeConversationId}
                visible={conversationGroups.pinned.length > 0}
                onSelect={selectConversation}
              />
              <DropdownConversationGroup
                title={t('Recent')}
                conversations={conversationGroups.recent}
                activeId={activeConversationId}
                visible
                onSelect={selectConversation}
              />
              <DropdownConversationGroup
                title={t('Archived')}
                conversations={conversationGroups.archived}
                activeId={activeConversationId}
                visible
                onSelect={selectConversation}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
        <RenameDialog
          open={Boolean(renamingConversation)}
          value={renameValue}
          onOpenChange={(open) => {
            if (!open) setRenamingConversation(null)
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
        defaultOpen={isPlaygroundActive}
        className='group/collapsible'
        render={<SidebarMenuItem />}
      >
        <CollapsibleTrigger
          className='group/collapsible-trigger'
          render={<SidebarMenuButton isActive={isPlaygroundActive} />}
        >
          {item.icon ? (
            <item.icon className='shrink-0' />
          ) : (
            <Plus className='shrink-0' />
          )}
          <span className='min-w-0 flex-1 truncate'>{item.title}</span>
          <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible-trigger:rotate-90' />
        </CollapsibleTrigger>
        <SidebarMenuAction
          showOnHover
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            createConversation()
          }}
          aria-label={t('New session')}
          title={t('New session')}
        >
          <Plus className='size-3.5' />
        </SidebarMenuAction>
        <CollapsibleContent className='CollapsibleContent'>
          <SidebarMenuSub>
            <SidebarMenuSubItem>
              <SidebarMenuSubButton onClick={createConversation}>
                <Plus className='size-3.5' />
                <span>{t('New session')}</span>
              </SidebarMenuSubButton>
            </SidebarMenuSubItem>
            <SidebarConversationGroup
              title={t('Pinned')}
              conversations={conversationGroups.pinned}
              activeId={activeConversationId}
              visible={conversationGroups.pinned.length > 0}
              actions={conversationActions}
            />
            <SidebarConversationGroup
              title={t('Recent')}
              conversations={conversationGroups.recent}
              activeId={activeConversationId}
              visible
              actions={conversationActions}
            />
            <SidebarConversationGroup
              title={t('Archived')}
              conversations={conversationGroups.archived}
              activeId={activeConversationId}
              visible
              actions={conversationActions}
            />
          </SidebarMenuSub>
        </CollapsibleContent>
      </Collapsible>
      <RenameDialog
        open={Boolean(renamingConversation)}
        value={renameValue}
        onOpenChange={(open) => {
          if (!open) setRenamingConversation(null)
        }}
        onSubmit={submitRename}
        onValueChange={setRenameValue}
      />
    </>
  )
}

interface ConversationActions {
  archive: (c: PlaygroundConversation) => void
  copyId: (c: PlaygroundConversation) => void
  delete: (c: PlaygroundConversation) => void
  export: (c: PlaygroundConversation) => void
  openInNewWindow: (c: PlaygroundConversation) => void
  pin: (c: PlaygroundConversation) => void
  rename: (c: PlaygroundConversation) => void
  select: (id: string) => void
}

function SidebarConversationGroup(props: {
  title: string
  conversations: PlaygroundConversation[]
  activeId: string
  visible: boolean
  actions: ConversationActions
}) {
  if (!props.visible) return null

  return (
    <>
      <SidebarMenuSubItem>
        <div className='text-sidebar-foreground/60 px-2 pt-2 pb-1 text-[11px] font-medium'>
          {props.title}
        </div>
      </SidebarMenuSubItem>
      {props.conversations.map((c) => (
        <SidebarConversationItem
          key={c.id}
          conversation={c}
          active={props.activeId === c.id}
          actions={props.actions}
        />
      ))}
    </>
  )
}

function SidebarConversationItem(props: {
  conversation: PlaygroundConversation
  active: boolean
  actions: ConversationActions
}) {
  const { t } = useTranslation()

  return (
    <SidebarMenuSubItem className='group/playground-conversation'>
      <SidebarMenuSubButton
        isActive={props.active}
        render={
          <Link
            to='/playground'
            onClick={() => props.actions.select(props.conversation.id)}
          />
        }
        className='pr-7'
      >
        {props.conversation.pinned && !props.conversation.archived ? (
          <Pin className='size-3.5' />
        ) : null}
        <span>{props.conversation.title || t('New session')}</span>
      </SidebarMenuSubButton>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              className='text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-md opacity-100 md:opacity-0 md:group-hover/playground-conversation:opacity-100'
              aria-label={t('Open menu')}
            />
          }
        >
          <MoreHorizontal className='size-3.5' />
        </DropdownMenuTrigger>
        <ConversationMenu conversation={props.conversation} actions={props.actions} />
      </DropdownMenu>
    </SidebarMenuSubItem>
  )
}

function ConversationMenu(props: {
  conversation: PlaygroundConversation
  actions: ConversationActions
}) {
  const { t } = useTranslation()

  return (
    <DropdownMenuContent align='end' className='w-44'>
      <DropdownMenuItem onClick={() => props.actions.pin(props.conversation)}>
        {props.conversation.pinned ? (
          <PinOff className='size-4' />
        ) : (
          <Pin className='size-4' />
        )}
        {props.conversation.pinned ? t('Unpin') : t('Pin')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.copyId(props.conversation)}>
        <Copy className='size-4' />
        {t('Copy ID')}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => props.actions.openInNewWindow(props.conversation)}
      >
        <ExternalLink className='size-4' />
        {t('Open in new window')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.export(props.conversation)}>
        <Download className='size-4' />
        {t('Export')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.rename(props.conversation)}>
        <Pencil className='size-4' />
        {t('Rename')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.archive(props.conversation)}>
        {props.conversation.archived ? (
          <ArchiveRestore className='size-4' />
        ) : (
          <Archive className='size-4' />
        )}
        {props.conversation.archived ? t('Restore') : t('Archive')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant='destructive'
        onClick={() => props.actions.delete(props.conversation)}
      >
        <Trash2 className='size-4' />
        {t('Delete')}
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

function DropdownConversationGroup(props: {
  title: string
  conversations: PlaygroundConversation[]
  activeId: string
  visible: boolean
  onSelect: (id: string) => void
}) {
  if (!props.visible) return null

  return (
    <>
      <DropdownMenuLabel>{props.title}</DropdownMenuLabel>
      {props.conversations.map((c) => (
        <DropdownMenuItem
          key={c.id}
          render={
            <Link
              to='/playground'
              className={props.activeId === c.id ? 'bg-secondary' : ''}
              onClick={() => props.onSelect(c.id)}
            />
          }
        >
          {c.title || props.title}
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
  const filenameWithoutPathChars = filename.trim().replaceAll(/[<>:"/\\|?*]/g, '_')
  const safeName = [...filenameWithoutPathChars]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
  return safeName || 'playground-conversation.json'
}
