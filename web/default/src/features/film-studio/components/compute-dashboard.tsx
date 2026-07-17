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

For commercial licensing, please contact support@quantumnous.com.
*/
import { Link } from '@tanstack/react-router'
import {
  Cpu,
  DollarSign,
  Gauge,
  HardDrive,
  Layers,
  Server,
  Thermometer,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type GpuNode = {
  id: string
  name: string
  model: string
  vramTotalGB: number
  vramUsedGB: number
  utilization: number // 0-100
  temperature: number // Celsius
  status: 'idle' | 'busy' | 'offline'
}

type ComputeDashboardProps = {
  nodes?: GpuNode[]
  monthlyCost?: string
  monthlyBudget?: string
  className?: string
}

const DEFAULT_NODES: GpuNode[] = [
  { id: 'gpu-01', name: 'Node 1', model: 'RTX 4090', vramTotalGB: 24, vramUsedGB: 12.4, utilization: 87, temperature: 72, status: 'busy' },
  { id: 'gpu-02', name: 'Node 2', model: 'RTX 4090', vramTotalGB: 24, vramUsedGB: 8.2, utilization: 45, temperature: 65, status: 'busy' },
  { id: 'gpu-03', name: 'Node 3', model: 'RTX 4090', vramTotalGB: 24, vramUsedGB: 0.3, utilization: 3, temperature: 42, status: 'idle' },
  { id: 'gpu-04', name: 'Node 4', model: 'RTX 4090', vramTotalGB: 24, vramUsedGB: 0, utilization: 0, temperature: 35, status: 'offline' },
]

/**
 * Enterprise compute dashboard.
 *
 * Real-time GPU cluster monitoring with utilization, temperature,
 * VRAM usage, and monthly cost tracking. Includes in-platform
 * compute pack purchase integration.
 */
export function ComputeDashboard({
  nodes = DEFAULT_NODES,
  monthlyCost = '$1,247.32',
  monthlyBudget = '$2,000.00',
  className,
}: ComputeDashboardProps) {
  const { t } = useTranslation()

  const activeNodes = nodes.filter((n) => n.status !== 'offline')
  const totalVram = activeNodes.reduce((sum, n) => sum + n.vramTotalGB, 0)
  const usedVram = activeNodes.reduce((sum, n) => sum + n.vramUsedGB, 0)
  const avgUtilization =
    activeNodes.length > 0
      ? Math.round(activeNodes.reduce((sum, n) => sum + n.utilization, 0) / activeNodes.length)
      : 0

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-3 py-2.5'>
        <div className='flex items-center gap-2'>
          <Server className='size-3.5 text-muted-foreground' aria-hidden='true' />
          <span className='text-xs font-semibold'>
            {t('Compute Dashboard')}
          </span>
        </div>
        <span className='rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'>
          {activeNodes.length}/{nodes.length} {t('online')}
        </span>
      </div>

      {/* Summary stats */}
      <div className='grid grid-cols-2 gap-2 border-b p-3'>
        <StatTile
          icon={<Cpu className='size-3.5' />}
          label={t('GPU Util.')}
          value={`${avgUtilization}%`}
          color={avgUtilization > 80 ? 'text-amber-500' : 'text-emerald-500'}
        />
        <StatTile
          icon={<HardDrive className='size-3.5' />}
          label={t('VRAM')}
          value={`${usedVram.toFixed(1)} / ${totalVram} GB`}
        />
        <StatTile
          icon={<DollarSign className='size-3.5' />}
          label={t('This month')}
          value={monthlyCost}
        />
        <StatTile
          icon={<Gauge className='size-3.5' />}
          label={t('Budget')}
          value={monthlyBudget}
        />
      </div>

      {/* Node list */}
      <div className='flex-1 overflow-auto divide-y'>
        {nodes.map((node) => (
          <div key={node.id} className='px-3 py-2.5'>
            <div className='flex items-center justify-between'>
              <div className='flex items-center gap-2'>
                <div
                  className={cn(
                    'size-2 rounded-full',
                    node.status === 'busy'
                      ? 'bg-primary'
                      : node.status === 'idle'
                        ? 'bg-emerald-500'
                        : 'bg-muted-foreground/30'
                  )}
                />
                <div>
                  <p className='text-[11px] font-medium'>
                    {node.name}
                    <span className='ml-1 font-normal text-muted-foreground'>
                      ({node.model})
                    </span>
                  </p>
                  <div className='mt-1 flex items-center gap-3 text-[10px] text-muted-foreground'>
                    <span className='flex items-center gap-1'>
                      <HardDrive className='size-3' />
                      {node.vramUsedGB.toFixed(1)}/{node.vramTotalGB} GB
                    </span>
                    <span className='flex items-center gap-1'>
                      <Thermometer className='size-3' />
                      {node.temperature}°C
                    </span>
                  </div>
                </div>
              </div>
              <div className='text-right'>
                <span
                  className={cn(
                    'text-[11px] font-medium tabular-nums',
                    node.utilization > 80
                      ? 'text-amber-500'
                      : 'text-emerald-500'
                  )}
                >
                  {node.utilization}%
                </span>
              </div>
            </div>
            {/* VRAM bar */}
            <Progress
              value={(node.vramUsedGB / node.vramTotalGB) * 100}
              className='mt-1.5 h-1'
            />
          </div>
        ))}
      </div>

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

export { DEFAULT_NODES }
