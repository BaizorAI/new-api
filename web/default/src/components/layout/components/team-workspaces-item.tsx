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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  PackagePlus,
  Pencil,
  Pin,
  PinOff,
  Plus,
  Sparkles,
  Trash2,
  UserRound,
  Users,
  XCircle,
} from 'lucide-react'
import { useCallback, useMemo, useState, type ElementType, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  deleteTeamHermesConversation,
  listHermesExecutionTasks,
  listHermesSkills,
  listTeamHermesConversations,
  upsertTeamHermesConversation,
  type HermesExecutionTask,
  type HermesExecutionTaskStatus,
  type HermesSkill,
  type HermesTeamConversationRecord,
} from '@/features/hermes-playground/api'
import {
  activeConversationStorageKey,
  clearConversationStorage,
  createHermesConversation,
  formatSessionTime,
  loadActiveConversationId,
  peekHermesConversations,
  requestOpenHermesSkillDialog,
  saveActiveConversationId,
  saveHermesConversations,
  sortSessions,
} from '@/features/hermes-playground/sessions'
import { listTeams } from '@/features/teams/api'
import type { Team } from '@/features/teams/types'

import { normalizeHref } from '../lib/url-utils'
import type { NavTeamWorkspaces } from '../types'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

export function TeamWorkspacesItem({ item }: { item: NavTeamWorkspaces }) {
  const href = useLocation({ select: (location) => location.href })
  const { setOpenMobile } = useSidebar()
  const { data: teamsResponse, isLoading } = useQuery({
    queryKey: ['sidebar', 'team-workspaces'],
    queryFn: listTeams,
  })

  const teams = useMemo<Team[]>(() => {
    if (!teamsResponse?.success) return []
    return teamsResponse.data ?? []
  }, [teamsResponse])

  const isActive = normalizeHref(href).startsWith('/team-workspace')
  const handleNavigate = () => setOpenMobile(false)

  if (item.variant === 'flat') {
    return (
      <FlatTeamWorkspaceItems
        href={href}
        isLoading={isLoading}
        teams={teams}
        onNavigate={handleNavigate}
      />
    )
  }

  return (
    <SidebarCollapsibleShell
      id={`team-workspaces-${item.title}`}
      title={item.title}
      icon={item.icon ?? Users}
      description={item.description}
      isActive={isActive}
      defaultOpen
      expandedContent={
        <SidebarTeamItems
          href={href}
          isLoading={isLoading}
          teams={teams}
          onNavigate={handleNavigate}
        />
      }
      collapsedContent={
        <CollapsedTeamItems
          href={href}
          isLoading={isLoading}
          teams={teams}
          onNavigate={handleNavigate}
        />
      }
    />
  )
}

type TeamWorkspacePanel = 'sessions' | 'skills' | 'tasks'
type TeamManagementArea = 'members'

const TEAM_PANEL_CONFIG: Array<{
  panel: TeamWorkspacePanel
  titleKey: string
  icon: ElementType
}> = [
  { panel: 'sessions', titleKey: 'Team conversation', icon: MessageSquare },
  { panel: 'skills', titleKey: 'Team skills', icon: Sparkles },
  { panel: 'tasks', titleKey: 'Team tasks', icon: ListChecks },
]

const TEAM_LINK_PANEL_CONFIG = TEAM_PANEL_CONFIG.filter(
  (config) =>
    config.panel !== 'sessions' &&
    config.panel !== 'skills' &&
    config.panel !== 'tasks'
)

const TEAM_MANAGEMENT_CONFIG: Array<{
  area: TeamManagementArea
  titleKey: string
  icon: ElementType
}> = [{ area: 'members', titleKey: 'Team members', icon: UserRound }]

