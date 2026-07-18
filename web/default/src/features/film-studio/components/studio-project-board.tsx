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
  Lock,
  Pencil,
  Server,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { useAuthStore } from '@/stores/auth-store'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { SoftConversionBanner } from '@/components/soft-conversion-banner'

import { getStudioProject } from '../api'
import type { StudioStage } from '../types'
import {
  PIPELINE_STAGES,
  PROJECT_STATUS,
  STAGE_STATUS,
  STAGE_STATUS_CONFIG,
  STUDIO_QUERY_KEYS,
  type StageStatusValue,
} from '../constants'
import { StudioProjectMutateDialog } from './studio-project-mutate-drawer'
import {
  StudioVersionGuard,
  resolveStudioEdition,
} from './studio-version-guard'
import { LoraTrainingPanel } from './lora-training-panel'
import { ComputeDashboard } from './compute-dashboard'
import { PipelineProgressPanel } from './pipeline-progress-panel'
import { usePipelineOrchestrator } from '../hooks/use-pipeline-orchestrator'
import { StudioBreadcrumb } from './studio-breadcrumb'

export function StudioProjectBoard() {
  const { t } = useTranslation()
  const { projectId } = useParams({
    from: '/_authenticated/studio/$projectId/',
  })
  const id = Number(projectId)
  const [editOpen, setEditOpen] = useState(false)
  const [showEnterprise, setShowEnterprise] = useState(false)
  const [showPipeline, setShowPipeline] = useState(false)
  const edition = resolveStudioEdition(useAuthStore.getState().auth.user?.role ?? 0)
  const pipeline = usePipelineOrchestrator()

  const { data, isLoading } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.project(id)],
    queryFn: () => getStudioProject(id),
    enabled: id > 0,
  })

  const project = data?.data
  const stages = project?.stages ?? []

  // Build a set of completed stage keys for dependency checking
  const completedKeys = useMemo(() => {
    const keys = new Set<string>()
    for (const s of stages) {
      if (s.status === STAGE_STATUS.COMPLETED) {
        keys.add(s.key)
      }
    }
    return keys
  }, [stages])

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
      {/* Breadcrumb */}
      <StudioBreadcrumb items={[
        { label: t('Film Studio'), to: '/studio' },
        { label: project.name },
      ]} />
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
        {/* AI Auto-Pipeline toggle */}
        <Button
          variant='ghost'
          size='sm'
          className='h-8 text-xs'
          onClick={() => setShowPipeline((v) => !v)}
        >
          <Sparkles className='mr-1 size-3.5 text-purple-500' />
          {showPipeline ? t('Hide Pipeline') : t('AI Pipeline')}
        </Button>
        {edition === 'enterprise-pro' ? (
          <Button
            variant='ghost'
            size='sm'
            className='h-8 text-xs'
            onClick={() => setShowEnterprise((v) => !v)}
          >
            <Server className='mr-1 size-3.5' />
            {showEnterprise ? t('Hide panels') : t('Enterprise')}
          </Button>
        ) : null}
      </div>

      {/* Pipeline board */}
      <ScrollArea className='flex-1'>
        <div className='grid gap-3 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
          {PIPELINE_STAGES.map((stageConfig) => {
            const stage = stages.find((s) => s.key === stageConfig.key)
            const depsUnmet = stageConfig.dependencies.filter(
              (dep) => !completedKeys.has(dep)
            )
            return (
              <StageCard
                key={stageConfig.key}
                projectId={id}
                stageConfig={stageConfig}
                stage={stage}
                locked={depsUnmet.length > 0}
                unmetDeps={depsUnmet}
              />
            )
          })}
        </div>
      </ScrollArea>

      {/* Enterprise panels */}
      {edition === 'enterprise-pro' && showEnterprise ? (
        <div className='flex gap-0 border-t'>
          <LoraTrainingPanel className='flex-1 border-r' />
          <ComputeDashboard className='flex-1' />
        </div>
      ) : null}

      {/* AI Auto-Pipeline panel */}
      {showPipeline ? (
        <div className='border-t'>
          <PipelineProgressPanel
            pipeline={pipeline}
            projectName={project?.name ?? ''}
            onStart={() => {
              void pipeline.startPipeline(
                project?.brief ?? '',
                project?.name ?? '',
                project?.genre ?? '',
                project?.style_dna ?? '',
              )
            }}
            onConfirmCheckpoint={pipeline.confirmCheckpoint}
            onSkipCheckpoint={pipeline.skipCheckpoint}
            onCancel={() => {
              pipeline.cancel()
              setShowPipeline(false)
            }}
          />
        </div>
      ) : null}

      {/* Copyright upsell when project is completed */}
      {project.status === PROJECT_STATUS.COMPLETED ? (
        <div className='border-t'>
          <SoftConversionBanner type='copyright' />
        </div>
      ) : null}

      {/* License upsell for SaaS Light users */}
      {edition === 'saas-light' && stages.length > 0 ? (
        <div className='border-t'>
          <SoftConversionBanner type='license' />
        </div>
      ) : null}

      {/* Training upsell — shown when project has progress */}
      {project.status === PROJECT_STATUS.IN_PROGRESS ? (
        <div className='border-t'>
          <SoftConversionBanner type='training' />
        </div>
      ) : null}

      {/* Edit project dialog */}
      <StudioProjectMutateDialog
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
  locked: boolean
  unmetDeps: string[]
}) {
  const { t } = useTranslation()
  const { projectId, stageConfig, stage, locked, unmetDeps } =
    props
  const status = (stage?.status ?? STAGE_STATUS.NOT_STARTED) as StageStatusValue
  const statusConfig = STAGE_STATUS_CONFIG[status]

  const StatusIcon = locked ? Lock : getStageStatusIcon(status)

  const unmetLabels = unmetDeps
    .map((dep) => {
      const cfg = PIPELINE_STAGES.find((s) => s.key === dep)
      return cfg ? t(cfg.labelKey) : dep
    })
    .join(', ')

  const cardContent = (
    <>
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

      {/* Locked notice or status + progress */}
      {locked ? (
        <p className='text-muted-foreground mt-3 flex items-center gap-1.5 text-xs'>
          <Lock className='size-3.5' aria-hidden='true' />
          {t('Requires: {{stages}}', { stages: unmetLabels })}
        </p>
      ) : (
        <div className='mt-3 flex items-center gap-1.5 text-xs'>
          <StatusIcon className='size-3.5' aria-hidden='true' />
          <span className='text-muted-foreground'>
            {t(statusConfig?.labelKey ?? 'Not Started')}
          </span>
          {stage && stage.total_items > 0 ? (
            <span className='text-muted-foreground ml-auto'>
              {stage.done_items}/{stage.total_items}
            </span>
          ) : null}
        </div>
      )}
    </>
  )

  if (locked) {
    return (
      <div className='border-border bg-muted/50 flex cursor-not-allowed flex-col rounded-lg border p-4 opacity-60'>
        {cardContent}
      </div>
    )
  }

  return (
    <Link
      to='/studio/$projectId/$stageKey'
      params={{
        projectId: String(projectId),
        stageKey: stageConfig.key,
      }}
      className='border-border bg-card hover:bg-accent/50 flex flex-col rounded-lg border p-4 transition-colors'
    >
      {cardContent}
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
