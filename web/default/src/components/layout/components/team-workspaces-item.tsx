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
import { Building2, ChevronRight, Users } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { listTeams } from '@/features/teams/api'
import type { Team } from '@/features/teams/types'

import { normalizeHref } from '../lib/url-utils'
import type { NavTeamWorkspaces } from '../types'

export function TeamWorkspacesItem({ item }: { item: NavTeamWorkspaces }) {
  const { t } = useTranslation()
  const href = useLocation({ select: (location) => location.href })
  const { state, isMobile, setOpenMobile } = useSidebar()
  const { data: teamsResponse, isLoading } = useQuery({
    queryKey: ['sidebar', 'team-workspaces'],
    queryFn: listTeams,
  })

  const teams = useMemo<Team[]>(() => {
    if (!teamsResponse?.success) return []
    return teamsResponse.data ?? []
  }, [teamsResponse])

  const isActive = normalizeHref(href).startsWith('/team-workspace')
  const [isOpen, setIsOpen] = useState(() => isActive)

  useEffect(() => {
    if (isActive) setIsOpen(true)
  }, [isActive])

  if (state === 'collapsed' && !isMobile) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            className='group/dropdown-trigger'
            render={
              <SidebarMenuButton
                title={item.description ?? item.title}
                tooltip={item.description ?? item.title}
                isActive={isActive}
              />
            }
          >
            {item.icon ? (
              <item.icon className='shrink-0' />
            ) : (
              <Users className='shrink-0' />
            )}
            <span className='min-w-0 flex-1 truncate'>{item.title}</span>
            <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[popup-open]/dropdown-trigger:rotate-90' />
          </DropdownMenuTrigger>
          <DropdownMenuContent side='right' align='start' sideOffset={4}>
            <DropdownMenuGroup>
              <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                render={
                  <Link
                    to='/team-workspace'
                    className={isTeamUrlActive(href) ? 'bg-secondary' : ''}
                    onClick={() => setOpenMobile(false)}
                  />
                }
              >
                <Users className='size-4' />
                {t('Team workspace')}
              </DropdownMenuItem>
              <DropdownTeamItems
                href={href}
                isLoading={isLoading}
                teams={teams}
                onNavigate={() => setOpenMobile(false)}
              />
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className='group/collapsible'
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        className='group/collapsible-trigger'
        render={
          <SidebarMenuButton
            title={item.description ?? item.title}
            tooltip={item.description ?? item.title}
            isActive={isActive}
          />
        }
      >
        {item.icon ? (
          <item.icon className='shrink-0' />
        ) : (
          <Users className='shrink-0' />
        )}
        <span className='min-w-0 flex-1 truncate'>{item.title}</span>
        <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible-trigger:rotate-90' />
      </CollapsibleTrigger>
      <CollapsibleContent className='CollapsibleContent'>
        <SidebarMenuSub>
          <SidebarMenuSubItem>
            <SidebarMenuSubButton
              isActive={isTeamUrlActive(href)}
              render={
                <Link
                  to='/team-workspace'
                  onClick={() => setOpenMobile(false)}
                />
              }
            >
              <Users className='size-3.5' />
              <span>{t('Team workspace')}</span>
            </SidebarMenuSubButton>
          </SidebarMenuSubItem>
          <SidebarTeamItems
            href={href}
            isLoading={isLoading}
            teams={teams}
            onNavigate={() => setOpenMobile(false)}
          />
        </SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
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
      <SidebarMenuSubItem>
        <SidebarMenuSubButton aria-disabled='true'>
          <span>{t('Loading teams...')}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  if (props.teams.length === 0) {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton aria-disabled='true'>
          <span>{t('No teams yet')}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return props.teams.map((team) => (
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
        <Building2 className='size-3.5' />
        <span>{team.name}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  ))
}

function DropdownTeamItems(props: {
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

  return props.teams.map((team) => (
    <DropdownMenuItem
      key={team.id}
      render={
        <Link
          to='/team-workspace'
          search={{ team_id: team.id }}
          className={isTeamUrlActive(props.href, team.id) ? 'bg-secondary' : ''}
          onClick={props.onNavigate}
        />
      }
    >
      <Building2 className='size-4' />
      <span className='max-w-52 text-wrap'>{team.name}</span>
    </DropdownMenuItem>
  ))
}

function isTeamUrlActive(href: string, teamId?: number): boolean {
  if (normalizeHref(href) !== '/team-workspace') return false

  const search = href.split('?')[1] ?? ''
  const activeTeamId = new URLSearchParams(search).get('team_id')
  if (teamId === undefined) return !activeTeamId
  return activeTeamId === String(teamId)
}