function FlatTeamWorkspaceItems(props: {
  href: string
  isLoading: boolean
  teams: Team[]
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  if (props.isLoading) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton aria-disabled='true'>
          <Users className='size-4' aria-hidden='true' />
          <span>{t('Loading teams...')}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    )
  }

  if (props.teams.length === 0) {
    return (
      <>
        <SidebarMenuItem>
          <SidebarMenuButton
            render={<Link to='/team-workspace' onClick={props.onNavigate} />}
          >
            <Users className='size-4' aria-hidden='true' />
            <span>{t('Create or join a team to collaborate')}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton aria-disabled='true'>
            <span>{t('No teams yet')}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </>
    )
  }

  return (
    <>
      {props.teams.flatMap((team) => [
        <SidebarMenuItem key={team.id}>
          <SidebarMenuButton
            isActive={isTeamUrlActive(props.href, team.id)}
            tooltip={team.name}
            render={
              <Link
                to='/team-workspace'
                search={{ team_id: team.id }}
                onClick={props.onNavigate}
              />
            }
          >
            <Building2 className='size-4' aria-hidden='true' />
            <span>{team.name}</span>
          </SidebarMenuButton>
        </SidebarMenuItem>,
        <FlatTeamSessionItems
          key={`${team.id}-sessions`}
          href={props.href}
          team={team}
          title={t('Team conversation')}
          onNavigate={props.onNavigate}
        />,
        <FlatTeamSkillItems
          key={`${team.id}-skills`}
          href={props.href}
          team={team}
          title={t('Team skills')}
          onNavigate={props.onNavigate}
        />,
        ...TEAM_LINK_PANEL_CONFIG.map((config) => (
          <FlatSidebarTeamPanelItem
            key={`${team.id}-${config.panel}`}
            href={props.href}
            team={team}
            panel={config.panel}
            title={t(config.titleKey)}
            icon={config.icon}
            onNavigate={props.onNavigate}
          />
        )),
        <FlatTeamTaskItems
          key={`${team.id}-tasks`}
          href={props.href}
          team={team}
          title={t('Team tasks')}
          onNavigate={props.onNavigate}
        />,
        ...TEAM_MANAGEMENT_CONFIG.map((config) => (
          <FlatSidebarTeamManagementItem
            key={`${team.id}-${config.area}`}
            href={props.href}
            team={team}
            area={config.area}
            title={t(config.titleKey)}
            icon={config.icon}
            onNavigate={props.onNavigate}
          />
        )),
      ])}
    </>
  )
}

function FlatTeamSessionItems(props: {
  href: string
  team: Team
  title: string
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sidebar', 'team-sessions', props.team.id],
    queryFn: () => listTeamHermesConversations(props.team.id),
  })
  const visibleSessions = useMemo<HermesTeamConversationRecord[]>(
    () =>
      sortSessions(
        sessions.filter((session) => !session.archived)
      ) as HermesTeamConversationRecord[],
    [sessions]
  )
  const baseScope = getTeamWorkspaceBaseScope(props.team.id)
  const activeSessionId =
    visibleSessions.length > 0
      ? loadActiveConversationId(baseScope, visibleSessions)
      : ''

  return (
    <>
      <FlatSidebarSectionLabel
        icon={MessageSquare}
        title={props.title}
        className='pl-6'
      />
      <FlatNewTeamSessionItem
        team={props.team}
        onNavigate={props.onNavigate}
      />
      {isLoading ? (
        <FlatSidebarMutedItem
          className='pl-9'
          icon={Loader2}
          iconClassName='animate-spin'
          title={t('Loading sessions...')}
        />
      ) : null}
      {!isLoading && visibleSessions.length === 0 ? (
        <FlatSidebarMutedItem
          className='pl-9'
          icon={Clock3}
          title={t('No team sessions yet')}
        />
      ) : null}
      {visibleSessions.map((session) => (
        <FlatTeamSessionItem
          key={session.id}
          active={isTeamSessionActive(
            props.href,
            props.team.id,
            activeSessionId,
            session.id
          )}
          baseScope={baseScope}
          session={session}
          team={props.team}
          onNavigate={props.onNavigate}
        />
      ))}
    </>
  )
}

