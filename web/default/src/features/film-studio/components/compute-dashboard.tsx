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
import { Link } from '@tanstack/react-router'
import {
  Activity,
  Gauge,
  Layers,
  Loader2,
  Server,
  TrendingUp,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

import {
  getPerfMetricsSummary,
} from '@/features/performance-metrics/api'
import type { PerfModelSummary } from '@/features/performance-metrics/types'

type ComputeDashboardProps = {
  className?: string
}

/**
 * Enterprise compute dashboard — powered by live performance metrics.
 *
 * Fetches real model performance data from GET /api/perf-metrics/summary
 * and displays each model as a compute "node" with success rate, latency,
 * tokens-per-second, and request volume.
 */
export function ComputeDashboard({ className }: ComputeDashboardProps) {
  const { t } = useTranslation()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['perf-metrics-summary', 24],
    queryFn: () => getPerfMetricsSummary(24),
    staleTime: 60_000,
    refetchInterval: 30_000,
    retry: false,
  })

  const models: PerfModelSummary[] = data?.data?.models ?? []

  // Aggregate stats across all models
  const totalRequests = models.reduce((s, m) => s + (m.request_count ?? 0), 0)
  const avgSuccessRate = models.length > 0
    ? Math.round(models.reduce((s, m) => s + m.success_rate, 0) / models.length)
    : 0
  const avgLatency = models.length > 0
    ? Math.round(models.reduce((s, m) => s + m.avg_latency_ms, 0) / models.length)
    : 0
  const maxTps = models.length > 0
    ? Math.max(...models.map((m) => m.avg_tps))
    : 0

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-3 py-2.5'>
        <div className='flex items-center gap-2'>
          <Server className='text-muted-foreground size-3.5' aria-hidden='true' />
          <span className='text-xs font-semibold'>
            {t('Compute Dashboard')}
          </span>
        </div>
        {models.length > 0 ? (
          <span className='bg-muted text-muted-foreground rounded px-1.5 py-0.5 text-[10px]'>
            {models.length} {t('models')}
          </span>
        ) : null}
      </div>

      {/* Summary stats */}
      <div className='grid grid-cols-2 gap-2 border-b p-3'>
        <StatTile
          icon={<Activity className='size-3.5' />}
          label={t('Success Rate')}
          value={`${avgSuccessRate}%`}
          color={avgSuccessRate >= 95 ? 'text-emerald-500' : avgSuccessRate >= 80 ? 'text-amber-500' : 'text-red-500'}
        />
        <StatTile
          icon={<Gauge className='size-3.5' />}
          label={t('Avg Latency')}
          value={`${avgLatency}ms`}
        />
        <StatTile
          icon={<TrendingUp className='size-3.5' />}
          label={t('Peak TPS')}
          value={maxTps.toFixed(1)}
        />
        <StatTile
          icon={<Zap className='size-3.5' />}
          label={t('Requests')}
          value={formatRequestCount(totalRequests)}
        />
      </div>

      {/* Loading / Error / Content */}
      {isLoading ? (
        <div className='flex flex-1 items-center justify-center py-12'>
          <Loader2 className='text-muted-foreground size-5 animate-spin' />
        </div>
      ) : isError ? (
        <div className='flex flex-1 items-center justify-center py-12'>
          <p className='text-muted-foreground text-xs'>
            {t('Failed to load compute metrics.')}
          </p>
        </div>
      ) : models.length === 0 ? (
        <div className='flex flex-1 items-center justify-center py-12'>
          <p className='text-muted-foreground text-xs'>
            {t('No performance data yet. Start making API requests to see metrics.')}
          </p>
        </div>
      ) : (
        <div className='flex-1 overflow-auto divide-y'>
          {models.slice(0, 8).map((model) => (
            <div key={model.model_name} className='px-3 py-2.5'>
              <div className='flex items-center justify-between'>
                <div className='flex items-center gap-2 min-w-0'>
                  <div
                    className={cn(
                      'size-2 shrink-0 rounded-full',
                      model.success_rate >= 95
                        ? 'bg-emerald-500'
                        : model.success_rate >= 80
                          ? 'bg-amber-500'
                          : 'bg-red-500'
                    )}
                  />
                  <div className='min-w-0'>
                    <p className='truncate text-[11px] font-medium'>
                      {model.model_name}
                    </p>
                    <div className='mt-1 flex items-center gap-3 text-[10px] text-muted-foreground'>
                      <span className='flex items-center gap-1'>
                        <Gauge className='size-3' />
                        {model.avg_latency_ms}ms
                      </span>
                      <span className='flex items-center gap-1'>
                        <Activity className='size-3' />
                        {model.success_rate.toFixed(1)}%
                      </span>
                      {model.request_count != null ? (
                        <span className='flex items-center gap-1'>
                          <Zap className='size-3' />
                          {formatRequestCount(model.request_count)}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>
                <div className='shrink-0 text-right'>
                  <span
                    className={cn(
                      'text-[11px] font-medium tabular-nums',
                      model.avg_tps > 100
                        ? 'text-emerald-500'
                        : model.avg_tps > 30
                          ? 'text-amber-500'
                          : 'text-muted-foreground'
                    )}
                  >
                    {model.avg_tps.toFixed(1)}
                  </span>
                  <p className='text-[9px] text-muted-foreground'>TPS</p>
                </div>
              </div>
              {/* Success rate bar */}
              <Progress
                value={model.success_rate}
                className='mt-1.5 h-1'
              />
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className='border-t p-3 space-y-2'>
        <Button
          size='sm'
          className='h-7 w-full text-xs'
          render={<Link to='/pricing' />}
        >
          <Zap className='mr-1 size-3.5' />
          {t('Buy compute pack')}
        </Button>
        <Button
          variant='outline'
          size='sm'
          className='h-7 w-full text-xs'
        >
          <Layers className='mr-1 size-3.5' />
          {t('View usage details')}
        </Button>
      </div>
    </div>
  )
}

function StatTile(props: {
  icon: React.ReactNode
  label: string
  value: string
  color?: string
}) {
  return (
    <div className='flex items-center gap-2 rounded-lg border bg-muted/50 px-2.5 py-2'>
      <span className={cn('shrink-0', props.color ?? 'text-muted-foreground')}>
        {props.icon}
      </span>
      <div className='min-w-0'>
        <p className='text-[10px] text-muted-foreground'>{props.label}</p>
        <p className='text-[11px] font-medium tabular-nums'>{props.value}</p>
      </div>
    </div>
  )
}

function formatRequestCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}
