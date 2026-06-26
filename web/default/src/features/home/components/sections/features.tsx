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
  BarChart3,
  Database,
  Gauge,
  HeartHandshake,
  Route,
  Shield,
  WalletCards,
  Zap,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'

export function Features() {
  const { t } = useTranslation()

  const features = [
    {
      id: 'team-workspace',
      num: '01',
      title: 'Team workspace',
      desc: 'Create team workspaces where conversations, skills and result files are shared by the people doing the work.',
      span: 'md:col-span-2',
      icon: <Route className='size-4 text-blue-400' />,
      visual: ['Team sessions', 'Shared context', 'Results', 'Members', 'Roles'],
    },
    {
      id: 'skills',
      num: '02',
      title: 'Skill improvement loop',
      desc: 'Turn repeated prompts, workflows and domain know-how into reusable skills that teams can improve over time.',
      span: 'md:col-span-1',
      icon: <Zap className='size-4 text-violet-400' />,
      visual: ['Create', 'Improve', 'Share'],
    },
    {
      id: 'results',
      num: '03',
      title: 'Results that stay with the work',
      desc: 'Keep uploaded files, generated documents and conversation outcomes visible from the workspace instead of scattering them across chats.',
      span: 'md:col-span-1',
      icon: <WalletCards className='size-4 text-emerald-400' />,
      visual: ['Uploads', 'Documents', 'Exports', 'History'],
    },
    {
      id: 'governance',
      num: '04',
      title: 'Use the right models within clear cost boundaries',
      desc: 'Set model access, quota and cost boundaries once, then let workspaces use the right capability without extra setup.',
      span: 'md:col-span-2',
      icon: <Shield className='size-4 text-amber-400' />,
      visual: ['Permissions', 'Quota', 'Audit', 'Usage'],
    },
  ]

  const additionalFeatures = [
    {
      icon: <BarChart3 className='size-5' strokeWidth={1.5} />,
      title: 'Personal AI workbench',
      desc: 'Use a personal workspace for drafts, research, experiments and skills before sharing work with a team.',
    },
    {
      icon: <Database className='size-5' strokeWidth={1.5} />,
      title: 'Team skill collection',
      desc: 'Promote useful personal skills into team or Baizor shared skills so good practice becomes reusable capability.',
    },
    {
      icon: <Gauge className='size-5' strokeWidth={1.5} />,
      title: 'Outcome-centered records',
      desc: 'Review shared sessions, files, skill changes and usage records around the work that produced them.',
    },
    {
      icon: <HeartHandshake className='size-5' strokeWidth={1.5} />,
      title: 'Private deployment when needed',
      desc: 'Use the online service for fast adoption, then deploy privately when data, network or governance boundaries require it.',
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-xl'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('User-first workspaces')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t(
              'Start in a workspace and keep conversations, skills and results tied to the same task.'
            )}
          </h2>
        </AnimateInView>

        <div className='border-border/40 bg-border/40 grid gap-px overflow-hidden rounded-xl border md:grid-cols-3'>
          {features.map((feature, index) => (
            <AnimateInView
              key={feature.id}
              delay={index * 100}
              animation='scale-in'
              className={`bg-background group hover:bg-muted/20 p-7 transition-colors duration-300 md:p-8 ${feature.span}`}
            >
              <div className='mb-3 flex items-center gap-3'>
                <span className='border-border/40 bg-muted text-muted-foreground flex size-7 items-center justify-center rounded-md border text-[10px] font-semibold tabular-nums'>
                  {feature.num}
                </span>
                <div className='border-border/40 bg-muted flex size-7 items-center justify-center rounded-md border'>
                  {feature.icon}
                </div>
                <h3 className='text-sm font-semibold'>{t(feature.title)}</h3>
              </div>
              <p className='text-muted-foreground text-sm leading-relaxed'>
                {t(feature.desc)}
              </p>
              <div className='mt-4 flex flex-wrap gap-2'>
                {feature.visual.map((item) => (
                  <span
                    key={item}
                    className='border-border/30 bg-muted/20 text-muted-foreground rounded-lg border px-3 py-1.5 text-xs'
                  >
                    {t(item)}
                  </span>
                ))}
              </div>
            </AnimateInView>
          ))}
        </div>

        <div className='mt-12 grid grid-cols-2 gap-8 md:grid-cols-4 md:gap-12'>
          {additionalFeatures.map((feature, index) => (
            <AnimateInView
              key={feature.title}
              delay={index * 100}
              animation='fade-up'
              className='flex flex-col items-center text-center'
            >
              <div className='text-muted-foreground border-border/50 bg-muted/30 mb-3 flex size-12 items-center justify-center rounded-xl border transition-colors'>
                {feature.icon}
              </div>
              <h3 className='mb-1.5 text-sm font-semibold'>
                {t(feature.title)}
              </h3>
              <p className='text-muted-foreground max-w-[220px] text-xs leading-relaxed'>
                {t(feature.desc)}
              </p>
            </AnimateInView>
          ))}
        </div>
      </div>
    </section>
  )
}