function FlatTeamSessionItem(props: {
  active: boolean
  baseScope: string
  session: HermesTeamConversationRecord
  team: Team
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const title = props.session.title || t('New session')

  return (
    <SidebarMenuItem className='relative group/menu-parent'>
      <SidebarMenuButton
        className='pl-9'
        isActive={props.active}
        tooltip={title}
        render={
          <Link
            to='/team-workspace'
            search={{ team_id: props.team.id }}
            onClick={() => {
              saveActiveConversationId(props.baseScope, props.session.id)
              props.onNavigate()
            }}
          />
        }
      >
        <MessageSquare className='size-4' aria-hidden='true' />
        <span className='min-w-0 flex-1 truncate'>{title}</span>
        <span className='text-muted-foreground shrink-0 text-[10px]'>
          {formatSessionTime(props.session.updatedAt, t('Just now'))}
        </span>
      </SidebarMenuButton>
      <TeamSessionMenu
        baseScope={props.baseScope}
        session={props.session}
        team={props.team}
      />
    </SidebarMenuItem>
  )
}

function FlatTeamTaskItems(props: {
  href: string
  team: Team
  title: string
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const { data: rawTasks = [], isLoading } = useQuery({
    queryKey: ['sidebar', 'team-tasks', props.team.id],
    queryFn: () => listHermesExecutionTasks({ teamId: props.team.id, limit: 5 }),
    refetchInterval: 5000,
  })
  const tasks = useMemo(
    () => sortTeamTasksByPriority(rawTasks).slice(0, 5),
    [rawTasks]
  )
  const activeCount = useMemo(
    () =>
      rawTasks.filter(
        (task) => task.status === 'running' || task.status === 'queued'
      ).length,
    [rawTasks]
  )

  return (
    <>
      <FlatSidebarSectionLabel
        icon={ListChecks}
        title={props.title}
        className='pl-6'
        badge={activeCount > 0 ? activeCount : undefined}
      />
      <SidebarMenuItem>
        <SidebarMenuButton
          className='pl-9'
          render={
            <Link
              to='/team-workspace'
              search={{ team_id: props.team.id, panel: 'tasks' }}
              onClick={props.onNavigate}
            />
          }
        >
          <ExternalLink className='size-4' aria-hidden='true' />
          <span>{t('View all tasks')}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      {isLoading ? (
        <FlatSidebarMutedItem
          className='pl-9'
          icon={Loader2}
          iconClassName='animate-spin'
          title={t('Loading tasks...')}
        />
      ) : null}
      {!isLoading && tasks.length === 0 ? (
        <FlatSidebarMutedItem
          className='pl-9'
          icon={Clock3}
          title={t('No recent tasks')}
        />
      ) : null}
      {tasks.map((task) => (
        <FlatTeamTaskItem
          key={task.taskId}
          active={isTeamTaskActive(props.href, props.team.id, task)}
          task={task}
          team={props.team}
          onNavigate={props.onNavigate}
        />
      ))}
    </>
  )
}

function FlatTeamTaskItem(props: {
  active: boolean
  task: HermesExecutionTask
  team: Team
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const title = props.task.title || t('Hermes task')
  const baseScope = getTeamWorkspaceBaseScope(props.team.id)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className='pl-9'
        isActive={props.active}
        tooltip={title}
        render={
          <Link
            to='/team-workspace'
            search={{ team_id: props.team.id, panel: 'tasks' }}
            onClick={() => {
              if (props.task.conversationId) {
                saveActiveConversationId(baseScope, props.task.conversationId)
              }
              props.onNavigate()
            }}
          />
        }
      >
        <TaskStatusIcon status={props.task.status} />
        <span className='min-w-0 flex-1 truncate'>{title}</span>
        <span className='text-muted-foreground shrink-0 text-[10px]'>
          {props.task.progress}%
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function FlatTeamSkillItems(props: {
  href: string
  team: Team
  title: string
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const { data: rawSkills = [], isLoading } = useQuery({
    queryKey: ['sidebar', 'team-skills', props.team.id],
    queryFn: () => listHermesSkills({ teamId: props.team.id }).catch(() => []),
    staleTime: 5 * 60 * 1000,
  })
  const skills = useMemo(
    () =>
      rawSkills
        .filter((s) => s.ownerScope === 'team' || s.source === 'team')
        .slice(0, 8),
    [rawSkills]
  )

  return (
    <>
      <FlatSidebarSectionLabel
        icon={Sparkles}
        title={props.title}
        className='pl-6'
        badge={skills.length > 0 ? skills.length : undefined}
      />
      {isLoading ? (
        <FlatSidebarMutedItem
          className='pl-9'
          icon={Loader2}
          iconClassName='animate-spin'
          title={t('Loading skills...')}
        />
      ) : null}
      {!isLoading && skills.length === 0 ? (
        <FlatSidebarMutedItem
          className='pl-9'
          icon={Sparkles}
          title={t('No team skills yet')}
        />
      ) : null}
      {skills.map((skill) => (
        <FlatTeamSkillItem
          key={skill.name}
          active={isTeamSkillActive(props.href, props.team.id, skill.name)}
          skill={skill}
          team={props.team}
          onNavigate={props.onNavigate}
        />
      ))}
      <SidebarMenuItem>
        <SidebarMenuButton
          className='pl-9 text-muted-foreground'
          onClick={() => {
            requestOpenHermesSkillDialog(props.team.id)
            props.onNavigate()
          }}
        >
          <PackagePlus className='size-4' aria-hidden='true' />
          <span>{t('Add skill')}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  )
}

function FlatTeamSkillItem(props: {
  active: boolean
  skill: HermesSkill
  team: Team
  onNavigate: () => void
}) {
  const title = props.skill.displayName || props.skill.name
  const desc = props.skill.descriptionZh || props.skill.description

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className='pl-9'
        isActive={props.active}
        tooltip={desc || title}
        render={
          <Link
            to='/team-workspace'
            search={{ team_id: props.team.id, skill: props.skill.name }}
            onClick={props.onNavigate}
          />
        }
      >
        <Sparkles className='size-4' aria-hidden='true' />
        <span className='min-w-0 flex-1 truncate'>{title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function FlatSidebarSectionLabel(props: {
  icon: ElementType
  title: string
  className?: string
  badge?: number
}) {
  return (
    <SidebarMenuItem>
      <div
        className={`text-muted-foreground flex h-7 min-w-0 items-center gap-2 px-2 text-xs font-medium ${props.className ?? ''}`}
      >
        <props.icon className='size-3.5 shrink-0' aria-hidden='true' />
        <span className='truncate'>{props.title}</span>
        {props.badge ? (
          <SidebarMenuBadge className='ml-auto'>{props.badge}</SidebarMenuBadge>
        ) : null}
      </div>
    </SidebarMenuItem>
  )
}

function FlatSidebarMutedItem(props: {
  icon: ElementType
  title: string
  className?: string
  iconClassName?: string
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        aria-disabled='true'
        className={`text-muted-foreground ${props.className ?? ''}`}
      >
        <props.icon
          className={`size-4 ${props.iconClassName ?? ''}`}
          aria-hidden='true'
        />
        <span>{props.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function FlatSidebarTeamPanelItem(props: {
  href: string
  team: Team
  panel: TeamWorkspacePanel
  title: string
  icon: ElementType
  onNavigate: () => void
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className='pl-6'
        isActive={isTeamUrlActive(props.href, props.team.id, props.panel)}
        render={
          <Link
            to='/team-workspace'
            search={{ team_id: props.team.id, panel: props.panel }}
            onClick={props.onNavigate}
          />
        }
      >
        <props.icon className='size-4' aria-hidden='true' />
        <span>{props.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function FlatSidebarTeamManagementItem(props: {
  href: string
  team: Team
  area: TeamManagementArea
  title: string
  icon: ElementType
  onNavigate: () => void
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className='pl-6'
        isActive={isTeamManagementUrlActive(
          props.href,
          props.team.id,
          props.area
        )}
        render={
          <Link
            to='/teams'
            search={{ team_id: props.team.id, area: props.area }}
            onClick={props.onNavigate}
          />
        }
      >
        <props.icon className='size-4' aria-hidden='true' />
        <span>{props.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function SidebarTeamItems(props: {
  href: string
  isLoading: boolean
  teams: Team[]
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  if (props.isLoading) {
    return (
      <>
        <SidebarTeamOverviewItem
          href={props.href}
          onNavigate={props.onNavigate}
        />
        <SidebarMenuSubItem>
          <SidebarMenuSubButton aria-disabled='true'>
            <span>{t('Loading teams...')}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      </>
    )
  }

  if (props.teams.length === 0) {
    return (
      <>
        <SidebarTeamOverviewItem
          href={props.href}
          onNavigate={props.onNavigate}
        />
        <SidebarMenuSubItem>
          <SidebarMenuSubButton aria-disabled='true'>
            <span>{t('No teams yet')}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      </>
    )
  }

  return [
    <SidebarTeamOverviewItem
      key='team-workspace-overview'
      href={props.href}
      onNavigate={props.onNavigate}
    />,
    ...props.teams.flatMap((team) => [
      <SidebarMenuSubItem key={team.id}>
        <SidebarMenuSubButton
          isActive={isTeamUrlActive(props.href, team.id)}
          render={
            <Link
              to='/team-workspace'
              search={{ team_id: team.id }}
              onClick={props.onNavigate}
            />
          }
        >
          <Building2 className='size-3.5' aria-hidden='true' />
          <span>{team.name}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>,
      ...TEAM_PANEL_CONFIG.flatMap((config) => {
        if (config.panel === 'sessions') {
          return [
            <SidebarTeamPanelItem
              key={`${team.id}-${config.panel}`}
              href={props.href}
              team={team}
              panel={config.panel}
              title={t(config.titleKey)}
              icon={config.icon}
              onNavigate={props.onNavigate}
            />,
            <NewTeamSessionSubItem
              key={`${team.id}-new-session`}
              team={team}
              onNavigate={props.onNavigate}
            />,
            <SidebarTeamSessionItems
              key={`${team.id}-session-items`}
              href={props.href}
              team={team}
              onNavigate={props.onNavigate}
            />,
          ]
        }
        return [
          <SidebarTeamPanelItem
            key={`${team.id}-${config.panel}`}
            href={props.href}
            team={team}
            panel={config.panel}
            title={t(config.titleKey)}
            icon={config.icon}
            onNavigate={props.onNavigate}
          />,
        ]
      }),
      ...TEAM_MANAGEMENT_CONFIG.map((config) => (
        <SidebarTeamManagementItem
          key={`${team.id}-${config.area}`}
          href={props.href}
          team={team}
          area={config.area}
          title={t(config.titleKey)}
          icon={config.icon}
          onNavigate={props.onNavigate}
        />
      )),
    ]),
  ]
}

function SidebarTeamSessionItems(props: {
  href: string
  team: Team
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['sidebar', 'team-sessions', props.team.id],
    queryFn: () => listTeamHermesConversations(props.team.id),
  })
  const baseScope = getTeamWorkspaceBaseScope(props.team.id)
  const visible = useMemo<HermesTeamConversationRecord[]>(
    () =>
      sortSessions(
        sessions.filter((s) => !s.archived)
      ) as HermesTeamConversationRecord[],
    [sessions]
  )
  const activeId =
    visible.length > 0 ? loadActiveConversationId(baseScope, visible) : ''

  if (isLoading || visible.length === 0) return null

  return (
    <>
      {visible.map((session) => (
        <SidebarTeamSessionSubItem
          key={session.id}
          active={isTeamSessionActive(
            props.href,
            props.team.id,
            activeId,
            session.id
          )}
          baseScope={baseScope}
          session={session}
          team={props.team}
          onNavigate={props.onNavigate}
        />
      ))}
    </>
  )
}

function SidebarTeamSessionSubItem(props: {
  active: boolean
  baseScope: string
  session: HermesTeamConversationRecord
  team: Team
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const title = props.session.title || t('New session')

  return (
    <SidebarMenuSubItem className='relative group/menu-parent'>
      <SidebarMenuSubButton
        className='pl-9'
        isActive={props.active}
        onClick={() => {
          saveActiveConversationId(props.baseScope, props.session.id)
          props.onNavigate()
        }}
      >
        <MessageSquare className='size-3.5' aria-hidden='true' />
        <span className='min-w-0 flex-1 truncate text-xs'>{title}</span>
        <span className='text-muted-foreground shrink-0 text-[10px]'>
          {formatSessionTime(props.session.updatedAt, t('Just now'))}
        </span>
      </SidebarMenuSubButton>
      <TeamSessionMenu
        baseScope={props.baseScope}
        session={props.session}
        team={props.team}
      />
    </SidebarMenuSubItem>
  )
}

function TeamSessionMenu(props: {
  baseScope: string
  session: HermesTeamConversationRecord
  team: Team
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState('')

  const refetch = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['sidebar', 'team-sessions', props.team.id],
    })
  }, [queryClient, props.team.id])

  const handlePin = useCallback(() => {
    void upsertTeamHermesConversation(props.team.id, {
      ...props.session,
      pinned: !props.session.pinned,
      archived: props.session.pinned ? props.session.archived : false,
    }).then(refetch)
  }, [props.session, props.team.id, refetch])

  const handleCopyId = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(
        props.session.hermesSessionId || props.session.id
      )
      toast.success(t('Copied to clipboard'))
    } catch {
      toast.error(t('Copy failed'))
    }
  }, [props.session.hermesSessionId, props.session.id, t])

  const handleOpenInNewWindow = useCallback(() => {
    saveActiveConversationId(props.baseScope, props.session.id)
    window.open(
      `/team-workspace?team_id=${props.team.id}`,
      '_blank',
      'noopener,noreferrer'
    )
  }, [props.baseScope, props.session.id, props.team.id])

  const handleExport = useCallback(() => {
    const payload = {
      exportedAt: new Date().toISOString(),
      session: props.session,
    }
    downloadJson(payload, `${props.session.title || props.session.id}.json`)
    toast.success(t('Exported'))
  }, [props.session, t])

  const handleArchive = useCallback(() => {
    void upsertTeamHermesConversation(props.team.id, {
      ...props.session,
      archived: !props.session.archived,
      pinned: props.session.archived ? props.session.pinned : false,
    }).then(refetch)
  }, [props.session, props.team.id, refetch])

  const handleRename = useCallback(() => {
    setRenameValue(props.session.title)
    setRenaming(true)
    setMenuOpen(false)
  }, [props.session.title])

  const submitRename = useCallback(
    (e: FormEvent<HTMLFormElement>) => {
      e.preventDefault()
      const title = renameValue.trim()
      void upsertTeamHermesConversation(props.team.id, {
        ...props.session,
        title,
        titleEdited: title !== '',
      }).then(refetch)
      setRenaming(false)
      setRenameValue('')
    },
    [props.session, props.team.id, refetch, renameValue]
  )

  const handleDelete = useCallback(() => {
    clearConversationStorage(props.session)
    void deleteTeamHermesConversation(props.team.id, props.session.id).then(
      refetch
    )
  }, [props.session, props.team.id, refetch])

  return (
    <>
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
            {props.session.pinned ? (
              <PinOff className='size-4' aria-hidden='true' />
            ) : (
              <Pin className='size-4' aria-hidden='true' />
            )}
            {props.session.pinned ? t('Unpin') : t('Pin')}
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
            {props.session.archived ? (
              <ArchiveRestore className='size-4' aria-hidden='true' />
            ) : (
              <Archive className='size-4' aria-hidden='true' />
            )}
            {props.session.archived ? t('Restore') : t('Archive')}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant='destructive' onClick={handleDelete}>
            <Trash2 className='size-4' aria-hidden='true' />
            {t('Delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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

function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.replaceAll(/[<>:"/\\|?*]/g, '_') || 'session.json'
  anchor.click()
  URL.revokeObjectURL(url)
}

function SidebarTeamOverviewItem(props: {
  href: string
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        isActive={isTeamUrlActive(props.href)}
        render={<Link to='/team-workspace' onClick={props.onNavigate} />}
      >
        <LayoutDashboard className='size-3.5' aria-hidden='true' />
        <span>{t('Workspace overview')}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function SidebarTeamPanelItem(props: {
  href: string
  team: Team
  panel: TeamWorkspacePanel
  title: string
  icon: ElementType
  onNavigate: () => void
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        className='pl-7'
        isActive={isTeamUrlActive(props.href, props.team.id, props.panel)}
        render={
          <Link
            to='/team-workspace'
            search={{ team_id: props.team.id, panel: props.panel }}
            onClick={props.onNavigate}
          />
        }
      >
        <props.icon className='size-3.5' aria-hidden='true' />
        <span>{props.title}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function SidebarTeamManagementItem(props: {
  href: string
  team: Team
  area: TeamManagementArea
  title: string
  icon: ElementType
  onNavigate: () => void
}) {
  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        className='pl-7'
        isActive={isTeamManagementUrlActive(
          props.href,
          props.team.id,
          props.area
        )}
        render={
          <Link
            to='/teams'
            search={{ team_id: props.team.id, area: props.area }}
            onClick={props.onNavigate}
          />
        }
      >
        <props.icon className='size-3.5' aria-hidden='true' />
        <span>{props.title}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function CollapsedTeamItems(props: {
  href: string
  isLoading: boolean
  teams: Team[]
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  if (props.isLoading) {
    return <CollapsedTeamList {...props} />
  }

  return (
    <>
      <CollapsedTeamOverviewItem
        href={props.href}
        onNavigate={props.onNavigate}
        title={t('Workspaces')}
      />
      <DropdownMenuSeparator />
      <CollapsedTeamList {...props} />
    </>
  )
}

function CollapsedTeamOverviewItem(props: {
  href: string
  onNavigate: () => void
  title: string
}) {
  const isActive = isTeamUrlActive(props.href)

  return (
    <DropdownMenuItem
      render={
        <Link
          to='/team-workspace'
          className={isActive ? 'bg-secondary' : ''}
          onClick={props.onNavigate}
        />
      }
    >
      <Users className='size-4' aria-hidden='true' />
      {props.title}
    </DropdownMenuItem>
  )
}

function CollapsedTeamList(props: {
  href: string
  isLoading: boolean
  teams: Team[]
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  if (props.isLoading) {
    return (
      <DropdownMenuItem disabled>
        <span>{t('Loading teams...')}</span>
      </DropdownMenuItem>
    )
  }

  if (props.teams.length === 0) {
    return (
      <DropdownMenuItem disabled>
        <span>{t('No teams yet')}</span>
      </DropdownMenuItem>
    )
  }

  return props.teams.flatMap((team) => [
    <DropdownMenuLabel key={`${team.id}-label`}>{team.name}</DropdownMenuLabel>,
    ...TEAM_PANEL_CONFIG.flatMap((config) => [
      <CollapsedTeamPanelItem
        key={`${team.id}-${config.panel}`}
        href={props.href}
        team={team}
        panel={config.panel}
        title={t(config.titleKey)}
        icon={config.icon}
        onNavigate={props.onNavigate}
      />,
      ...(config.panel === 'sessions'
        ? [
            <CollapsedNewTeamSessionItem
              key={`${team.id}-new-session`}
              team={team}
              onNavigate={props.onNavigate}
            />,
          ]
        : []),
    ]),
    ...TEAM_MANAGEMENT_CONFIG.map((config) => (
      <CollapsedTeamManagementItem
        key={`${team.id}-${config.area}`}
        href={props.href}
        team={team}
        area={config.area}
        title={t(config.titleKey)}
        icon={config.icon}
        onNavigate={props.onNavigate}
      />
    )),
  ])
}

function CollapsedTeamPanelItem(props: {
  href: string
  team: Team
  panel: TeamWorkspacePanel
  title: string
  icon: ElementType
  onNavigate: () => void
}) {
  return (
    <DropdownMenuItem
      render={
        <Link
          to='/team-workspace'
          search={{ team_id: props.team.id, panel: props.panel }}
          className={
            isTeamUrlActive(props.href, props.team.id, props.panel)
              ? 'bg-secondary'
              : ''
          }
          onClick={props.onNavigate}
        />
      }
    >
      <props.icon className='size-4' aria-hidden='true' />
      <span className='max-w-52 text-wrap'>{props.title}</span>
    </DropdownMenuItem>
  )
}

function CollapsedTeamManagementItem(props: {
  href: string
  team: Team
  area: TeamManagementArea
  title: string
  icon: ElementType
  onNavigate: () => void
}) {
  return (
    <DropdownMenuItem
      render={
        <Link
          to='/teams'
          search={{ team_id: props.team.id, area: props.area }}
          className={
            isTeamManagementUrlActive(props.href, props.team.id, props.area)
              ? 'bg-secondary'
              : ''
          }
          onClick={props.onNavigate}
        />
      }
    >
      <props.icon className='size-4' aria-hidden='true' />
      <span className='max-w-52 text-wrap'>{props.title}</span>
    </DropdownMenuItem>
  )
}

function NewTeamSessionSubItem(props: {
  team: Team
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleCreate = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const baseScope = getTeamWorkspaceBaseScope(props.team.id)
      const newSession = createHermesConversation(baseScope)
      const existing = peekHermesConversations(baseScope)
      saveHermesConversations(baseScope, [newSession, ...existing])
      saveActiveConversationId(baseScope, newSession.id)
      // Persist to server immediately so the sidebar session list
      // picks up the new node on next re-fetch.
      void upsertTeamHermesConversation(props.team.id, {
        ...newSession,
        messages: [],
      })
      void queryClient.invalidateQueries({
        queryKey: ['sidebar', 'team-sessions', props.team.id],
      })
      props.onNavigate()
      void navigate({
        to: '/team-workspace',
        search: { team_id: props.team.id },
      })
    },
    [navigate, props, queryClient]
  )

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        className='pl-9 text-muted-foreground'
        onClick={handleCreate}
      >
        <Plus className='size-3.5' aria-hidden='true' />
        <span>{t('New session')}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function FlatNewTeamSessionItem(props: {
  team: Team
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleCreate = useCallback(() => {
    const baseScope = getTeamWorkspaceBaseScope(props.team.id)
    const newSession = createHermesConversation(baseScope)
    const existing = peekHermesConversations(baseScope)
    saveHermesConversations(baseScope, [newSession, ...existing])
    saveActiveConversationId(baseScope, newSession.id)
    void upsertTeamHermesConversation(props.team.id, {
      ...newSession,
      messages: [],
    })
    void queryClient.invalidateQueries({
      queryKey: ['sidebar', 'team-sessions', props.team.id],
    })
    props.onNavigate()
    void navigate({
      to: '/team-workspace',
      search: { team_id: props.team.id },
    })
  }, [navigate, props, queryClient])

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        className='text-muted-foreground pl-9'
        onClick={handleCreate}
      >
        <Plus className='size-4' aria-hidden='true' />
        <span>{t('New session')}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function CollapsedNewTeamSessionItem(props: {
  team: Team
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const handleCreate = useCallback(() => {
    const baseScope = getTeamWorkspaceBaseScope(props.team.id)
    const newSession = createHermesConversation(baseScope)
    const existing = peekHermesConversations(baseScope)
    saveHermesConversations(baseScope, [newSession, ...existing])
    saveActiveConversationId(baseScope, newSession.id)
    void upsertTeamHermesConversation(props.team.id, {
      ...newSession,
      messages: [],
    })
    void queryClient.invalidateQueries({
      queryKey: ['sidebar', 'team-sessions', props.team.id],
    })
    props.onNavigate()
    void navigate({
      to: '/team-workspace',
      search: { team_id: props.team.id },
    })
  }, [navigate, props, queryClient])

  return (
    <DropdownMenuItem onClick={handleCreate}>
      <Plus className='size-4' aria-hidden='true' />
      <span className='max-w-52 text-wrap'>{t('New session')}</span>
    </DropdownMenuItem>
  )
}

function isTeamUrlActive(
  href: string,
  teamId?: number,
  panel?: TeamWorkspacePanel
): boolean {
  if (normalizeHref(href) !== '/team-workspace') return false

  const search = href.split('?')[1] ?? ''
  const params = new URLSearchParams(search)
  const activeTeamId = params.get('team_id')
  const activePanel = params.get('panel')
  if (teamId === undefined) return !activeTeamId
  if (activeTeamId !== String(teamId)) return false
  if (panel === undefined) return !activePanel
  return activePanel === panel
}

function isTeamSessionActive(
  href: string,
  teamId: number,
  activeSessionId: string,
  sessionId: string
): boolean {
  if (!isTeamUrlActive(href, teamId)) return false
  return activeSessionId === sessionId
}

function isTeamTaskActive(
  href: string,
  teamId: number,
  task: HermesExecutionTask
): boolean {
  if (!isTeamUrlActive(href, teamId, 'tasks')) return false
  if (!task.conversationId) return false

  return getActiveTeamConversationId(teamId) === task.conversationId
}

function isTeamSkillActive(
  href: string,
  teamId: number,
  skillName: string
): boolean {
  if (normalizeHref(href) !== '/team-workspace') return false

  const search = href.split('?')[1] ?? ''
  const params = new URLSearchParams(search)
  if (params.get('team_id') !== String(teamId)) return false
  return params.get('skill') === skillName
}

function TaskStatusIcon(props: { status: HermesExecutionTaskStatus }) {
  if (props.status === 'succeeded') {
    return (
      <CheckCircle2
        className='size-4 shrink-0 text-emerald-600'
        aria-hidden='true'
      />
    )
  }
  if (props.status === 'failed' || props.status === 'canceled') {
    return <XCircle className='text-destructive size-4 shrink-0' aria-hidden />
  }
  return (
    <Loader2
      className='text-muted-foreground size-4 shrink-0 animate-spin'
      aria-hidden='true'
    />
  )
}

function sortTeamTasksByPriority(
  tasks: HermesExecutionTask[]
): HermesExecutionTask[] {
  const statusOrder: Record<HermesExecutionTaskStatus, number> = {
    queued: 0,
    running: 1,
    succeeded: 2,
    failed: 3,
    canceled: 4,
  }
  return [...tasks].sort((a, b) => {
    const orderDiff = statusOrder[a.status] - statusOrder[b.status]
    if (orderDiff !== 0) return orderDiff
    return (b.updatedAt ?? 0) - (a.updatedAt ?? 0)
  })
}

function getTeamWorkspaceBaseScope(teamId: number): string {
  return `team_workspace_team_${teamId}`
}

function getActiveTeamConversationId(teamId: number): string {
  try {
    return (
      localStorage.getItem(
        activeConversationStorageKey(getTeamWorkspaceBaseScope(teamId))
      ) ?? ''
    )
  } catch {
    return ''
  }
}

function isTeamManagementUrlActive(
  href: string,
  teamId: number,
  area: TeamManagementArea
): boolean {
  if (normalizeHref(href) !== '/teams') return false

  const search = href.split('?')[1] ?? ''
  const params = new URLSearchParams(search)
  return params.get('team_id') === String(teamId) && params.get('area') === area
}
