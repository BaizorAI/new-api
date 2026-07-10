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
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeftIcon,
  CheckCircle2Icon,
  ExternalLinkIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Main } from '@/components/layout'
import { Skeleton } from '@/components/ui/skeleton'
import { listHermesToolsets } from '@/features/hermes-playground/api'
import { cn } from '@/lib/utils'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

const searchSchema = z.object({
  toolset: z.string().optional().catch(undefined),
  tool: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/toolset-detail/')({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!isSidebarModuleEnabled('chat', 'hermes_playground')) {
      throw redirect({ to: '/dashboard' })
    }
    if (!search.toolset) {
      throw redirect({
        to: '/hermes-playground',
        search: { panel: 'skills', section: 'tools' },
      })
    }
  },
  component: ToolsetDetailPage,
})

function ToolsetDetailPage() {
  const { t } = useTranslation()
  const { toolset: toolsetName = '', tool: highlightTool } = Route.useSearch()

  const { data: toolsets = [], isLoading } = useQuery({
    queryKey: ['toolset-detail', 'toolsets'],
    queryFn: listHermesToolsets,
    staleTime: 2 * 60 * 1000,
  })

  const toolset = useMemo(
    () => toolsets.find((ts) => ts.name === toolsetName),
    [toolsets, toolsetName]
  )

  return (
    <Main className='flex min-h-[calc(100vh-var(--app-header-height,0px))] flex-col'>
      {/* Header */}
      <header className='border-b px-4 py-4 sm:px-6'>
        <div className='max-w-5xl'>
          <Button
            render={
              <Link
                to='/hermes-playground'
                search={{ panel: 'skills', section: 'tools' }}
              />
            }
            size='sm'
            type='button'
            variant='ghost'
          >
            <ArrowLeftIcon className='size-4' />
            {t('Back to tools')}
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className='flex min-h-0 flex-1 flex-col'>
        {isLoading && <ToolsetDetailSkeleton />}

        {!isLoading && !toolset && (
          <div className='flex flex-1 items-center justify-center p-6'>
            <div className='text-center'>
              <WrenchIcon className='text-muted-foreground mx-auto mb-3 size-8' />
              <h2 className='text-lg font-semibold'>
                {t('Toolset not found')}
              </h2>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('The requested toolset "{{name}}" was not found.', {
                  name: toolsetName,
                })}
              </p>
              <Button
                className='mt-4'
                render={
                  <Link
                    to='/hermes-playground'
                    search={{ panel: 'skills', section: 'tools' }}
                  />
                }
                type='button'
                variant='outline'
              >
                <ArrowLeftIcon className='size-4' />
                {t('Back to tools')}
              </Button>
            </div>
          </div>
        )}

        {!isLoading && toolset && (
          <div className='min-h-0 flex-1 overflow-auto'>
            <div className='max-w-5xl space-y-6 p-4 sm:p-6'>
              {/* Toolset identity */}
              <div className='space-y-2'>
                <div className='flex flex-wrap items-center gap-2'>
                  <h1 className='text-xl font-semibold tracking-tight'>
                    {toolset.label || toolset.name}
                  </h1>
                  <StatusBadge
                    active={toolset.enabled}
                    activeText={t('Enabled')}
                    inactiveText={t('Disabled')}
                  />
                  <StatusBadge
                    active={toolset.configured}
                    activeText={t('Configured')}
                    inactiveText={t('Needs configuration')}
                  />
                </div>
                {toolset.label && toolset.label !== toolset.name && (
                  <p className='text-muted-foreground font-mono text-sm'>
                    {toolset.name}
                  </p>
                )}
              </div>

              {/* Description */}
              {(toolset.description || toolset.descriptionZh) && (
                <section className='space-y-2'>
                  <h2 className='text-sm font-semibold'>
                    {t('Description')}
                  </h2>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {toolset.descriptionZh || toolset.description}
                  </p>
                  {toolset.descriptionZh && toolset.description && (
                    <p className='text-muted-foreground text-xs leading-relaxed'>
                      {toolset.description}
                    </p>
                  )}
                </section>
              )}

              {/* Usage guide */}
              {(toolset.usageGuide || toolset.usageGuideZh) && (
                <section className='space-y-2'>
                  <h2 className='text-sm font-semibold'>
                    {t('Usage guide')}
                  </h2>
                  <div className='bg-muted/35 rounded-md border px-3 py-2 text-sm leading-relaxed'>
                    {toolset.usageGuideZh || toolset.usageGuide}
                  </div>
                </section>
              )}

              {/* Tools list */}
              <section className='space-y-3'>
                <h2 className='text-sm font-semibold'>
                  {t('Tools in this toolset')}
                  <span className='text-muted-foreground ml-1.5 font-normal'>
                    ({toolset.tools.length})
                  </span>
                </h2>
                {toolset.tools.length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('No tools listed')}
                  </p>
                ) : (
                  <div className='grid gap-2 sm:grid-cols-2'>
                    {toolset.tools.map((toolName) => {
                      const isHighlighted = highlightTool === toolName
                      return (
                        <div
                          key={toolName}
                          className={cn(
                            'bg-muted/25 flex items-center gap-2 rounded-md border px-3 py-2.5 transition-colors',
                            isHighlighted && 'border-primary/40 bg-primary/5'
                          )}
                        >
                          <WrenchIcon className='text-muted-foreground size-3.5 shrink-0' />
                          <span
                            className={cn(
                              'min-w-0 flex-1 truncate font-mono text-xs',
                              isHighlighted && 'text-primary font-medium'
                            )}
                          >
                            {toolName}
                          </span>
                          {isHighlighted && (
                            <Badge variant='secondary'>
                              {t('Selected')}
                            </Badge>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Configuration placeholder */}
              <section className='space-y-3'>
                <h2 className='text-sm font-semibold'>
                  {t('Configuration')}
                </h2>
                <div className='bg-muted/25 rounded-lg border border-dashed p-6 text-center'>
                  <SlidersHorizontalIcon className='text-muted-foreground mx-auto mb-2 size-6' />
                  <p className='text-muted-foreground text-sm'>
                    {toolset.configured
                      ? t('This toolset is configured and active.')
                      : t('This toolset needs additional configuration.')}
                  </p>
                  <p className='text-muted-foreground mt-1 text-xs'>
                    {t(
                      'Toolset configuration is managed through the Hermes API server.'
                    )}
                  </p>
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </Main>
  )
}

function StatusBadge({
  active,
  activeText,
  inactiveText,
}: {
  active: boolean
  activeText: string
  inactiveText: string
}) {
  const Icon = active ? CheckCircle2Icon : XCircleIcon

  return (
    <Badge variant={active ? 'secondary' : 'outline'}>
      <Icon className='size-3' />
      {active ? activeText : inactiveText}
    </Badge>
  )
}

function ToolsetDetailSkeleton() {
  return (
    <div className='max-w-5xl space-y-6 p-4 sm:p-6'>
      <div className='space-y-2'>
        <Skeleton className='h-7 w-64' />
        <Skeleton className='h-4 w-48' />
      </div>
      <div className='space-y-2'>
        <Skeleton className='h-5 w-24' />
        <Skeleton className='h-16 w-full' />
      </div>
      <div className='space-y-2'>
        <Skeleton className='h-5 w-24' />
        <div className='grid gap-2 sm:grid-cols-2'>
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
          <Skeleton className='h-10 w-full' />
        </div>
      </div>
    </div>
  )
}
