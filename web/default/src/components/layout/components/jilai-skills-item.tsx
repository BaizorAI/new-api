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
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'
import { listHermesSkills } from '@/features/hermes-playground/api'
import type { NavHermesJilaiSkills } from '../types'
import { checkIsActive } from '../lib/url-utils'
import { SIDEBAR_NODE_COLORS } from '../constants'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

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
          {skills.map((skill, idx) => {
            const url = skillUrl(skill.name)
            const subActive = checkIsActive(href, { url })
            const desc = skill.descriptionZh || skill.description
            const colorClass = SIDEBAR_NODE_COLORS[idx % SIDEBAR_NODE_COLORS.length]
            return (
              <SidebarMenuSubItem key={skill.name}>
                <SidebarMenuSubButton
                  isActive={subActive}
                  title={desc || (skill.displayName ?? skill.name)}
                  className={cn(desc && 'h-auto py-1.5', colorClass)}
                  render={
                    <Link
                      aria-current={subActive ? 'page' : undefined}
                      onClick={() => setOpenMobile(false)}
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
              </SidebarMenuSubItem>
            )
          })}
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
