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
import {
  CheckCircle2Icon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Main } from '@/components/layout'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'

import {
  listHermesToolsets,
  type HermesToolset,
} from '@/features/hermes-playground/api'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

type ToolsetStatusFilter = 'all' | 'enabled' | 'disabled' | 'configured' | 'unconfigured'

const filterLabels: Record<string, string> = {
  enabled: 'Enabled',
  disabled: 'Disabled',
  configured: 'Configured',
  unconfigured: 'Needs configuration',
}

const searchSchema = z.object({
  filter: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/tools-editor/')({
  validateSearch: searchSchema,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'hermes_playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ToolsEditorPage,
})

function ToolsEditorPage() {
  const { t } = useTranslation()
  const { filter } = Route.useSearch()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')

  const statusFilter: ToolsetStatusFilter =
    filter === 'enabled' || filter === 'disabled' || filter === 'configured' || filter === 'unconfigured'
      ? filter
      : 'all'

  const sectionLabel = filter && filterLabels[filter] ? t(filterLabels[filter]) : ''

  const { data: toolsets = [], isLoading, error, refetch } = useQuery({
    queryKey: ['tools-editor', 'toolsets'],
    queryFn: listHermesToolsets,
    staleTime: 2 * 60 * 1000,
  })

  const filtered = useMemo(
    () => filterToolsets(toolsets, search, statusFilter),
    [toolsets, search, statusFilter],
  )

  return (
    <Main className='flex min-h-[calc(100vh-var(--app-header-height,0px))] flex-col'>
      <header className='flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6'>
        <div>
          <h1 className='text-lg font-semibold'>{sectionLabel || t('Tools')}</h1>
          <p className='text-muted-foreground text-sm'>
            {sectionLabel ? t('Filtered toolsets') : t('Browse and configure Hermes toolsets')}
          </p>
        </div>
        <Button
          aria-label={t('Refresh')}
          onClick={() => {
            void queryClient.invalidateQueries({ queryKey: ['tools-editor', 'toolsets'] })
            refetch()
          }}
          size='icon-sm'
          type='button'
          variant='ghost'
        >
          <RefreshCwIcon className='size-4' />
        </Button>
      </header>

      <div className='border-b px-4 py-3'>
        <div className='relative'>
          <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
          <Input
            className='pl-8'
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('Search toolsets and tools')}
            value={search}
          />
        </div>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        <div className='max-w-2xl p-4 space-y-3'>
          {isLoading && (
            <div className='space-y-2'>
              <Skeleton className='h-20 w-full' />
              <Skeleton className='h-20 w-full' />
              <Skeleton className='h-20 w-full' />
            </div>
          )}
          {error && (
            <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm'>
              {error instanceof Error ? error.message : t('Failed to load tools')}
            </div>
          )}
          {!isLoading && !error && filtered.length === 0 && (
            <div className='text-muted-foreground py-12 text-center'>
              <WrenchIcon className='mx-auto mb-3 size-8 opacity-30' />
              <p className='text-sm'>{t('No toolsets match the current filters.')}</p>
            </div>
          )}
          {!isLoading && !error && filtered.map((toolset) => (
            <Link
              key={toolset.name}
              to='/toolset-detail'
              search={{ toolset: toolset.name }}
            >
              <div className='hover:bg-muted/60 rounded-lg border p-4 transition-colors cursor-pointer'>
                <div className='flex items-start justify-between gap-3'>
                  <div className='min-w-0 flex-1 space-y-1'>
                    <div className='flex flex-wrap items-center gap-1.5'>
                      <h3 className='truncate text-sm font-medium'>
                        {toolset.label || toolset.name}
                      </h3>
                      <StatusBadge active={toolset.enabled} activeText={t('Enabled')} inactiveText={t('Disabled')} />
                      <StatusBadge active={toolset.configured} activeText={t('Configured')} inactiveText={t('Needs configuration')} />
                    </div>
                    {(toolset.descriptionZh || toolset.description) && (
                      <p className='text-muted-foreground line-clamp-2 text-xs'>
                        {toolset.descriptionZh || toolset.description}
                      </p>
                    )}
                    <p className='text-muted-foreground text-xs'>
                      {t('{{count}} tools', { count: toolset.tools.length })}
                    </p>
                  </div>
                  <SlidersHorizontalIcon className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </ScrollArea>
    </Main>
  )
}

function StatusBadge({ active, activeText, inactiveText }: { active: boolean; activeText: string; inactiveText: string }) {
  const Icon = active ? CheckCircle2Icon : XCircleIcon
  return (
    <Badge variant={active ? 'secondary' : 'outline'}>
      <Icon className='size-3' />
      {active ? activeText : inactiveText}
    </Badge>
  )
}

function filterToolsets(toolsets: HermesToolset[], query: string, status: ToolsetStatusFilter): HermesToolset[] {
  const q = query.trim().toLowerCase()
  return toolsets.filter((toolset) => {
    if (status === 'enabled' && !toolset.enabled) return false
    if (status === 'disabled' && toolset.enabled) return false
    if (status === 'configured' && !toolset.configured) return false
    if (status === 'unconfigured' && toolset.configured) return false
    if (!q) return true
    return [toolset.name, toolset.label, toolset.description, ...toolset.tools].join(' ').toLowerCase().includes(q)
  })
}
