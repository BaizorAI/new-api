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
      id: 'relay',
      num: '01',
      title: 'Unified compute access',
      desc: 'Connect multi-source compute and intelligent model services into one AI Hub, giving business systems a stable and governed capability entry.',
      span: 'md:col-span-2',
      icon: <Route className='size-4 text-blue-400' />,
      visual: ['Local models', 'OpenAI', 'Claude', 'Gemini', 'DeepSeek'],
    },
    {
      id: 'routing',
      num: '02',
      title: 'Model scheduling and routing middleware',
      desc: 'Set model scheduling, routing middleware, access permissions, quota boundaries and audit policies for different business scenarios.',
      span: 'md:col-span-1',
      icon: <Zap className='size-4 text-violet-400' />,
      visual: ['Scheduling', 'Routing', 'Policy'],
    },
    {
      id: 'billing',
      num: '03',
      title: 'Private deployment capability',
      desc: 'Private deployment fits data-sensitive, intranet, Xinchuang, dedicated compute and Hermes sidecar scenarios where organizations need controllable AI capability boundaries.',
      span: 'md:col-span-1',
      icon: <WalletCards className='size-4 text-emerald-400' />,
      visual: ['Intranet', 'Xinchuang', 'Hermes sidecar', 'Dedicated compute'],
    },
    {
      id: 'governance',
      num: '04',
      title: 'Quota and usage governance',
      desc: 'Apply routing strategies, access boundaries, quota controls, usage records and security audit policies from the platform layer.',
      span: 'md:col-span-2',
      icon: <Shield className='size-4 text-amber-400' />,
      visual: ['Access', 'Quota', 'Audit', 'Logs'],
    },
  ]

  const additionalFeatures = [
    {
      icon: <BarChart3 className='size-5' strokeWidth={1.5} />,
      title: 'Localization and Xinchuang adaptation',
      desc: 'Add model request conversion, response handling, usage extraction and localized compute adaptation without changing business applications.',
    },
    {
      icon: <Database className='size-5' strokeWidth={1.5} />,
      title: 'AI resource governance',
      desc: 'Manage users, application credentials, access boundaries, quota allocation, usage records and security audit flows.',
    },
    {
      icon: <Gauge className='size-5' strokeWidth={1.5} />,
      title: 'Operational visibility',
      desc: 'Track request IDs, usage logs, performance metrics, cache state and channel health from the control plane.',
    },
    {
      icon: <HeartHandshake className='size-5' strokeWidth={1.5} />,
      title: 'Connect compute and models',
      desc: 'Bring multi-source compute, private model services, Hermes sidecars and external intelligent models into one governed AI Hub capability pool.',
    },
  ]

  return (
    <section className='relative z-10 px-6 py-24 md:py-32'>
      <div className='mx-auto max-w-6xl'>
        <AnimateInView className='mb-16 max-w-xl'>
          <p className='text-muted-foreground mb-3 text-xs font-medium tracking-widest uppercase'>
            {t('Product capabilities')}
          </p>
          <h2 className='text-2xl leading-tight font-bold tracking-tight md:text-3xl'>
            {t('A trusted AI Hub for localization adaptation, compute access, model scheduling, routing middleware and AI resource governance.')}
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
