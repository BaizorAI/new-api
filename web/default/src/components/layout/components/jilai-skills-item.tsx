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
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { listHermesSkills } from '@/features/hermes-playground/api'
import type { HermesSkill } from '@/features/hermes-playground/api'
import { useAuthStore } from '@/stores/auth-store'
import {
  HERMES_SESSIONS_CHANGED_EVENT,
  clearConversationStorage,
  createHermesConversation,
  formatSessionTime,
  getHermesBaseScope,
  loadActiveConversationId,
  peekHermesConversations,
  saveActiveConversationId,
  saveHermesConversations,
  safeStorageScope,
} from '@/features/hermes-playground/sessions'
import type { NavHermesJilaiSkills } from '../types'
import { checkIsActive } from '../lib/url-utils'
import { SIDEBAR_NODE_COLORS } from '../constants'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

const MAX_SIDEBAR_SESSIONS = 5

function JilaiSkillSubItem({
  skill,
  url,
  href,
  onClose,
  index,
}: {
  skill: HermesSkill
  url: string
  href: string
  onClose: () => void
  index: number
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useAuthStore((state) => state.auth.user?.id)

  const baseScope = useMemo(
    () => getHermesBaseScope(userId, `jilai_${safeStorageScope(skill.name)}`),
    [userId, skill.name]
  )
  const subActive = checkIsActive(href, { url })
  const colorClass = SIDEBAR_NODE_COLORS[index % SIDEBAR_NODE_COLORS.length]
  const desc = skill.descriptionZh || skill.description

  const [sessions, setSessions] = useState(() =>
    peekHermesConversations(baseScope)
  )
  useEffect(() => {
    setSessions(peekHermesConversations(baseScope))
  }, [baseScope])
  useEffect(() => {
    const refresh = () => setSessions(peekHermesConversations(baseScope))
    window.addEventListener(HERMES_SESSIONS_CHANGED_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(HERMES_SESSIONS_CHANGED_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [baseScope])

  const visibleSessions = useMemo(
    () => sessions.filter((s) => !s.archived).slice(0, MAX_SIDEBAR_SESSIONS),
    [sessions]
  )
  const activeSessionId = useMemo(
    () =>
      sessions.length > 0
        ? loadActiveConversationId(baseScope, sessions)
        : null,
    [baseScope, sessions]
  )

  const handleNewSession = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const newSession = createHermesConversation(baseScope)
      const existing = peekHermesConversations(baseScope)
      saveHermesConversations(baseScope, [newSession, ...existing])
      saveActiveConversationId(baseScope, newSession.id)
      // Just create the child node. The user clicks the sub-session
      // entry to enter the workspace and type their own message.
      // Skill activation is handled server-side via request headers.
    },
    [baseScope]
  )

  const handleSelectSession = useCallback(
    (sessionId: string) => {
      saveActiveConversationId(baseScope, sessionId)
      onClose()
      void navigate({ to: url as never })
    },
    [baseScope, navigate, onClose, url]
  )

  const reloadSessions = useCallback(() => {
    setSessions(peekHermesConversations(baseScope))
  }, [baseScope])

  return (
    <>
      <SidebarMenuSubItem className='group/skill-item flex items-stretch'>
        <SidebarMenuSubButton
          isActive={subActive}
          title={desc || (skill.displayName ?? skill.name)}
          className={cn('min-w-0 flex-1', desc && 'h-auto py-1.5', colorClass)}
          render={
            <Link
              aria-current={subActive ? 'page' : undefined}
              onClick={onClose}
              to={url}
            />
          }
        >
          <div className='flex min-w-0 flex-1 flex-col gap-0.5'>
            <span className='truncate text-sm leading-snug'>
              {skill.displayName || skill.name}
            </span>
            {desc && (
              <span className='text-muted-foreground line-clamp-2 text-xs leading-tight'>
                {desc}
              </span>
            )}
          </div>
        </SidebarMenuSubButton>
        <button
          type='button'
          aria-label={t('New chat')}
          title={t('New chat')}
          onClick={handleNewSession}
          className='text-muted-foreground hover:text-foreground hover:bg-accent ml-0.5 shrink-0 self-center rounded px-1 py-1 opacity-0 transition-opacity group-hover/skill-item:opacity-100'
        >
          <Plus className='size-3.5' aria-hidden='true' />
        </button>
      </SidebarMenuSubItem>

      {subActive &&
        visibleSessions.map((session) => (
          <JilaiSessionSubNode
            key={session.id}
            active={session.id === activeSessionId}
            baseScope={baseScope}
            session={session}
            url={url}
            onClose={onClose}
            onMutated={reloadSessions}
          />
        ))}
    </>
  )
}

function JilaiSessionSubNode({
  active,
  baseScope,
  session,
  url,
  onClose,
  onMutated,
}: {
  active: boolean
  baseScope: string
  session: ReturnType<typeof createHermesConversation>
  url: string
  onClose: () => void
  onMutated: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const handleSelect = useCallback(() => {
    saveActiveConversationId(baseScope, session.id)
    onClose()
    void navigate({ to: url as never })
  }, [baseScope, session.id, navigate, onClose, url])

  const handlePin = useCallback(() => {
    const all = peekHermesConversations(baseScope)
    const next = all.map((s) =>
      s.id === session.id
        ? { ...s, pinned: !session.pinned, archived: session.pinned ? session.archived : false, updatedAt: Date.now() }
        : s
    )
    saveHermesConversations(baseScope, next)
    onMutated()
  }, [baseScope, onMutated, session])

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(session.hermesSessionId || session.id)
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }, [session.hermesSessionId, session.id, t])

  const handleOpenInNewWindow = useCallback(() => {
    saveActiveConversationId(baseScope, session.id)
    window.open(url, '_blank', 'noopener,noreferrer')
  }, [baseScope, session.id, url])

  const handleExport = useCallback(() => {
    const payload = { exportedAt: new Date().toISOString(), session }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download = (session.title || session.id).replaceAll(/[<>:"/\\|?*]/g, '_') || 'session.json'
    anchor.click()
    URL.revokeObjectURL(downloadUrl)
    toast.success(t('Exported'))
  }, [session, t])

  const handleRename = useCallback(() => {
    setRenameValue(session.title)
    setRenaming(true)
    setMenuOpen(false)
  }, [session.title])

  const submitRename = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const title = renameValue.trim()
      const all = peekHermesConversations(baseScope)
      const next = all.map((s) =>
        s.id === session.id
          ? { ...s, title, titleEdited: title !== '', updatedAt: Date.now() }
          : s
      )
      saveHermesConversations(baseScope, next)
      onMutated()
      setRenaming(false)
      setRenameValue('')
    },
    [baseScope, onMutated, renameValue, session.id]
  )

  const handleArchive = useCallback(() => {
    const all = peekHermesConversations(baseScope)
    const next = all.map((s) =>
      s.id === session.id
        ? { ...s, archived: !session.archived, pinned: session.archived ? session.pinned : false, updatedAt: Date.now() }
        : s
    )
    saveHermesConversations(baseScope, next)
    onMutated()
  }, [baseScope, onMutated, session])

  const handleDelete = useCallback(() => {
    clearConversationStorage(session)
    const all = peekHermesConversations(baseScope)
    const remaining = all.filter((s) => s.id !== session.id)
    saveHermesConversations(baseScope, remaining.length ? remaining : [createHermesConversation(baseScope)])
    onMutated()
  }, [baseScope, onMutated, session])

  return (
    <>
      <SidebarMenuSubItem className='relative group/menu-parent pl-5'>
        <SidebarMenuSubButton
          isActive={active}
          className='text-muted-foreground h-auto py-1'
          onClick={handleSelect}
        >
          <MessageCircle className='size-3 shrink-0' aria-hidden='true' />
          <span className='line-clamp-1 min-w-0 text-xs'>
            {session.title || t('New conversation')}
          </span>
          <span className='text-muted-foreground/50 ml-1 shrink-0 text-[10px]'>
            {formatSessionTime(session.updatedAt, t('Just now'))}
          </span>
        </SidebarMenuSubButton>
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen} modal={false}>
          <DropdownMenuTrigger
            render={
              <Button
                aria-label={t('Open menu')}
                className='absolute top-0.5 right-0.5 size-5 opacity-0 group-hover/menu-parent:opacity-100'
                onClick={(e) => e.stopPropagation()}
                size='icon-sm'
                type='button'
                variant='ghost'
              />
            }
          >
            <MoreHorizontal className='size-3.5' aria-hidden='true' />
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end' className='w-44'>
            <DropdownMenuItem onClick={handlePin}>
              {session.pinned ? (
                <PinOff className='size-4' aria-hidden='true' />
              ) : (
                <Pin className='size-4' aria-hidden='true' />
              )}
              {session.pinned ? t('Unpin') : t('Pin')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleCopyId}>
              <Copy className='size-4' aria-hidden='true' />
              {t('Copy ID')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleOpenInNewWindow}>
              <ExternalLink className='size-4' aria-hidden='true' />
              {t('Open in new window')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleExport}>
              <Download className='size-4' aria-hidden='true' />
              {t('Export')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRename}>
              <Pencil className='size-4' aria-hidden='true' />
              {t('Rename')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleArchive}>
              {session.archived ? (
                <ArchiveRestore className='size-4' aria-hidden='true' />
              ) : (
                <Archive className='size-4' aria-hidden='true' />
              )}
              {session.archived ? t('Restore') : t('Archive')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant='destructive' onClick={handleDelete}>
              <Trash2 className='size-4' aria-hidden='true' />
              {t('Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuSubItem>

      <Dialog open={renaming} onOpenChange={setRenaming}>
        <DialogContent>
          <form onSubmit={submitRename} className='space-y-4'>
            <DialogHeader>
              <DialogTitle>{t('Rename session')}</DialogTitle>
            </DialogHeader>
            <Input
              aria-label={t('Session name')}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              value={renameValue}
            />
            <DialogFooter>
              <Button onClick={() => setRenaming(false)} type='button' variant='outline'>
                {t('Cancel')}
              </Button>
              <Button type='submit'>{t('Save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}

export function JilaiSkillsItem({ item }: { item: NavHermesJilaiSkills }) {
  const href = useLocation({ select: (l) => l.href })
  const { setOpenMobile } = useSidebar()

  const { data: skills = [] } = useQuery({
    queryKey: ['hermes-jilai-skills-sidebar'],
    queryFn: () => listHermesSkills(),
    select: (all) =>
      all.filter((s) => s.source === 'external' || s.ownerScope === 'external'),
    staleTime: 5 * 60 * 1000,
  })

  const skillUrl = (name: string) =>
    `/jilai-workspace?skill=${encodeURIComponent(name)}` as const

  return (
    <SidebarCollapsibleShell
      defaultOpen
      description={item.description}
      expandedContent={
        <>
          {skills.map((skill, idx) => (
            <JilaiSkillSubItem
              key={skill.name}
              skill={skill}
              url={skillUrl(skill.name)}
              href={href}
              onClose={() => setOpenMobile(false)}
              index={idx}
            />
          ))}
        </>
      }
      collapsedContent={
        <>
          <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {skills.map((skill) => {
            const url = skillUrl(skill.name)
            const subActive = checkIsActive(href, { url })
            const desc = skill.descriptionZh || skill.description
            return (
              <DropdownMenuItem
                key={skill.name}
                title={desc || (skill.displayName ?? skill.name)}
                render={
                  <Link
                    className={subActive ? 'bg-secondary' : ''}
                    onClick={() => setOpenMobile(false)}
                    to={url}
                  />
                }
              >
                <div className='flex flex-col gap-0.5'>
                  <span className='max-w-52 text-wrap'>
                    {skill.displayName || skill.name}
                  </span>
                  {desc && (
                    <span className='text-muted-foreground truncate max-w-52 text-xs'>
                      {desc}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            )
          })}
        </>
      }
      icon={item.icon}
      id='jilai-skills'
      isActive={skills.some((s) => checkIsActive(href, { url: skillUrl(s.name) }))}
      title={item.title}
    />
  )
}
