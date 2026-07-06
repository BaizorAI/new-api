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
import { Link, useLocation } from '@tanstack/react-router'
import type { ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'

import { checkIsActive } from '../lib/url-utils'
import type {
  NavChatPresets,
  NavCollapsible,
  NavHermesSessions,
  NavHermesExecutionTasks,
  NavHermesJilaiSkills,
  NavHermesSkillSection,
  NavPlaygroundSessions,
  NavTeamWorkspaces,
  NavBlogArticles,
  NavLink,
  NavGroup as NavGroupProps,
} from '../types'
import { BlogArticlesItem } from '@/features/blog-hall/components/blog-articles-sidebar-item'
import { ChatPresetsItem } from './chat-presets-item'
import { HermesExecutionTasksItem } from './hermes-execution-tasks-item'
import { HermesSessionsItem } from './hermes-sessions-item'
import { JilaiSkillsItem } from './jilai-skills-item'
import { PlaygroundSessionsItem } from './playground-sessions-item'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'
import { SkillSectionItem } from './skill-section-item'
import { TeamWorkspacesItem } from './team-workspaces-item'

/**
 * Sidebar navigation group component
 * Renders a group of navigation items, supporting regular links and collapsible submenus
 */
export function NavGroup({ title, items }: NavGroupProps) {
  const href = useLocation({ select: (location) => location.href })

  return (
    <SidebarGroup className='px-2 py-1'>
      <SidebarGroupLabel className='text-muted-foreground/70 px-2 text-[11px] font-medium tracking-wider uppercase'>
        {title}
      </SidebarGroupLabel>
      <SidebarMenu>
        {items.map((item) => {
          const key = `${item.title}-${item.url || item.type}`

          // Special handling: dynamic chat presets list
          if (item.type === 'chat-presets') {
            return <ChatPresetsItem key={key} item={item as NavChatPresets} />
          }

          if (item.type === 'blog-articles') {
            return <BlogArticlesItem key={key} item={item as NavBlogArticles} />
          }

          if (item.type === 'hermes-sessions') {
            return (
              <HermesSessionsItem key={key} item={item as NavHermesSessions} />
            )
          }

          if (item.type === 'hermes-execution-tasks') {
            return (
              <HermesExecutionTasksItem
                key={key}
                item={item as NavHermesExecutionTasks}
              />
            )
          }

          if (item.type === 'hermes-jilai-skills') {
            return (
              <JilaiSkillsItem
                key={key}
                item={item as NavHermesJilaiSkills}
              />
            )
          }

          if (item.type === 'hermes-skill-section') {
            return (
              <SkillSectionItem
                key={key}
                item={item as NavHermesSkillSection}
              />
            )
          }

          if (item.type === 'playground-sessions') {
            return (
              <PlaygroundSessionsItem
                key={key}
                item={item as NavPlaygroundSessions}
              />
            )
          }

          if (item.type === 'team-workspaces') {
            return (
              <TeamWorkspacesItem key={key} item={item as NavTeamWorkspaces} />
            )
          }

          // If no sub-items, render regular link
          if (!item.items) {
            return (
              <SidebarMenuLink key={key} item={item as NavLink} href={href} />
            )
          }

          // Render collapsible menu (desktop expanded/collapsed + mobile)
          return (
            <SidebarMenuCollapsible
              key={key}
              item={item as NavCollapsible}
              href={href}
            />
          )
        })}
      </SidebarMenu>
    </SidebarGroup>
  )
}

/**
 * Navigation badge component
 */
function NavBadge({ children }: { children: ReactNode }) {
  return <Badge className='shrink-0 px-1 py-0 text-xs'>{children}</Badge>
}

/**
 * Sidebar menu link item
 */
function SidebarMenuLink({ item, href }: { item: NavLink; href: string }) {
  const { setOpenMobile } = useSidebar()
  const isActive = checkIsActive(href, item)

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        title={item.description ?? item.title}
        tooltip={item.description ?? item.title}
        render={
          <Link
            to={item.url}
            onClick={() => setOpenMobile(false)}
            aria-current={isActive ? 'page' : undefined}
          />
        }
      >
        {item.icon && <item.icon className='shrink-0' aria-hidden='true' />}
        <span className='min-w-0 flex-1 truncate'>{item.title}</span>
        {item.badge && <NavBadge>{item.badge}</NavBadge>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  )
}

/**
 * Sidebar collapsible menu item.
 *
 * Uses SidebarCollapsibleShell so that the same item works in the
 * expanded sidebar (Collapsible), the collapsed sidebar (DropdownMenu),
 * and the mobile Sheet (Collapsible).
 */
function SidebarMenuCollapsible({
  item,
  href,
}: {
  item: NavCollapsible
  href: string
}) {
  const { setOpenMobile } = useSidebar()
  const isSubItemActive = checkIsActive(href, item)

  const id = `${item.title}-collapsible`

  return (
    <SidebarCollapsibleShell
      id={id}
      title={item.title}
      icon={item.icon}
      description={item.description}
      isActive={isSubItemActive}
      defaultOpen={isSubItemActive}
      expandedContent={
        <>
          {item.items.map((subItem) => {
            const subActive = checkIsActive(href, subItem)
            return (
              <SidebarMenuSubItem key={subItem.title}>
                <SidebarMenuSubButton
                  isActive={subActive}
                  render={
                    <Link
                      to={subItem.url}
                      onClick={() => setOpenMobile(false)}
                      aria-current={subActive ? 'page' : undefined}
                    />
                  }
                >
                  {subItem.icon && (
                    <subItem.icon className='shrink-0' aria-hidden='true' />
                  )}
                  <span className='min-w-0 flex-1 truncate'>
                    {subItem.title}
                  </span>
                  {subItem.badge && <NavBadge>{subItem.badge}</NavBadge>}
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            )
          })}
        </>
      }
      collapsedContent={
        <>
          <DropdownMenuLabel>
            {item.title} {item.badge ? `(${item.badge})` : ''}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          {item.items.map((sub) => {
            const subActive = checkIsActive(href, sub)
            return (
              <DropdownMenuItem
                key={`${sub.title}-${sub.url}`}
                render={
                  <Link
                    to={sub.url}
                    className={subActive ? 'bg-secondary' : ''}
                    onClick={() => setOpenMobile(false)}
                    aria-current={subActive ? 'page' : undefined}
                  />
                }
              >
                {sub.icon && <sub.icon aria-hidden='true' />}
                <span className='max-w-52 text-wrap'>{sub.title}</span>
                {sub.badge && (
                  <span className='ms-auto text-xs'>{sub.badge}</span>
                )}
              </DropdownMenuItem>
            )
          })}
        </>
      }
    />
  )
}
