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
  Sparkles,
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
      <SidebarTeamPanelItem
        key={`${team.id}-sessions`}
        href={props.href}
        team={team}
        panel='sessions'
        title={t('Sessions')}
        icon={MessageSquare}
        onNavigate={props.onNavigate}
      />,
      <SidebarTeamPanelItem
        key={`${team.id}-results`}
        href={props.href}
        team={team}
        panel='results'
        title={t('Results')}
        icon={FileCheck2}
        onNavigate={props.onNavigate}
      />,
      <SidebarTeamPanelItem
        key={`${team.id}-skills`}
        href={props.href}
        team={team}
        panel='skills'
        title={t('Skills')}
        icon={Sparkles}
        onNavigate={props.onNavigate}
      />,
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

function CollapsedTeamItems(props: {
  href: string
  isLoading: boolean
  teams: Team[]
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <DropdownMenuItem
        render={
          <Link
            to='/team-workspace'
            className={isTeamUrlActive(props.href) ? 'bg-secondary' : ''}
            onClick={props.onNavigate}
          />
        }
      >
        <Users className='size-4' aria-hidden='true' />
        {t('Team workspace')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <CollapsedTeamList {...props} />
    </>
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
    <CollapsedTeamPanelItem
      key={`${team.id}-sessions`}
      href={props.href}
      team={team}
      panel='sessions'
      title={t('Sessions')}
      icon={MessageSquare}
      onNavigate={props.onNavigate}
    />,
    <CollapsedTeamPanelItem
      key={`${team.id}-results`}
      href={props.href}
      team={team}
      panel='results'
      title={t('Results')}
      icon={FileCheck2}
      onNavigate={props.onNavigate}
    />,
    <CollapsedTeamPanelItem
      key={`${team.id}-skills`}
      href={props.href}
      team={team}
      panel='skills'
      title={t('Skills')}
      icon={Sparkles}
      onNavigate={props.onNavigate}
    />,
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
