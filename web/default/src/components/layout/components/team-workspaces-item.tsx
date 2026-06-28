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
import { Link, useLocation } from '@tanstack/react-router'
import {
  Building2,
  FileCheck2,
  LayoutDashboard,
  MessageSquare,
  Settings,
  Sparkles,
  UserRound,
  Users,
} from 'lucide-react'
import { useMemo, type ElementType } from 'react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
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

type TeamWorkspacePanel = 'sessions' | 'results' | 'skills'
type TeamManagementArea = 'members' | 'settings'

const TEAM_PANEL_CONFIG: Array<{
  panel: TeamWorkspacePanel
  titleKey: string
  icon: ElementType
}> = [
  { panel: 'sessions', titleKey: 'Team sessions', icon: MessageSquare },
  { panel: 'results', titleKey: 'Team results', icon: FileCheck2 },
  { panel: 'skills', titleKey: 'Team skills', icon: Sparkles },
]

const TEAM_MANAGEMENT_CONFIG: Array<{
  area: TeamManagementArea
  titleKey: string
  icon: ElementType
}> = [
  { area: 'members', titleKey: 'Team members', icon: UserRound },
  { area: 'settings', titleKey: 'Team settings', icon: Settings },
]

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
            render={<Link to='/teams' onClick={props.onNavigate} />}
          >
            <Users className='size-4' aria-hidden='true' />
            <span>{t('Team Management')}</span>
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
        ...TEAM_PANEL_CONFIG.map((config) => (
          <SidebarTeamPanelItem
            key={`${team.id}-${config.panel}`}
            href={props.href}
            team={team}
            panel={config.panel}
            title={t(config.titleKey)}
            icon={config.icon}
            onNavigate={props.onNavigate}
          />
        )),
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
      ])}
    </>
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
      ...TEAM_PANEL_CONFIG.map((config) => (
        <SidebarTeamPanelItem
          key={`${team.id}-${config.panel}`}
          href={props.href}
          team={team}
          panel={config.panel}
          title={t(config.titleKey)}
          icon={config.icon}
          onNavigate={props.onNavigate}
        />
      )),
    ]),
  ]
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
    ...TEAM_PANEL_CONFIG.map((config) => (
      <CollapsedTeamPanelItem
        key={`${team.id}-${config.panel}`}
        href={props.href}
        team={team}
        panel={config.panel}
        title={t(config.titleKey)}
        icon={config.icon}
        onNavigate={props.onNavigate}
      />
    )),
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
