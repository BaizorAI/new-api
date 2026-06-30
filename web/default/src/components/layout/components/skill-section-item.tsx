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
import { Fragment, useMemo } from 'react'
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import type { HermesSkill } from '@/features/hermes-playground/api'
import { listHermesSkills } from '@/features/hermes-playground/api'
import { listTeams } from '@/features/teams/api'
import type { Team } from '@/features/teams/types'
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
import type { NavHermesSkillSection } from '../types'
import { checkIsActive } from '../lib/url-utils'
import { SIDEBAR_NODE_COLORS } from '../constants'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

type TeamGroup = { team: Team; skills: HermesSkill[] }

function SkillSubItem({
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
  const subActive = checkIsActive(href, { url })
  const desc = skill.descriptionZh || skill.description
  const colorClass = SIDEBAR_NODE_COLORS[index % SIDEBAR_NODE_COLORS.length]
  return (
    <SidebarMenuSubItem key={skill.name}>
      <SidebarMenuSubButton
        isActive={subActive}
        title={desc || (skill.displayName ?? skill.name)}
        className={cn(desc && 'h-auto py-1.5', colorClass)}
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
    </SidebarMenuSubItem>
  )
}

export function SkillSectionItem({ item }: { item: NavHermesSkillSection }) {
  const href = useLocation({ select: (l) => l.href })
  const { setOpenMobile } = useSidebar()
  const isTeamSection = item.section === 'team'

  const teamsQuery = useQuery({
    queryKey: ['skill-section-teams'],
    queryFn: listTeams,
    enabled: isTeamSection,
    staleTime: 60_000,
  })
  const teams = teamsQuery.data?.success ? (teamsQuery.data.data ?? []) : []

  const teamSkillQueries = useQueries({
    queries: isTeamSection
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
    enabled: !isTeamSection,
    staleTime: 5 * 60 * 1000,
  })

  const teamGroups = useMemo<TeamGroup[]>(() => {
    if (!isTeamSection) return []
    return teams
      .map((team, i) => ({ team, skills: teamSkillQueries[i]?.data ?? [] }))
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

  const isActive = isTeamSection
    ? teamGroups.some(({ skills }) =>
        skills.some((s) =>
          checkIsActive(href, {
            url: `/skill-workspace?skill=${encodeURIComponent(s.name)}`,
          })
        )
      )
    : flatSkills.some((s) =>
        checkIsActive(href, {
          url: `/skill-workspace?skill=${encodeURIComponent(s.name)}`,
        })
      )

  const skillUrl = (name: string) =>
    `/skill-workspace?skill=${encodeURIComponent(name)}` as const

  const expandedTeamContent = (
    <>
      {teamGroups.map(({ team, skills }) => (
        <Fragment key={team.id}>
          <li className='text-muted-foreground/60 select-none px-2 pt-2 pb-0.5 text-[10px] font-semibold tracking-wider uppercase first:pt-1'>
            {team.name}
          </li>
          {skills.map((skill, idx) => (
            <SkillSubItem
              key={skill.name}
              skill={skill}
              url={skillUrl(skill.name)}
              href={href}
              onClose={() => setOpenMobile(false)}
              index={idx}
            />
          ))}
        </Fragment>
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
    </>
  )

  return (
    <SidebarCollapsibleShell
      defaultOpen={false}
      description={item.description}
      expandedContent={isTeamSection ? expandedTeamContent : expandedFlatContent}
      collapsedContent={
        isTeamSection ? collapsedTeamContent : collapsedFlatContent
      }
      icon={item.icon}
      id={`skill-section-${item.section}`}
      isActive={isActive}
      title={item.title}
    />
  )
}
