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
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useQueries, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  MessageCircle,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Trash2,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { HermesSkill } from '@/features/hermes-playground/api'
import {
  deleteTeamHermesConversation,
  listHermesSkills,
  upsertTeamHermesConversation,
} from '@/features/hermes-playground/api'
import { listTeams } from '@/features/teams/api'
import type { Team } from '@/features/teams/types'
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
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import {
  HERMES_SESSIONS_CHANGED_EVENT,
  HERMES_SKILLS_CHANGED_EVENT,
  clearConversationStorage,
  createHermesConversation,
  formatSessionTime,
  getHermesBaseScope,
  loadActiveConversationId,
  notifyHermesSessionDeleted,
  peekHermesConversations,
  requestOpenHermesSkillDialog,
  saveActiveConversationId,
  saveHermesConversations,
  safeStorageScope,
} from '@/features/hermes-playground/sessions'
import type { NavHermesSkillSection } from '../types'
import { checkIsActive } from '../lib/url-utils'
import { SIDEBAR_NODE_COLORS } from '../constants'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

type TeamGroup = { team: Team; skills: HermesSkill[] }

const MAX_SIDEBAR_SESSIONS = 5

// Temporarily hide the Jilai Law Firm (external) skills from the sidebar
// library. Flip back to true to restore the "More skills" group.
const SHOW_JILAI_IN_LIBRARY = false

function SkillSubItem({
  skill,
  url,
  href,
  onClose,
  index,
  teamId,
  scopeName,
}: {
  skill: HermesSkill
  url: string
  href: string
  onClose: () => void
  index: number
  teamId?: number
  scopeName?: string
}) {
  const { t } = useTranslation()
  const userId = useAuthStore((state) => state.auth.user?.id)
  const isTeam = Boolean(teamId && teamId > 0)

  const baseScope = useMemo(() => {
    const safeName = safeStorageScope(skill.name)
    if (isTeam) {
      return `team_workspace_team_${teamId}_skill_${safeName}`
    }
    return getHermesBaseScope(userId, `${scopeName ?? 'skill'}_${safeName}`)
  }, [skill.name, teamId, userId, isTeam, scopeName])
  const subActive = checkIsActive(href, { url })
  const colorClass = SIDEBAR_NODE_COLORS[index % SIDEBAR_NODE_COLORS.length]
  const desc = skill.descriptionZh || skill.description

  // Fold state: auto-open when the user is on this skill's workspace.
  const [open, setOpen] = useState(subActive)

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
      setOpen(true)
    },
    [baseScope]
  )

  const reloadSessions = useCallback(() => {
    setSessions(peekHermesConversations(baseScope))
  }, [baseScope])

  return (
    <>
      <SidebarMenuSubItem className='group/skill-item flex items-stretch'>
        {/* Chevron toggle — independent from navigation */}
        <button
          type='button'
          aria-label={open ? t('Collapse') : t('Expand')}
          onClick={() => setOpen((v) => !v)}
          className='hover:text-foreground text-muted-foreground/60 ml-0.5 mr-0 shrink-0 self-center rounded p-0.5'
        >
          {open ? (
            <ChevronDown className='size-3' aria-hidden='true' />
          ) : (
            <ChevronRight className='size-3' aria-hidden='true' />
          )}
        </button>
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

      {open &&
        visibleSessions.map((session) => (
          <SkillSessionSubNode
            key={session.id}
            active={session.id === activeSessionId}
            baseScope={baseScope}
            isTeam={isTeam}
            session={session}
            teamId={teamId}
            url={url}
            onClose={onClose}
            onMutated={reloadSessions}
          />
        ))}
    </>
  )
}

