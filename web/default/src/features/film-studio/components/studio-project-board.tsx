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
import { Link, useParams } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  Pencil,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'

import { getStudioProject } from '../api'
import {
  PIPELINE_STAGES,
  STAGE_STATUS,
  STAGE_STATUS_CONFIG,
  STUDIO_QUERY_KEYS,
  type StageStatusValue,
} from '../constants'
import { useUpdateStudioStage } from '../hooks/use-studio-mutations'
import type { StudioStage } from '../types'
import { StudioProjectMutateDrawer } from './studio-project-mutate-drawer'

export function StudioProjectBoard() {
  const { t } = useTranslation()
  const { projectId } = useParams({
    from: '/_authenticated/studio/$projectId/',
  })
  const id = Number(projectId)
  const [editOpen, setEditOpen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.project(id)],
    queryFn: () => getStudioProject(id),
    enabled: id > 0,
  })

  const updateStage = useUpdateStudioStage(id)

  const project = data?.data
  const stages = project?.stages ?? []

  if (isLoading) {
    return (
      <div className='flex h-64 items-center justify-center'>
        <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className='flex h-64 flex-col items-center justify-center gap-2'>
        <p className='text-muted-foreground text-sm'>
          {t('Project not found.')}
        </p>
        <Button variant='ghost' size='sm' asChild>
          <Link to='/studio'>{t('Back to projects')}</Link>
        </Button>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-border flex items-center gap-3 border-b px-6 py-4'>
        <Button variant='ghost' size='icon' className='size-8' asChild>
          <Link to='/studio'>
            <ArrowLeft className='size-4' />
          </Link>
        </Button>
        <div className='min-w-0 flex-1'>
          <h1 className='truncate text-lg font-semibold'>{project.name}</h1>
          {project.brief ? (
            <p className='text-muted-foreground truncate text-xs'>
              {project.brief}
            </p>
          ) : null}
        </div>
        <Button
          variant='ghost'
          size='icon'
          className='size-8'
          onClick={() => setEditOpen(true)}
          aria-label={t('Edit Project')}
        >
          <Pencil className='size-4' />
        </Button>
      </div>

      {/* Pipeline board */}
      <ScrollArea className='flex-1'>
        <div className='grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {PIPELINE_STAGES.map((stageConfig) => {
            const stage = stages.find((s) => s.key === stageConfig.key)
            return (
              <StageCard
                key={stageConfig.key}
                projectId={id}
                stageConfig={stageConfig}
                stage={stage}
                onStatusChange={(newStatus) => {
                  updateStage.mutate({
                    key: stageConfig.key,
                    data: { status: newStatus },
                  })
                }}
              />
            )
          })}
        </div>
      </ScrollArea>

      {/* Edit project drawer */}
      <StudioProjectMutateDrawer
        open={editOpen}
        onOpenChange={setEditOpen}
        currentRow={project}
      />
    </div>
  )
}

function StageCard(props: {
  projectId: number
  stageConfig: (typeof PIPELINE_STAGES)[number]
  stage?: StudioStage
  onStatusChange: (status: number) => void
}) {
  const { t } = useTranslation()
  const { projectId, stageConfig, stage, onStatusChange } = props
  const status = (stage?.status ?? STAGE_STATUS.NOT_STARTED) as StageStatusValue
  const statusConfig = STAGE_STATUS_CONFIG[status]

  const StatusIcon = getStageStatusIcon(status)

  return (
    <Link
      to='/studio/$projectId/$stageKey'
      params={{
        projectId: String(projectId),
        stageKey: stageConfig.key,
      }}
      className='border-border bg-card hover:bg-accent/50 flex flex-col rounded-lg border p-4 transition-colors'
    >
      {/* Stage header */}
      <div className='flex items-center gap-2'>
        <span className='text-lg' aria-hidden='true'>
          {stageConfig.icon}
        </span>
        <h3 className='text-sm font-medium'>{t(stageConfig.labelKey)}</h3>
      </div>

      {/* Description */}
      <p className='text-muted-foreground mt-1.5 text-xs'>
        {t(stageConfig.descriptionKey)}
      </p>

      {/* Status + progress */}
      <div className='mt-3 flex items-center gap-1.5 text-xs'>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type='button'
              className='hover:bg-accent flex items-center gap-1.5 rounded px-1.5 py-0.5 transition-colors'
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
              }}
            >
              <StatusIcon className='size-3.5' aria-hidden='true' />
              <span className='text-muted-foreground'>
                {t(statusConfig?.labelKey ?? 'Not Started')}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align='start'
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
            }}
          >
            {(
              Object.entries(STAGE_STATUS_CONFIG) as [
                string,
                (typeof STAGE_STATUS_CONFIG)[StageStatusValue],
              ][]
            ).map(([value, config]) => {
              const numValue = Number(value)
              const ItemIcon = getStageStatusIcon(numValue as StageStatusValue)
              return (
                <DropdownMenuItem
                  key={value}
                  disabled={numValue === status}
                  onClick={() => onStatusChange(numValue)}
                >
                  <ItemIcon className='mr-2 size-3.5' />
                  {t(config.labelKey)}
                </DropdownMenuItem>
              )
            })}
          </DropdownMenuContent>
        </DropdownMenu>
        {stage && stage.total_items > 0 ? (
          <span className='text-muted-foreground ml-auto'>
            {stage.done_items}/{stage.total_items}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

function getStageStatusIcon(status: StageStatusValue) {
  switch (status) {
    case STAGE_STATUS.COMPLETED:
      return CheckCircle2
    case STAGE_STATUS.IN_PROGRESS:
      return Clock
    case STAGE_STATUS.NEEDS_REVISION:
      return AlertTriangle
    default:
      return Circle
  }
}
