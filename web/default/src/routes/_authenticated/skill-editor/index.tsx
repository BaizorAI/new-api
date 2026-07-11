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
import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Suspense, lazy, useMemo, useState } from 'react'
import { z } from 'zod'
import {
  PackagePlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SparklesIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { listHermesSkills } from '@/features/hermes-playground/api'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Main } from '@/components/layout'
import { ScrollArea } from '@/components/ui/scroll-area'
import { notifyHermesSkillsChanged } from '@/features/hermes-playground/sessions'

const HermesSkillEditor = lazy(() =>
  import('@/features/hermes-playground/components/hermes-skill-editor').then(
    (m) => ({ default: m.HermesSkillEditor })
  )
)

const searchSchema = z.object({
  skill: z.string().optional().catch(undefined),
  team_id: z.number().optional().catch(undefined),
  create: z.string().optional().catch(undefined),
  section: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/skill-editor/')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'hermes_playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: SkillEditorPage,
})

function SkillEditorPage() {
  const { skill: skillName, team_id: teamId, create, section } = Route.useSearch()
  const navigate = Route.useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const { data: skills = [], isLoading } = useQuery({
    queryKey: ['skill-editor-page', 'skills', teamId],
    queryFn: () => listHermesSkills(teamId ? { teamId } : undefined),
    staleTime: 30_000,
  })

  const editSkill = useMemo(() => {
    if (!skillName) return null
    return skills.find((s) => s.name === skillName) ?? null
  }, [skillName, skills])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return skills
    return skills.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.displayName ?? '').toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    )
  }, [skills, search])

  const sectionFilter = useMemo(() => {
    if (section === 'mine') {
      return (s: typeof skills[number]) => s.isUserCreated || s.source === 'user' || s.ownerScope === 'user'
    }
    if (section === 'team') {
      return (s: typeof skills[number]) => s.source === 'team' || s.ownerScope === 'team'
    }
    if (section === 'baizor') {
      return (s: typeof skills[number]) => s.source === 'baizor' || s.ownerScope === 'baizor'
    }
    if (section === 'builtin') {
      return (s: typeof skills[number]) =>
        s.source !== 'user' && s.source !== 'team' && s.source !== 'baizor' && s.source !== 'external' &&
        s.ownerScope !== 'user' && s.ownerScope !== 'team' && s.ownerScope !== 'baizor' && s.ownerScope !== 'external'
    }
    return null
  }, [section])

  const sectionLabel = useMemo(() => {
    if (section === 'mine') return t('My skills')
    if (section === 'team') return t('Team skills')
    if (section === 'baizor') return t('Baizor Skills')
    if (section === 'builtin') return t('Built-in skills')
    return ''
  }, [section, t])

  const mySkills = useMemo(
    () => (sectionFilter ? filtered.filter(sectionFilter) : filtered),
    [filtered, sectionFilter],
  )

  // Overview mode: no skill and not creating
  const isOverview = !skillName && !create

  if (isOverview) {
    return (
      <Main className='flex min-h-[calc(100vh-var(--app-header-height,0px))] flex-col'>
        <header className='flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6'>
          <div>
            <h1 className='text-lg font-semibold'>{sectionLabel || t('Skills')}</h1>
            <p className='text-muted-foreground text-sm'>
              {sectionLabel ? t('Manage skills') : t('Manage your Hermes skills')}
            </p>
          </div>
          <div className='flex items-center gap-2'>
            <Button
              aria-label={t('Refresh')}
              onClick={() => {
                void queryClient.invalidateQueries({
                  queryKey: ['skill-editor-page', 'skills', teamId],
                })
              }}
              size='icon-sm'
              type='button'
              variant='ghost'
            >
              <RefreshCwIcon className='size-4' />
            </Button>
            <Link to='/skill-editor' search={{ create: '1', team_id: teamId }}>
              <Button size='sm' type='button'>
                <PackagePlusIcon className='size-4' />
                {t('Add skill')}
              </Button>
            </Link>
          </div>
        </header>

        <div className='border-b px-4 py-3'>
          <div className='relative'>
            <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
            <Input
              className='pl-8'
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t('Search skills')}
              value={search}
            />
          </div>
        </div>

        <ScrollArea className='min-h-0 flex-1'>
          <div className='max-w-2xl p-4'>
            {isLoading ? (
              <div className='space-y-2'>
                <Skeleton className='h-16 w-full' />
                <Skeleton className='h-16 w-full' />
                <Skeleton className='h-16 w-full' />
              </div>
            ) : mySkills.length === 0 ? (
              <div className='text-muted-foreground py-12 text-center'>
                <SparklesIcon className='mx-auto mb-3 size-8 opacity-30' />
                <p className='text-sm'>{t('No skills yet')}</p>
                <p className='mt-1 text-xs'>
                  {t('Create your first skill to get started.')}
                </p>
                <Link
                  className='mt-4 inline-block'
                  to='/skill-editor'
                  search={{ create: '1', team_id: teamId }}
                >
                  <Button size='sm' type='button' variant='outline'>
                    <PackagePlusIcon className='size-4' />
                    {t('Add skill')}
                  </Button>
                </Link>
              </div>
            ) : (
              <div className='space-y-2'>
                {mySkills.map((skill) => (
                  <Link
                    key={skill.name}
                    to='/skill-editor'
                    search={{ skill: skill.name, team_id: teamId }}
                  >
                    <div className='hover:bg-muted/60 flex items-center gap-3 rounded-lg border p-3 transition-colors cursor-pointer'>
                      <SparklesIcon className='text-amber-500 size-5 shrink-0' />
                      <div className='min-w-0 flex-1'>
                        <div className='text-sm font-medium'>
                          {skill.displayName || skill.name}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {skill.name}
                          {skill.category && ` · ${skill.category}`}
                        </div>
                        {(skill.descriptionZh || skill.description) && (
                          <div className='text-muted-foreground mt-0.5 line-clamp-2 text-xs'>
                            {skill.descriptionZh || skill.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </Main>
    )
  }

  // Create mode: /skill-editor?create=1
  // Edit mode: /skill-editor?skill=xxx
  return (
    <Suspense fallback={<div className="p-6"><Skeleton className="h-96 w-full max-w-2xl" /></div>}>
      <HermesSkillEditor
        editSkill={editSkill}
        teamId={teamId}
        onChanged={() => {
          void queryClient.invalidateQueries({
            queryKey: ['skill-editor-page', 'skills', teamId],
          })
          notifyHermesSkillsChanged()
        }}
        onCancel={() => {
          void navigate({ to: '/skill-editor' })
        }}
      />
    </Suspense>
  )
}