function SkillSessionSubNode({
  active,
  baseScope,
  isTeam,
  session,
  teamId,
  url,
  onClose,
  onMutated,
}: {
  active: boolean
  baseScope: string
  isTeam: boolean
  session: ReturnType<typeof createHermesConversation>
  teamId?: number
  url: string
  onClose: () => void
  onMutated: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const refetch = useCallback(() => {
    onMutated()
  }, [onMutated])

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
    void upsertSkillConversation(isTeam, teamId, next.find((s) => s.id === session.id))
    refetch()
  }, [baseScope, isTeam, refetch, session, teamId])

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
    const payload = {
      exportedAt: new Date().toISOString(),
      session,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const downloadUrl = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = downloadUrl
    anchor.download =
      (session.title || session.id).replaceAll(/[<>:"/\\|?*]/g, '_') ||
      'session.json'
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
    (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const title = renameValue.trim()
      const all = peekHermesConversations(baseScope)
      const next = all.map((s) =>
        s.id === session.id
          ? { ...s, title, titleEdited: title !== '', updatedAt: Date.now() }
          : s
      )
      saveHermesConversations(baseScope, next)
      void upsertSkillConversation(isTeam, teamId, next.find((s) => s.id === session.id))
      refetch()
      setRenaming(false)
      setRenameValue('')
    },
    [baseScope, isTeam, refetch, renameValue, session.id, teamId]
  )

  const handleArchive = useCallback(() => {
    const all = peekHermesConversations(baseScope)
    const next = all.map((s) =>
      s.id === session.id
        ? { ...s, archived: !session.archived, pinned: session.archived ? session.pinned : false, updatedAt: Date.now() }
        : s
    )
    saveHermesConversations(baseScope, next)
    void upsertSkillConversation(isTeam, teamId, next.find((s) => s.id === session.id))
    refetch()
  }, [baseScope, isTeam, refetch, session, teamId])

  const handleDelete = useCallback(() => {
    clearConversationStorage(session)
    notifyHermesSessionDeleted(session.id)
    void deleteSkillConversation(isTeam, teamId, session.id)
    const all = peekHermesConversations(baseScope)
    const remaining = all.filter((s) => s.id !== session.id)
    if (remaining.length === 0) {
      const fresh = createHermesConversation(baseScope)
      saveHermesConversations(baseScope, [fresh])
    } else {
      saveHermesConversations(baseScope, remaining)
    }
    refetch()
  }, [baseScope, isTeam, refetch, session, teamId])

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
              <Button
                onClick={() => setRenaming(false)}
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
    </>
  )
}

async function upsertSkillConversation(
  isTeam: boolean,
  teamId: number | undefined,
  session: ReturnType<typeof createHermesConversation> | undefined
) {
  if (!isTeam || !teamId || !session) return
  void upsertTeamHermesConversation(teamId, {
    ...session,
    messages: [],
  }).catch(() => {})
}

async function deleteSkillConversation(
  isTeam: boolean,
  teamId: number | undefined,
  sessionId: string
) {
  if (!isTeam || !teamId) return
  void deleteTeamHermesConversation(teamId, sessionId).catch(() => {})
}

