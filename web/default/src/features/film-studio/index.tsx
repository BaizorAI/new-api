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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { getRouteApi, Link, useNavigate } from '@tanstack/react-router'
import {
  Clapperboard,
  FolderPlus,
  MoreHorizontal,
  Pencil,
  Trash2,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { toast } from 'sonner'

import { deleteStudioProject, getStudioProjects } from './api'
import { StudioProjectMutateDrawer } from './components/studio-project-mutate-drawer'
import {
  PROJECT_STATUS_CONFIG,
  STUDIO_QUERY_KEYS,
  SUCCESS_MESSAGES,
  type ProjectStatusValue,
} from './constants'
import type { StudioProject } from './types'

const route = getRouteApi('/_authenticated/studio/')

export function StudioProjectList() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { action } = route.useSearch()
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.projects],
    queryFn: () => getStudioProjects(),
  })

  const projects = data?.data?.items ?? []

  const handleDelete = useCallback(
    async (id: number) => {
      setDeletingId(id)
      try {
        const res = await deleteStudioProject(id)
        if (res.success) {
          toast.success(t(SUCCESS_MESSAGES.PROJECT_DELETED))
          void queryClient.invalidateQueries({
            queryKey: [...STUDIO_QUERY_KEYS.projects],
          })
        }
      } finally {
        setDeletingId(null)
      }
    },
    [queryClient, t, toast]
  )

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

      {/* Project grid */}
      <ScrollArea className='flex-1'>
        {isLoading ? (
          <div className='flex h-64 items-center justify-center'>
            <p className='text-muted-foreground text-sm'>
              {t('Loading...')}
            </p>
          </div>
        ) : projects.length === 0 ? (
          <div className='flex h-64 flex-col items-center justify-center gap-4'>
            <Clapperboard
              className='text-muted-foreground/40 size-12'
              aria-hidden='true'
            />
            <p className='text-muted-foreground text-sm'>
              {t('No projects yet. Create your first film project!')}
            </p>
          </div>
        ) : (
          <div className='grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3'>
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                isDeleting={deletingId === project.id}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Create/Edit drawer */}
      <StudioProjectMutateDrawer
        open={action === 'create'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            void navigate({ to: '/studio', search: {} })
          }
        }}
      />
    </div>
  )
}

function ProjectCard(props: {
  project: StudioProject
  isDeleting: boolean
  onDelete: (id: number) => void
}) {
  const { t } = useTranslation()
  const { project, isDeleting, onDelete } = props

  const statusConfig =
    PROJECT_STATUS_CONFIG[project.status as ProjectStatusValue]
  const stageProgress =
    project.stage_total && project.stage_total > 0
      ? `${project.stage_done ?? 0}/${project.stage_total}`
      : null

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
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault()
                onDelete(project.id)
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
        {stageProgress ? (
          <span className='text-muted-foreground'>
            {t('Stages')}: {stageProgress}
          </span>
        ) : null}
      </div>
    </Link>
  )
}
