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
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import {
  Clapperboard,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { getStudioProjects } from './api'
import { StudioProjectDeleteDialog } from './components/studio-project-delete-dialog'
import { StudioProjectMutateDialog } from './components/studio-project-mutate-drawer'
import {
  PROJECT_STATUS_CONFIG,
  STUDIO_QUERY_KEYS,
  type ProjectStatusValue,
} from './constants'
import type { StudioProject } from './types'

const route = getRouteApi('/_authenticated/studio/')

export function StudioProjectList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { action } = route.useSearch()
  const [deleteTarget, setDeleteTarget] = useState<StudioProject | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const { data, isLoading } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.projects],
    queryFn: () => getStudioProjects(),
  })

  const allProjects = data?.data?.items ?? []

  const filteredProjects = useMemo(() => {
    let result = allProjects
    if (statusFilter !== 'all') {
      const statusNum = Number(statusFilter)
      result = result.filter((p) => p.status === statusNum)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.brief && p.brief.toLowerCase().includes(q))
      )
    }
    return result
  }, [allProjects, statusFilter, searchQuery])

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-border flex items-center justify-between border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <Clapperboard
            className='text-rose-500 size-5'
            aria-hidden='true'
          />
          <h1 className='text-lg font-semibold'>{t('Film Studio')}</h1>
        </div>
        <Button
          size='sm'
          onClick={() => void navigate({ to: '/studio', search: { action: 'create' } })}
        >
          <FolderPlus className='mr-1.5 size-4' aria-hidden='true' />
          {t('New Project')}
        </Button>
      </div>

      {/* Search & filter bar */}
      {allProjects.length > 0 ? (
        <div className='border-border flex items-center gap-3 border-b px-6 py-3'>
          <div className='relative flex-1'>
            <Search className='text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2' />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('Search projects...')}
              className='h-8 pl-9 text-sm'
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className='h-8 w-36 text-sm'>
              <SelectValue placeholder={t('All Statuses')} />
            </SelectTrigger>
            <SelectContent alignItemWithTrigger={false}>
              <SelectItem value='all'>{t('All Statuses')}</SelectItem>
              {(
                Object.entries(PROJECT_STATUS_CONFIG) as [
                  string,
                  (typeof PROJECT_STATUS_CONFIG)[ProjectStatusValue],
                ][]
              ).map(([value, config]) => (
                <SelectItem key={value} value={value}>
                  {t(config.labelKey)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {/* Project grid */}
      <ScrollArea className='flex-1'>
        {isLoading ? (
          <div className='flex h-64 items-center justify-center'>
            <p className='text-muted-foreground text-sm'>
              {t('Loading...')}
            </p>
          </div>
        ) : allProjects.length === 0 ? (
          <div className='flex h-64 flex-col items-center justify-center gap-4'>
            <Clapperboard
              className='text-muted-foreground/40 size-12'
              aria-hidden='true'
            />
            <p className='text-muted-foreground text-sm'>
              {t('No projects yet. Create your first film project!')}
            </p>
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className='flex h-64 items-center justify-center'>
            <p className='text-muted-foreground text-sm'>
              {t('No matching projects.')}
            </p>
          </div>
        ) : (
          <div className='grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3'>
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onDeleteClick={setDeleteTarget}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create/Edit dialog */}
      <StudioProjectMutateDialog
        open={action === 'create'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            void navigate({ to: '/studio', search: {} })
          }
        }}
      />

      {/* Delete confirmation dialog */}
      <StudioProjectDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeleteTarget(null)
        }}
        project={deleteTarget}
      />
    </div>
  )
}

function ProjectCard(props: {
  project: StudioProject
  onDeleteClick: (project: StudioProject) => void
}) {
  const { t } = useTranslation()
  const { project, onDeleteClick } = props

  const statusConfig =
    PROJECT_STATUS_CONFIG[project.status as ProjectStatusValue]
  const stageTotal = project.stage_total ?? 0
  const stageDone = project.stage_done ?? 0
  const progressPercent = stageTotal > 0 ? Math.round((stageDone / stageTotal) * 100) : 0

  return (
    <Link
      to='/studio/$projectId'
      params={{ projectId: String(project.id) }}
      className='border-border bg-card hover:bg-accent/50 group relative flex flex-col rounded-lg border p-4 transition-colors'
    >
      {/* Cover image or placeholder */}
      {project.cover_url ? (
        <img
          src={project.cover_url}
          alt={project.name}
          className='mb-3 h-32 w-full rounded object-cover'
        />
      ) : (
        <div className='bg-muted mb-3 flex h-32 w-full items-center justify-center rounded'>
          <Clapperboard
            className='text-muted-foreground/30 size-8'
            aria-hidden='true'
          />
        </div>
      )}

      {/* Title + actions */}
      <div className='flex items-start justify-between gap-2'>
        <h3 className='line-clamp-1 text-sm font-medium'>{project.name}</h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='size-7 shrink-0 opacity-0 group-hover:opacity-100'
              onClick={(e) => e.preventDefault()}
              aria-label={t('More actions')}
            >
              <MoreHorizontal className='size-4' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem asChild>
              <Link
                to='/studio/$projectId'
                params={{ projectId: String(project.id) }}
              >
                <Pencil className='mr-2 size-4' />
                {t('Open')}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem
              className='text-destructive'
              onClick={(e) => {
                e.preventDefault()
                onDeleteClick(project)
              }}
            >
              <Trash2 className='mr-2 size-4' />
              {t('Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Brief */}
      {project.brief ? (
        <p className='text-muted-foreground mt-1 line-clamp-2 text-xs'>
          {project.brief}
        </p>
      ) : null}

      {/* Footer: status + stage progress */}
      <div className='mt-3 flex items-center justify-between text-xs'>
        {statusConfig ? (
          <span className='text-muted-foreground'>
            {t(statusConfig.labelKey)}
          </span>
        ) : null}
        {stageTotal > 0 ? (
          <span className='text-muted-foreground'>
            {t('Stages')}: {stageDone}/{stageTotal}
          </span>
        ) : null}
      </div>

      {/* Progress bar */}
      {stageTotal > 0 ? (
        <div
          className='bg-muted mt-2 h-1 w-full overflow-hidden rounded-full'
          title={`${progressPercent}%`}
        >
          <div
            className='bg-primary h-full rounded-full transition-all'
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      ) : null}
    </Link>
  )
}