function TeamSkillGroup({
  team,
  skills,
  href,
  onClose,
}: {
  team: Team
  skills: HermesSkill[]
  href: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(true)

  const teamSkillUrl = (name: string) =>
    `/team-workspace?team_id=${team.id}&skill=${encodeURIComponent(name)}` as const

  return (
    <>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          className='text-muted-foreground/70 cursor-pointer'
          onClick={() => setOpen((v) => !v)}
        >
          {open ? (
            <ChevronDown className='size-3 shrink-0' aria-hidden='true' />
          ) : (
            <ChevronRight className='size-3 shrink-0' aria-hidden='true' />
          )}
          <span className='text-[11px] font-semibold tracking-wider uppercase'>
            {team.name}
          </span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      {open &&
        skills.map((skill, idx) => (
          <SkillSubItem
            key={skill.name}
            skill={skill}
            teamId={team.id}
            url={teamSkillUrl(skill.name)}
            href={href}
            onClose={onClose}
            index={idx}
          />
        ))}
      {open && (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton
            className='pl-7 text-muted-foreground cursor-pointer'
            onClick={() => {
              requestOpenHermesSkillDialog(team.id)
              onClose()
            }}
          >
            <PackagePlus className='size-3.5' aria-hidden='true' />
            <span>{t('Add skill')}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      )}
    </>
  )
}

function LibraryGroupLabel({ title }: { title: string }) {
  return (
    <SidebarMenuSubItem>
      <div className='text-muted-foreground/70 flex h-6 items-center px-2 text-[10px] font-semibold tracking-wider uppercase'>
        {title}
      </div>
    </SidebarMenuSubItem>
  )
}

export function SkillSectionItem({ item }: { item: NavHermesSkillSection }) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const href = useLocation({ select: (l) => l.href })
  const { setOpenMobile } = useSidebar()
  const isTeamSection = item.section === 'team'
  const isLibrary = item.section === 'library'
  const needsTeamSkills = isTeamSection

  // Re-fetch skills when a new skill is created via the Add-skill dialog.
  useEffect(() => {
    const handler = () => {
      if (needsTeamSkills) {
        void queryClient.invalidateQueries({
          queryKey: ['skill-section-team-skills'],
        })
      }
      if (!isTeamSection) {
        void queryClient.invalidateQueries({
          queryKey: ['hermes-skill-section-sidebar'],
        })
      }
    }
    window.addEventListener(HERMES_SKILLS_CHANGED_EVENT, handler)
    return () =>
      window.removeEventListener(HERMES_SKILLS_CHANGED_EVENT, handler)
  }, [isTeamSection, needsTeamSkills, queryClient])

  const teamsQuery = useQuery({
    queryKey: ['skill-section-teams'],
    queryFn: listTeams,
    enabled: needsTeamSkills,
    staleTime: 60_000,
  })
  const teams = teamsQuery.data?.success ? (teamsQuery.data.data ?? []) : []

  const teamSkillQueries = useQueries({
    queries: needsTeamSkills
      ? teams.map((team) => ({
          queryKey: ['skill-section-team-skills', team.id],
          queryFn: () => listHermesSkills({ teamId: team.id }).catch(() => []),
          staleTime: 5 * 60 * 1000,
        }))
      : [],
  })

  const singleQuery = useQuery({
    queryKey: ['hermes-skill-section-sidebar', item.section],
    queryFn: () => listHermesSkills(),
    enabled: !isTeamSection || isLibrary,
    staleTime: 5 * 60 * 1000,
  })

  const teamGroups = useMemo<TeamGroup[]>(() => {
    if (!isTeamSection) return []
    return teams
      .map((team, i) => ({
        team,
        skills: (teamSkillQueries[i]?.data ?? []).filter(
          (s) => s.ownerScope === 'team' || s.source === 'team'
        ),
      }))
      .filter((g) => g.skills.length > 0)
  }, [isTeamSection, teams, teamSkillQueries])

  const flatSkills = useMemo<HermesSkill[]>(() => {
    if (isTeamSection) return []
    const all = singleQuery.data ?? []
    if (item.section === 'mine') {
      return all.filter((s) => s.ownerScope === 'user' || s.source === 'user')
    }
    return all.filter((s) => s.ownerScope === 'baizor' || s.source === 'baizor')
  }, [isTeamSection, singleQuery.data, item.section])

  const libraryGroups = useMemo(() => {
    if (!isLibrary) return null
    const all = singleQuery.data ?? []
    return {
      mine: all.filter((s) => s.ownerScope === 'user' || s.source === 'user'),
      baizor: all.filter(
        (s) => s.ownerScope === 'baizor' || s.source === 'baizor'
      ),
      jilai: SHOW_JILAI_IN_LIBRARY
        ? all.filter(
            (s) => s.ownerScope === 'external' || s.source === 'external'
          )
        : [],
    }
  }, [isLibrary, singleQuery.data])

  const skillUrl = (name: string) =>
    `/skill-workspace?skill=${encodeURIComponent(name)}` as const

  const teamSkillUrl = (teamId: number, name: string) =>
    `/team-workspace?team_id=${teamId}&skill=${encodeURIComponent(name)}` as const

  const jilaiSkillUrl = (name: string) =>
    `/jilai-workspace?skill=${encodeURIComponent(name)}` as const

  const isActive = isLibrary
    ? Boolean(
        libraryGroups &&
          (libraryGroups.mine.some((s) =>
            checkIsActive(href, { url: skillUrl(s.name) })
          ) ||
            libraryGroups.baizor.some((s) =>
              checkIsActive(href, { url: skillUrl(s.name) })
            ) ||
            libraryGroups.jilai.some((s) =>
              checkIsActive(href, { url: jilaiSkillUrl(s.name) })
            ))
      )
    : isTeamSection
      ? teamGroups.some(({ team, skills }) =>
          skills.some((s) =>
            checkIsActive(href, {
              url: teamSkillUrl(team.id, s.name),
            })
          )
        )
      : flatSkills.some((s) =>
          checkIsActive(href, {
            url: skillUrl(s.name),
          })
        )

  const expandedTeamContent = (
    <>
      {teamGroups.map(({ team, skills }) => (
        <TeamSkillGroup
          key={team.id}
          team={team}
          skills={skills}
          href={href}
          onClose={() => setOpenMobile(false)}
        />
      ))}
    </>
  )

  const expandedFlatContent = (
    <>
      {flatSkills.map((skill, idx) => (
        <SkillSubItem
          key={skill.name}
          skill={skill}
          url={skillUrl(skill.name)}
          href={href}
          onClose={() => setOpenMobile(false)}
          index={idx}
        />
      ))}
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          className='text-muted-foreground cursor-pointer'
          onClick={() => {
            requestOpenHermesSkillDialog()
            setOpenMobile(false)
          }}
        >
          <PackagePlus className='size-3.5' aria-hidden='true' />
          <span>{t('Add skill')}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    </>
  )

  const collapsedTeamContent = (
    <>
      <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {teamGroups.map(({ team, skills }) => (
        <Fragment key={team.id}>
          <DropdownMenuLabel className='text-muted-foreground/60 text-[10px] font-semibold tracking-wider uppercase'>
            {team.name}
          </DropdownMenuLabel>
          {skills.map((skill) => {
            const url = teamSkillUrl(team.id, skill.name)
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
                    <span className='text-muted-foreground max-w-52 truncate text-xs'>
                      {desc}
                    </span>
                  )}
                </div>
              </DropdownMenuItem>
            )
          })}
          <DropdownMenuItem
            onClick={() => {
              requestOpenHermesSkillDialog(team.id)
              setOpenMobile(false)
            }}
          >
            <PackagePlus className='size-4' aria-hidden='true' />
            <span className='max-w-52 text-wrap'>{t('Add skill')}</span>
          </DropdownMenuItem>
        </Fragment>
      ))}
    </>
  )

  const collapsedFlatContent = (
    <>
      <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      {flatSkills.map((skill) => {
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
                <span className='text-muted-foreground max-w-52 truncate text-xs'>
                  {desc}
                </span>
              )}
            </div>
          </DropdownMenuItem>
        )
      })}
      <DropdownMenuItem
        onClick={() => {
          requestOpenHermesSkillDialog()
          setOpenMobile(false)
        }}
      >
        <PackagePlus className='size-4' aria-hidden='true' />
        <span className='max-w-52 text-wrap'>{t('Add skill')}</span>
      </DropdownMenuItem>
    </>
  )

  const expandedLibraryContent = libraryGroups ? (
    <>
      <LibraryGroupLabel title={t('My skills')} />
      {libraryGroups.mine.map((skill, idx) => (
        <SkillSubItem
          key={`mine-${skill.name}`}
          skill={skill}
          url={skillUrl(skill.name)}
          href={href}
          onClose={() => setOpenMobile(false)}
          index={idx}
        />
      ))}
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          className='text-muted-foreground cursor-pointer'
          onClick={() => {
            requestOpenHermesSkillDialog()
            setOpenMobile(false)
          }}
        >
          <PackagePlus className='size-3.5' aria-hidden='true' />
          <span>{t('Add skill')}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      {libraryGroups.jilai.length > 0 ? (
        <>
          <LibraryGroupLabel title={t('More skills')} />
          {libraryGroups.jilai.map((skill, idx) => (
            <SkillSubItem
              key={`jilai-${skill.name}`}
              skill={skill}
              url={jilaiSkillUrl(skill.name)}
              href={href}
              onClose={() => setOpenMobile(false)}
              index={idx}
              scopeName='jilai'
            />
          ))}
        </>
      ) : null}
    </>
  ) : null

  const renderCollapsedSkillLink = (
    key: string,
    url: string,
    label: string
  ) => {
    const subActive = checkIsActive(href, { url })
    return (
      <DropdownMenuItem
        key={key}
        render={
          <Link
            className={subActive ? 'bg-secondary' : ''}
            onClick={() => setOpenMobile(false)}
            to={url}
          />
        }
      >
        <span className='max-w-52 text-wrap'>{label}</span>
      </DropdownMenuItem>
    )
  }

  const collapsedLibraryContent = libraryGroups ? (
    <>
      <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className='text-muted-foreground/60 text-[10px] font-semibold tracking-wider uppercase'>
        {t('My skills')}
      </DropdownMenuLabel>
      {libraryGroups.mine.map((skill) =>
        renderCollapsedSkillLink(
          `mine-${skill.name}`,
          skillUrl(skill.name),
          skill.displayName || skill.name
        )
      )}
      <DropdownMenuItem
        onClick={() => {
          requestOpenHermesSkillDialog()
          setOpenMobile(false)
        }}
      >
        <PackagePlus className='size-4' aria-hidden='true' />
        <span className='max-w-52 text-wrap'>{t('Add skill')}</span>
      </DropdownMenuItem>
      {libraryGroups.jilai.length > 0 ? (
        <>
          <DropdownMenuLabel className='text-muted-foreground/60 text-[10px] font-semibold tracking-wider uppercase'>
            {t('More skills')}
          </DropdownMenuLabel>
          {libraryGroups.jilai.map((skill) =>
            renderCollapsedSkillLink(
              `jilai-${skill.name}`,
              jilaiSkillUrl(skill.name),
              skill.displayName || skill.name
            )
          )}
        </>
      ) : null}
    </>
  ) : null

  const expandedContent = isLibrary
    ? expandedLibraryContent
    : isTeamSection
      ? expandedTeamContent
      : expandedFlatContent
  const collapsedContent = isLibrary
    ? collapsedLibraryContent
    : isTeamSection
      ? collapsedTeamContent
      : collapsedFlatContent

  return (
    <SidebarCollapsibleShell
      defaultOpen={false}
      description={item.description}
      expandedContent={expandedContent}
      collapsedContent={collapsedContent}
      icon={item.icon}
      id={`skill-section-${item.section}`}
      isActive={isActive}
      title={item.title}
    />
  )
}
