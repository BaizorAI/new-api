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
  FileText,
  MessageSquare,
  Sparkles,
  Users,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

type WorkbenchPreviewProps = {
  className?: string
}

const workspaceTabs = [
  { key: 'My Teams', icon: Users },
  { key: 'One-Person Company', icon: Sparkles },
  { key: 'HermesAgent', icon: MessageSquare },
] as const

const workItems = [
  {
    icon: MessageSquare,
    title: 'Team session',
    desc: 'Discuss the task with shared context',
  },
  {
    icon: Sparkles,
    title: 'Reusable skill',
    desc: 'Save the method for next time',
  },
  {
    icon: FileText,
    title: 'Result file',
    desc: 'Keep the output with the work',
  },
] as const

export function WorkbenchPreview(props: WorkbenchPreviewProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('mx-auto w-full max-w-2xl', props.className)}>
      <div className='border-border/60 bg-background/95 overflow-hidden rounded-2xl border shadow-[0_20px_50px_-25px_rgba(15,23,42,0.22)] backdrop-blur-sm'>
        <div className='border-border/50 flex items-center justify-between border-b px-4 py-3'>
          <div>
            <p className='text-muted-foreground text-[11px] font-medium tracking-[0.16em] uppercase'>
              {t('Workspace')}
            </p>
            <h3 className='text-sm font-semibold'>
              {t('Workspaces for real work')}
            </h3>
          </div>
          <div className='rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-400'>
            {t('Ready')}
          </div>
        </div>

        <div className='grid min-h-[390px] grid-cols-1 md:grid-cols-[190px_minmax(0,1fr)]'>
          <div className='border-border/40 bg-muted/20 border-b p-3 md:border-r md:border-b-0'>
            <div className='space-y-1.5'>
              {workspaceTabs.map((item, index) => (
                <div
                  key={item.key}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
                    index === 0
                      ? 'bg-background text-foreground border-border/40 border shadow-xs'
                      : 'text-muted-foreground'
                  )}
                >
                  <item.icon className='size-4' />
                  <span className='truncate'>{t(item.key)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className='p-5'>
            <div className='mb-5'>
              <p className='text-muted-foreground text-xs'>
                {t('Current work')}
              </p>
              <h4 className='mt-1 text-lg font-semibold'>
                {t('Turn repeated work into shared capability')}
              </h4>
              <p className='text-muted-foreground mt-2 text-sm leading-relaxed'>
                {t(
                  'Start with a real task, keep the conversation and files together, then save the useful method as a skill.'
                )}
              </p>
            </div>

            <div className='space-y-3'>
              {workItems.map((item) => (
                <div
                  key={item.title}
                  className='border-border/40 bg-muted/20 flex items-start gap-3 rounded-xl border p-3'
                >
                  <div className='bg-background border-border/40 mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border'>
                    <item.icon className='text-primary size-4' />
                  </div>
                  <div className='min-w-0'>
                    <div className='flex items-center gap-2'>
                      <h5 className='truncate text-sm font-medium'>
                        {t(item.title)}
                      </h5>
                      <CheckCircle2 className='size-3.5 shrink-0 text-emerald-500' />
                    </div>
                    <p className='text-muted-foreground mt-1 text-xs leading-relaxed'>
                      {t(item.desc)}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className='border-border/40 bg-muted/10 mt-5 rounded-xl border p-3'>
              <p className='text-muted-foreground text-xs leading-relaxed'>
                {t(
                  'Model access, quota and audit stay governed in the background.'
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
