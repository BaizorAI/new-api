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
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useTranslation } from 'react-i18next'

import {
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { useLayout } from '@/context/layout-provider'
import { listTeams } from '@/features/teams/api'
import type { Team } from '@/features/teams/types'
import { useSidebarView } from '@/hooks/use-sidebar-view'
import { MOTION_TRANSITION } from '@/lib/motion'
import { cn } from '@/lib/utils'

import type { NavGroup } from '../types'
import { NavGroup as ProductMenuGroup } from './nav-group'
import { SidebarViewHeader } from './sidebar-view-header'

const PRODUCT_RAIL_WIDTH = '3.5rem'

/**
 * Three-column workspace sidebar.
 *
 * Column 1 is a fixed product icon rail. Column 2 is the flat menu for the
 * current product. Column 3 is the route content rendered by the layout inset.
 */
export function AppSidebar() {
  const { collapsible, variant } = useLayout()
  const { key, view, navGroups, rootNavGroups } = useSidebarView()
  const href = useLocation({ select: (location) => location.href })
  const pathname = useLocation({ select: (location) => location.pathname })
  const shouldReduce = useReducedMotion()
  const activeRootGroup = resolveActiveRootGroup(rootNavGroups, href, pathname)
  let menuGroups: NavGroup[] = []
  if (view) {
    menuGroups = navGroups
  } else if (activeRootGroup) {
    menuGroups = [activeRootGroup]
  }

  return (
    <Sidebar collapsible={collapsible} variant={variant}>
      <SidebarContent className='overflow-hidden p-0'>
        <div
          className='grid h-full min-h-0 grid-cols-[var(--product-rail-width)_minmax(0,1fr)] group-data-[collapsible=icon]:grid-cols-[var(--product-rail-width)]'
          style={
            {
              '--product-rail-width': PRODUCT_RAIL_WIDTH,
            } as React.CSSProperties
          }
        >
          <ProductRail
            activeGroup={activeRootGroup}
            navGroups={rootNavGroups}
          />

          <div className='border-sidebar-border flex min-h-0 min-w-0 flex-col border-l group-data-[collapsible=icon]:hidden'>
            {view ? <SidebarViewHeader view={view} /> : null}
            <AnimatePresence mode='wait' initial={false}>
              <motion.div
                key={view ? key : activeRootGroup?.id || key}
                initial={shouldReduce ? false : { opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                exit={shouldReduce ? undefined : { opacity: 0 }}
                transition={MOTION_TRANSITION.fast}
                className='flex min-h-0 flex-1 flex-col'
              >
                <div className='min-h-0 flex-1 overflow-auto py-2'>
                  {menuGroups.map((props) => (
                    <ProductMenuGroup
                      key={props.id || props.title}
                      {...props}
                    />
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}

function ProductRail(props: { activeGroup?: NavGroup; navGroups: NavGroup[] }) {
  const { t } = useTranslation()
  const [topNavGroups, bottomNavGroups] = splitProductGroups(props.navGroups)

  return (
    <nav
      aria-label={t('Product navigation')}
      className='bg-sidebar flex min-h-0 flex-col items-center gap-1 overflow-hidden py-2'
    >
      <SidebarMenu className='no-scrollbar min-h-0 flex-1 items-center gap-1 overflow-y-auto px-1'>
        {topNavGroups.map((group) => (
          <ProductRailItem
            key={group.id || group.title}
            group={group}
            isActive={props.activeGroup?.id === group.id}
          />
        ))}
      </SidebarMenu>

      {bottomNavGroups.length > 0 ? (
        <SidebarMenu className='shrink-0 items-center gap-1 border-t px-1 pt-2'>
          {bottomNavGroups.map((group) => (
            <ProductRailItem
              key={group.id || group.title}
              group={group}
              isActive={props.activeGroup?.id === group.id}
            />
          ))}
        </SidebarMenu>
      ) : null}
    </nav>
  )
}

function ProductRailItem(props: { group: NavGroup; isActive: boolean }) {
  const { isMobile, setOpen, setOpenMobile } = useSidebar()
  const { data: teamsResponse } = useQuery({
    queryKey: ['sidebar', 'team-workspaces'],
    queryFn: listTeams,
    enabled: props.group.id === 'team-collaboration',
  })
  const destination = getProductDestination(
    props.group,
    teamsResponse?.success ? (teamsResponse.data ?? []) : []
  )
  const Icon = props.group.icon
  const label = props.group.description ?? props.group.title

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={props.isActive}
        title={label}
        tooltip={label}
        className={cn(
          'size-10 justify-center rounded-lg p-0',
          props.isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
        )}
        render={
          <Link
            to={destination}
            onClick={() => {
              if (isMobile) {
                setOpenMobile(false)
                return
              }
              setOpen(true)
            }}
            aria-label={props.group.title}
            aria-current={props.isActive ? 'page' : undefined}
          />
        }
      >
        {Icon ? <Icon className={cn('size-5 shrink-0', !props.isActive && props.group.iconColor)} aria-hidden='true' /> : null}
        <span className='sr-only'>{props.group.title}</span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

function splitProductGroups(navGroups: NavGroup[]): [NavGroup[], NavGroup[]] {
  const topNavGroups = navGroups.filter((group) => group.position !== 'bottom')
  const bottomNavGroups = navGroups.filter(
    (group) => group.position === 'bottom'
  )
  return [topNavGroups, bottomNavGroups]
}

function getProductDestination(group: NavGroup, teams: Team[]): string {
  if (group.id === 'team-collaboration') {
    const firstTeam = teams[0]
    return firstTeam
      ? `/team-workspace?team_id=${encodeURIComponent(firstTeam.id)}`
      : '/teams'
  }

  if (typeof group.url === 'string') return group.url

  const firstLink = group.items.find(
    (item) => 'url' in item && typeof item.url === 'string'
  )
  if (firstLink && 'url' in firstLink && typeof firstLink.url === 'string') {
    return firstLink.url
  }

  return '/team-workspace'
}

function resolveActiveRootGroup(
  navGroups: NavGroup[],
  href: string,
  pathname: string
): NavGroup | undefined {
  const params = new URLSearchParams(href.split('?')[1]?.split('#')[0] ?? '')
  const panel = params.get('panel')
  const section = params.get('section')

  if (pathname === '/team-workspace') {
    if (panel === 'results') return findGroup(navGroups, 'team-collaboration')
    if (panel === 'messages') return findGroup(navGroups, 'settings')
    return params.has('team_id')
      ? findGroup(navGroups, 'team-collaboration')
      : findGroup(navGroups, 'overview')
  }

  if (pathname === '/teams') {
    return findGroup(navGroups, 'team-collaboration')
  }

  if (pathname === '/hermes-playground') {
    if (panel === 'results') return findGroup(navGroups, 'workbench')
    if (panel === 'messages') return findGroup(navGroups, 'settings')
    return findGroup(navGroups, 'workbench')
  }

  if (pathname === '/one-person-company') {
    return findGroup(navGroups, 'one-person-company')
  }

  if (pathname.startsWith('/blog-hall')) {
    return findGroup(navGroups, 'blog-hall')
  }

  if (pathname.startsWith('/studio') || pathname === '/image-playground' || pathname === '/video-playground' || pathname === '/asset-center' || pathname === '/swap-lab') {
    return findGroup(navGroups, 'film-studio')
  }

  if (pathname === '/jilai-workspace' || pathname === '/skill-workspace' || pathname === '/skill-editor') {
    return findGroup(navGroups, 'capability-skills')
  }

  if (pathname === '/toolset-detail' || pathname === '/tools-editor') {
    return findGroup(navGroups, 'capability-tools')
  }

  if (pathname === '/playground' || pathname.startsWith('/chat/')) {
    return findGroup(navGroups, 'personal-center')
  }

  if (
    pathname === '/profile' &&
    (section === 'account' ||
      section === 'security' ||
      section === 'preferences')
  ) {
    return findGroup(navGroups, 'settings')
  }

  if (
    pathname === '/profile' ||
    pathname.startsWith('/wallet') ||
    pathname === '/keys' ||
    pathname === '/pricing' ||
    pathname === '/my-usage-logs'
  ) {
    return findGroup(navGroups, 'personal-center')
  }

  if (pathname === '/docs') {
    return findGroup(navGroups, 'help-docs')
  }

  if (pathname.startsWith('/system-settings')) {
    return findGroup(navGroups, 'settings')
  }

  if (pathname === '/dashboard/models') {
    return findGroup(navGroups, 'settings')
  }

  if (
    pathname === '/online-status' ||
    pathname === '/channels' ||
    pathname === '/users' ||
    pathname === '/redemption-codes' ||
    pathname === '/subscriptions' ||
    pathname === '/system-info' ||
    pathname.startsWith('/dashboard') ||
    pathname.startsWith('/models') ||
    pathname.startsWith('/usage-logs')
  ) {
    return findGroup(navGroups, 'management')
  }

  return navGroups[0]
}

function findGroup(navGroups: NavGroup[], id: string): NavGroup | undefined {
  return navGroups.find((group) => group.id === id) ?? navGroups[0]
}
