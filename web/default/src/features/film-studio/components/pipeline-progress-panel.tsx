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
import {
  CheckCircle2,
  Circle,
  Loader2,
  Pause,
  Play,
  SkipForward,
  Sparkles,
  X,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { PipelineState, PipelineStageState } from '../hooks/use-pipeline-orchestrator'

type PipelineProgressPanelProps = {
  pipeline: PipelineState
  projectName: string
  onStart: () => void
  onConfirmCheckpoint: () => void
  onSkipCheckpoint: () => void
  onCancel: () => void
  className?: string
}

export function PipelineProgressPanel({
  pipeline,
  projectName,
  onStart,
  onConfirmCheckpoint,
  onSkipCheckpoint,
  onCancel,
  className,
}: PipelineProgressPanelProps) {
  const { t } = useTranslation()
  const { stages, isRunning, currentStage, status } = pipeline
  const doneCount = stages.filter(s => s.status === 'done').length
  const atCheckpoint = status === 'checkpoint'
  const isComplete = status === 'done'

  return (
    <div className={cn('border-border flex flex-col rounded-lg border bg-card', className)}>
      {/* Header */}
      <div className='border-border flex items-center justify-between border-b px-4 py-3'>
        <div className='flex items-center gap-2'>
          <Sparkles className='size-4 text-purple-500' aria-hidden='true' />
          <h3 className='text-sm font-semibold'>{t('AI Auto-Pipeline')}</h3>
        </div>
        <span className='text-muted-foreground text-[10px]'>
          {doneCount}/{stages.length} {t('done')}
        </span>
      </div>

      {/* Stage list */}
      <div className='flex-1 space-y-0.5 px-3 py-2'>
        {stages.map((stage, i) => (
          <PipelineStageRow
            key={stage.key}
            stage={stage}
            isActive={stage.key === currentStage}
            isLast={i === stages.length - 1}
          />
        ))}
      </div>

      {/* Actions */}
      <div className='border-t p-3'>
        {status === 'idle' ? (
          <Button
            size='sm'
            className='h-8 w-full text-xs'
            onClick={onStart}
          >
            <Play className='mr-1.5 size-3.5 text-emerald-500' />
            {t('Start Auto-Pipeline')}
          </Button>
        ) : atCheckpoint ? (
          <div className='space-y-2'>
            <p className='text-muted-foreground text-center text-[10px]'>
              {t('AI is waiting for your approval.')}
            </p>
            <div className='flex items-center gap-2'>
              <Button
                size='sm'
                variant='outline'
                className='h-7 flex-1 text-xs'
                onClick={onSkipCheckpoint}
              >
                <SkipForward className='mr-1 size-3.5' />
                {t('Skip')}
              </Button>
              <Button
                size='sm'
                className='h-7 flex-1 text-xs'
                onClick={onConfirmCheckpoint}
              >
                <CheckCircle2 className='mr-1 size-3.5 text-emerald-500' />
                {t('Confirm')}
              </Button>
            </div>
          </div>
        ) : isRunning ? (
          <div className='space-y-2'>
            <div className='flex items-center justify-center gap-2 text-xs text-muted-foreground'>
              <Loader2 className='size-3 animate-spin' />
              <span>{t('AI is working...')}</span>
            </div>
            <Button
              size='sm'
              variant='outline'
              className='h-7 w-full text-xs'
              onClick={onCancel}
            >
              <X className='mr-1 size-3.5 text-red-500' />
              {t('Stop')}
            </Button>
          </div>
        ) : isComplete ? (
          <div className='space-y-2'>
            <p className='text-emerald-500 text-center text-[10px] font-medium'>
              {t('All stages complete!')}
            </p>
            {onCancel ? (
              <Button
                size='sm'
                variant='outline'
                className='h-7 w-full text-xs'
                onClick={onCancel}
              >
                {t('Dismiss')}
              </Button>
            ) : null}
          </div>
        ) : status === 'error' ? (
          <div className='space-y-2'>
            <p className='text-destructive text-center text-[10px]'>
              {pipeline.error || t('An error occurred.')}
            </p>
            <Button
              size='sm'
              className='h-7 w-full text-xs'
              onClick={onStart}
            >
              <Play className='mr-1.5 size-3.5' />
              {t('Retry')}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function PipelineStageRow(props: {
  stage: PipelineStageState
  isActive: boolean
  isLast: boolean
}) {
  const { stage, isActive, isLast } = props
  const { t } = useTranslation()

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded px-2 py-1.5 transition-colors',
        isActive && 'bg-primary/5',
      )}
    >
      {/* Status icon */}
      {stage.status === 'done' ? (
        <CheckCircle2 className='size-3.5 shrink-0 text-emerald-500' />
      ) : stage.status === 'running' || isActive ? (
        <Loader2 className='size-3.5 shrink-0 animate-spin text-primary' />
      ) : stage.status === 'skipped' ? (
        <Circle className='size-3.5 shrink-0 text-muted-foreground/30' />
      ) : stage.status === 'checkpoint' ? (
        <Pause className='size-3.5 shrink-0 text-amber-500' />
      ) : (
        <Circle className='size-3.5 shrink-0 text-muted-foreground' />
      )}

      {/* Stage icon + label */}
      <span className='text-sm' aria-hidden='true'>{stage.icon}</span>
      <span
        className={cn(
          'flex-1 truncate text-xs font-medium',
          stage.status === 'done'
            ? 'text-emerald-500'
            : stage.status === 'skipped'
              ? 'text-muted-foreground/40 line-through'
              : stage.status === 'running'
                ? 'text-primary'
                : 'text-muted-foreground',
        )}
      >
        {t(stage.label)}
      </span>

      {/* Status badge */}
      {stage.status === 'checkpoint' ? (
        <span className='bg-amber-500/10 text-amber-600 dark:text-amber-400 shrink-0 rounded px-1 py-0.5 text-[9px] font-medium'>
          {t('Review')}
        </span>
      ) : stage.status === 'done' ? (
        <span className='bg-emerald-500/10 text-emerald-500 shrink-0 rounded px-1 py-0.5 text-[9px] font-medium'>
          ✓
        </span>
      ) : null}
    </div>
  )
}
