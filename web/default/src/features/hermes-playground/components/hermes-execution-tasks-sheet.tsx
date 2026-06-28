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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircle2Icon,
  Clock3Icon,
  ExternalLinkIcon,
  FileCheck2Icon,
  Loader2Icon,
  RotateCcwIcon,
  XCircleIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'

import {
  listHermesExecutionTasks,
  retryHermesExecutionTask,
  type HermesExecutionTask,
  type HermesExecutionTaskStatus,
} from '../api'

interface HermesExecutionTasksSheetProps {
  open: boolean
  userScope: string
  teamId?: number
  onOpenChange: (open: boolean) => void
  onOpenTaskResults?: (task: HermesExecutionTask) => void
  onSelectTask: (task: HermesExecutionTask) => void
}

export function HermesExecutionTasksSheet(
  props: HermesExecutionTasksSheetProps
) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const queryKey = [
    'hermes-execution-tasks',
    props.userScope,
    props.teamId ?? 'personal',
  ]

  const tasksQuery = useQuery({
    queryKey,
    queryFn: () =>
      listHermesExecutionTasks({ teamId: props.teamId, limit: 50 }),
    enabled: props.open,
    refetchInterval: props.open ? 3000 : false,
  })

  const retryMutation = useMutation({
    mutationFn: retryHermesExecutionTask,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey })
      toast.success(t('Task restarted'))
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t('Failed to retry task')
      )
    },
  })

  const tasks = tasksQuery.data ?? []

  return (
    <Sheet open={props.open} onOpenChange={props.onOpenChange}>
      <SheetContent className='w-full gap-0 sm:max-w-xl' side='right'>
        <SheetHeader className='border-b pr-12'>
          <SheetTitle>{t('Execution tasks')}</SheetTitle>
          <SheetDescription>
            {t('Track running work and reopen the related workspace.')}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className='min-h-0 flex-1'>
          <div className='space-y-3 p-4'>
            {tasks.length === 0 && !tasksQuery.isLoading ? (
              <Empty className='min-h-48 rounded-lg border p-4'>
                <EmptyMedia variant='icon'>
                  <Clock3Icon className='size-5' />
                </EmptyMedia>
                <EmptyTitle>{t('No execution tasks')}</EmptyTitle>
                <EmptyDescription>
                  {t('Tasks started from Hermes will appear here.')}
                </EmptyDescription>
              </Empty>
            ) : null}

            {tasks.map((task) => (
              <article key={task.taskId} className='rounded-lg border p-4'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0 space-y-1'>
                    <div className='flex flex-wrap items-center gap-2'>
                      <h3 className='truncate text-sm font-medium'>
                        {task.title || t('Hermes task')}
                      </h3>
                      <Badge variant={getStatusVariant(task.status)}>
                        {getStatusLabel(task.status, t)}
                      </Badge>
                    </div>
                    <p className='text-muted-foreground text-xs'>
                      {formatTaskTime(task.createdAt)} · {task.progress}%
                    </p>
                    {task.error ? (
                      <p className='text-destructive line-clamp-2 text-xs'>
                        {task.error}
                      </p>
                    ) : null}
                  </div>
                  {getStatusIcon(task.status)}
                </div>

                <div className='bg-muted mt-3 h-1.5 overflow-hidden rounded-full'>
                  <div
                    className='bg-primary h-full rounded-full transition-all'
                    style={{
                      width: `${Math.min(Math.max(task.progress, 0), 100)}%`,
                    }}
                  />
                </div>

                <div className='mt-3 flex flex-wrap gap-2'>
                  <Button
                    onClick={() => props.onSelectTask(task)}
                    size='sm'
                    type='button'
                    variant='outline'
                  >
                    <ExternalLinkIcon className='size-4' />
                    {t('Open')}
                  </Button>
                  {props.onOpenTaskResults && task.conversationId ? (
                    <Button
                      onClick={() => props.onOpenTaskResults?.(task)}
                      size='sm'
                      type='button'
                      variant='outline'
                    >
                      <FileCheck2Icon className='size-4' />
                      {t('Open results')}
                    </Button>
                  ) : null}
                  {(task.status === 'failed' || task.status === 'canceled') && (
                    <Button
                      disabled={retryMutation.isPending}
                      onClick={() => retryMutation.mutate(task.taskId)}
                      size='sm'
                      type='button'
                      variant='outline'
                    >
                      <RotateCcwIcon className='size-4' />
                      {t('Retry')}
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}

function getStatusLabel(
  status: HermesExecutionTaskStatus,
  t: (key: string) => string
): string {
  switch (status) {
    case 'queued':
      return t('Queued')
    case 'running':
      return t('Running')
    case 'succeeded':
      return t('Completed')
    case 'failed':
      return t('Failed')
    case 'canceled':
      return t('Canceled')
  }
}

function getStatusVariant(status: HermesExecutionTaskStatus) {
  if (status === 'succeeded') return 'secondary'
  if (status === 'failed' || status === 'canceled') return 'destructive'
  return 'outline'
}

function getStatusIcon(status: HermesExecutionTaskStatus) {
  if (status === 'succeeded') {
    return <CheckCircle2Icon className='size-5 shrink-0 text-emerald-600' />
  }
  if (status === 'failed' || status === 'canceled') {
    return <XCircleIcon className='text-destructive size-5 shrink-0' />
  }
  return (
    <Loader2Icon className='text-muted-foreground size-5 shrink-0 animate-spin' />
  )
}

function formatTaskTime(value: number): string {
  if (!value) return ''
  return new Date(value * 1000).toLocaleString()
}
