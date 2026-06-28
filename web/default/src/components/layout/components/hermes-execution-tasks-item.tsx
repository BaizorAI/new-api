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
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  XCircle,
} from 'lucide-react'
import { useMemo } from 'react'
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
import {
  listHermesExecutionTasks,
  type HermesExecutionTask,
  type HermesExecutionTaskStatus,
} from '@/features/hermes-playground/api'
import { useAuthStore } from '@/stores/auth-store'

import { normalizeHref } from '../lib/url-utils'
import type { NavHermesExecutionTasks } from '../types'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

export function HermesExecutionTasksItem(props: {
  item: NavHermesExecutionTasks
}) {
  const href = useLocation({ select: (location) => location.href })
  const pathname = useLocation({ select: (location) => location.pathname })
  const userId = useAuthStore((state) => state.auth.user?.id)
  const { isMobile, setOpenMobile, state } = useSidebar()
  const normalizedPathname = normalizeHref(pathname)
  const teamId = getActiveTeamId(href)
  const destination = getTasksDestination(normalizedPathname, teamId)
  const isActive = isTasksActive(href)
  const isWorkspace =
    normalizedPathname === '/hermes-playground' ||
    normalizedPathname === '/team-workspace'
  const shouldLoad = isWorkspace && (isMobile || state === 'expanded')

  const tasksQuery = useQuery({
    queryKey: [
      'sidebar',
      'hermes-execution-tasks',
      userId ?? 'anonymous',
      teamId ?? 'personal',
    ],
    queryFn: () => listHermesExecutionTasks({ teamId, limit: 5 }),
    enabled: shouldLoad,
    refetchInterval: shouldLoad ? 5000 : false,
  })

  const tasks = useMemo(
    () => (tasksQuery.data ?? []).slice(0, 5),
    [tasksQuery.data]
  )
  const handleNavigate = () => setOpenMobile(false)

  return (
    <SidebarCollapsibleShell
      id={`hermes-execution-tasks-${props.item.title}`}
      title={props.item.title}
      icon={props.item.icon}
      description={props.item.description}
      isActive={isActive}
      defaultOpen={isActive}
      expandedContent={
        <ExpandedTasks
          destination={destination}
          isLoading={tasksQuery.isLoading}
          tasks={tasks}
          onNavigate={handleNavigate}
        />
      }
      collapsedContent={
        <CollapsedTasks
          destination={destination}
          isLoading={tasksQuery.isLoading}
          tasks={tasks}
          title={props.item.title}
          onNavigate={handleNavigate}
        />
      }
    />
  )
}

function ExpandedTasks(props: {
  destination: string
  isLoading: boolean
  tasks: HermesExecutionTask[]
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          render={<Link to={props.destination} onClick={props.onNavigate} />}
        >
          <ExternalLink className='size-3.5' aria-hidden='true' />
          <span>{t('View all tasks')}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
      {props.isLoading ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton aria-disabled='true'>
            <Loader2 className='size-3.5 animate-spin' aria-hidden='true' />
            <span>{t('Loading tasks...')}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      {!props.isLoading && props.tasks.length === 0 ? (
        <SidebarMenuSubItem>
          <SidebarMenuSubButton aria-disabled='true'>
            <Clock3 className='size-3.5' aria-hidden='true' />
            <span>{t('No recent tasks')}</span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ) : null}
      {props.tasks.map((task) => (
        <SidebarMenuSubItem key={task.taskId}>
          <SidebarMenuSubButton
            render={<Link to={props.destination} onClick={props.onNavigate} />}
          >
            <TaskStatusIcon status={task.status} />
            <span className='min-w-0 flex-1 truncate'>
              {task.title || t('Hermes task')}
            </span>
            <span className='text-muted-foreground shrink-0 text-[11px]'>
              {task.progress}%
            </span>
          </SidebarMenuSubButton>
        </SidebarMenuSubItem>
      ))}
    </>
  )
}

function CollapsedTasks(props: {
  destination: string
  isLoading: boolean
  tasks: HermesExecutionTask[]
  title: string
  onNavigate: () => void
}) {
  const { t } = useTranslation()

  return (
    <>
      <DropdownMenuLabel>{props.title}</DropdownMenuLabel>
      <DropdownMenuItem
        render={<Link to={props.destination} onClick={props.onNavigate} />}
      >
        <ExternalLink className='size-4' aria-hidden='true' />
        {t('View all tasks')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {props.isLoading ? (
        <DropdownMenuItem disabled>
          <Loader2 className='size-4 animate-spin' aria-hidden='true' />
          {t('Loading tasks...')}
        </DropdownMenuItem>
      ) : null}
      {!props.isLoading && props.tasks.length === 0 ? (
        <DropdownMenuItem disabled>
          <Clock3 className='size-4' aria-hidden='true' />
          {t('No recent tasks')}
        </DropdownMenuItem>
      ) : null}
      {props.tasks.map((task) => (
        <DropdownMenuItem
          key={task.taskId}
          render={<Link to={props.destination} onClick={props.onNavigate} />}
        >
          <TaskStatusIcon status={task.status} />
          <span className='max-w-52 truncate'>
            {task.title || t('Hermes task')}
          </span>
          <span className='text-muted-foreground ms-auto text-xs'>
            {task.progress}%
          </span>
        </DropdownMenuItem>
      ))}
    </>
  )
}

function TaskStatusIcon(props: { status: HermesExecutionTaskStatus }) {
  if (props.status === 'succeeded') {
    return (
      <CheckCircle2
        className='size-3.5 shrink-0 text-emerald-600'
        aria-hidden='true'
      />
    )
  }
  if (props.status === 'failed' || props.status === 'canceled') {
    return (
      <XCircle className='text-destructive size-3.5 shrink-0' aria-hidden />
    )
  }
  return (
    <Loader2
      className='text-muted-foreground size-3.5 shrink-0 animate-spin'
      aria-hidden='true'
    />
  )
}

function getActiveTeamId(href: string): number | undefined {
  const params = new URLSearchParams(href.split('?')[1]?.split('#')[0] ?? '')
  const rawTeamId = params.get('team_id')
  if (!rawTeamId) return undefined
  const teamId = Number(rawTeamId)
  return Number.isFinite(teamId) && teamId > 0 ? teamId : undefined
}

function getTasksDestination(pathname: string, teamId: number | undefined) {
  if (pathname === '/team-workspace' && teamId) {
    return `/team-workspace?team_id=${encodeURIComponent(teamId)}&panel=tasks`
  }
  return '/hermes-playground?panel=tasks'
}

function isTasksActive(href: string): boolean {
  const pathname = normalizeHref(href)
  if (pathname !== '/hermes-playground' && pathname !== '/team-workspace') {
    return false
  }
  const params = new URLSearchParams(href.split('?')[1]?.split('#')[0] ?? '')
  return params.get('panel') === 'tasks'
}
