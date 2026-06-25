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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Cpu,
  MessageCircle,
  Sparkles,
  Wrench,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { Button } from '@/components/ui/button'

export function HermesAgent() {
  const { t } = useTranslation()

  const highlights = [
    {
      icon: <Sparkles className='size-4 text-amber-400' />,
      text: 'Reusable skills that improve through real work',
    },
    {
      icon: <Wrench className='size-4 text-amber-400' />,
      text: 'Tools for research, writing, files and automation',
    },
    {
      icon: <MessageCircle className='size-4 text-amber-400' />,
      text: 'Message platform access, starting with WeChat',
    },
    {
      icon: <Bot className='size-4 text-amber-400' />,
      text: 'Web workspace with sessions, results and skills',
    },
    {
      icon: <Cpu className='size-4 text-amber-400' />,
      text: 'Uses platform-governed models and quotas',
    },
  ]

  const capabilityTags = [
    'Skills',
    'Memory',
    'Cron',
    'MCP',
    'Gateway',
    'Multi-model',
  ]

  return (
    <section className='relative z-10 overflow-hidden px-6 py-24 md:py-32'>
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10'
        style={{
          background: [
            'radial-gradient(ellipse 80% 60% at 10% 20%, oklch(0.72 0.16 85 / 30%) 0%, transparent 60%)',
            'radial-gradient(ellipse 60% 50% at 90% 80%, oklch(0.65 0.14 250 / 20%) 0%, transparent 60%)',
            'linear-gradient(135deg, oklch(0.97 0.01 85) 0%, oklch(0.96 0.02 250) 100%)',
          ].join(', '),
        }}
      />
      <div
        aria-hidden
        className='pointer-events-none absolute inset-0 -z-10 opacity-[0.04] dark:opacity-[0.03]'
        style={{
          backgroundImage:
            'linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)',
          backgroundSize: '3rem 3rem',
        }}
      />

      <div className='mx-auto max-w-6xl'>
        <div className='border-border/40 bg-background/60 dark:bg-background/40 relative overflow-hidden rounded-2xl border p-8 shadow-sm backdrop-blur-sm md:p-12 lg:p-14'>
          <div
            aria-hidden
            className='pointer-events-none absolute -top-24 -right-24 size-72 opacity-40 dark:opacity-25'
            style={{
              background:
                'radial-gradient(circle, oklch(0.72 0.16 85 / 50%) 0%, transparent 70%)',
            }}
          />

          <div className='relative grid gap-10 lg:grid-cols-2 lg:gap-14'>
            <AnimateInView className='flex flex-col items-start'>
              <div className='mb-5 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400'>
                <span className='relative flex size-1.5'>
                  <span className='absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75' />
                  <span className='relative inline-flex size-1.5 rounded-full bg-amber-500' />
                </span>
                <span>{t('AI agent workspace')}</span>
              </div>

              <h2 className='text-[clamp(1.75rem,3.5vw,2.5rem)] leading-tight font-bold tracking-tight'>
                {t('Meet HermesAgent, your skill-based AI work partner')}
              </h2>
              <p className='text-muted-foreground mt-4 max-w-xl leading-relaxed'>
                {t(
                  'Use HermesAgent to turn repeatable work into skills, keep sessions and results together, and let teams reuse proven workflows under platform governance.'
                )}
              </p>

              <ul className='mt-6 space-y-3'>
                {highlights.map((item) => (
                  <li
                    key={item.text}
                    className='flex items-start gap-3 text-sm'
                  >
                    <span className='mt-0.5 shrink-0'>{item.icon}</span>
                    <span>{t(item.text)}</span>
                  </li>
                ))}
              </ul>

              <div className='mt-8 flex flex-wrap items-center gap-3'>
                <Button
                  className='group rounded-lg bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:hover:bg-amber-500'
                  render={<Link to='/hermes-playground' />}
                >
                  {t('Open HermesAgent')}
                  <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
                </Button>
                <Button
                  variant='outline'
                  className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
                  render={<Link to='/docs' />}
                >
                  {t('Learn more')}
                </Button>
              </div>
            </AnimateInView>

            <AnimateInView
              delay={150}
              animation='scale-in'
              className='flex flex-col justify-center'
            >
              <div className='border-border/40 bg-muted/30 dark:bg-muted/20 rounded-xl border p-6'>
                <div className='mb-5 flex items-center gap-3'>
                  <div className='flex size-12 items-center justify-center rounded-xl border border-amber-500/15 bg-amber-500/10'>
                    <Bot className='size-6 text-amber-600 dark:text-amber-400' />
                  </div>
                  <div>
                    <h3 className='font-semibold'>{t('HermesAgent')}</h3>
                    <p className='text-muted-foreground text-xs'>
                      {t('Skill-based AI work partner')}
                    </p>
                  </div>
                </div>

                <div className='grid grid-cols-2 gap-4 sm:grid-cols-3'>
                  <div className='bg-background/80 dark:bg-background/60 rounded-lg border border-border/40 p-4 text-center'>
                    <div className='text-2xl font-bold text-amber-600 dark:text-amber-400'>
                      70+
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Work tools')}
                    </div>
                  </div>
                  <div className='bg-background/80 dark:bg-background/60 rounded-lg border border-border/40 p-4 text-center'>
                    <div className='text-2xl font-bold text-amber-600 dark:text-amber-400'>
                      20+
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Message access')}
                    </div>
                  </div>
                  <div className='bg-background/80 dark:bg-background/60 rounded-lg border border-border/40 p-4 text-center'>
                    <div className='text-2xl font-bold text-amber-600 dark:text-amber-400'>
                      6
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {t('Work modes')}
                    </div>
                  </div>
                </div>

                <div className='mt-5 flex flex-wrap gap-2'>
                  {capabilityTags.map((tag) => (
                    <span
                      key={tag}
                      className='border-border/30 bg-background/80 dark:bg-background/60 text-muted-foreground rounded-md border px-2.5 py-1 text-xs'
                    >
                      {t(tag)}
                    </span>
                  ))}
                </div>

                <div className='mt-5 flex items-start gap-3 rounded-lg border border-amber-500/15 bg-amber-500/5 p-3 text-xs text-amber-800 dark:text-amber-300'>
                  <CheckCircle2 className='mt-0.5 size-4 shrink-0' />
                  <p>
                    {t(
                      'HermesAgent is most useful when it becomes part of daily work: create a session, use a skill, produce a result, then improve the skill for next time.'
                    )}
                  </p>
                </div>
              </div>
            </AnimateInView>
          </div>
        </div>
      </div>
    </section>
  )
}
