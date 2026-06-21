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
  BarChart3,
  Database,
  GitBranch,
  KeyRound,
  Mail,
  Route,
  Shield,
  Sparkles,
  WalletCards,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { AnimateInView } from '@/components/animate-in-view'
import { PublicLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import { useStatus } from '@/hooks/use-status'

const capabilities = [
  {
    icon: <Route className='size-5 text-blue-500' />,
    title: 'Localization and Xinchuang readiness',
    desc: 'Support private, intranet and trusted deployment needs for localized infrastructure and Xinchuang-oriented environments.',
  },
  {
    icon: <GitBranch className='size-5 text-violet-500' />,
    title: 'Unified compute access',
    desc: 'Bring multi-source compute, private model services and external intelligent models into one governed AI Hub capability pool.',
  },
  {
    icon: <WalletCards className='size-5 text-emerald-500' />,
    title: 'Intelligent model scheduling',
    desc: 'Coordinate model selection, priority, weight, tags, groups, health signals and fallback strategies for different business scenarios.',
  },
  {
    icon: <Shield className='size-5 text-amber-500' />,
    title: 'Routing middleware',
    desc: 'Provide transparent routing, exception handling, access control and policy distribution from the platform layer.',
  },
  {
    icon: <Database className='size-5 text-cyan-500' />,
    title: 'AI resource governance',
    desc: 'Control users, application credentials, model permissions, quota boundaries, request logs and security audit records.',
  },
  {
    icon: <BarChart3 className='size-5 text-rose-500' />,
    title: 'Flexible deployment',
    desc: 'Run with SQLite, MySQL or PostgreSQL, optionally enable Redis, and deploy as a single Go service or separated frontend topology.',
  },
] as const

const audiences = [
  {
    title: 'Government and enterprise teams',
    desc: 'Build a unified, trusted and auditable AI capability foundation under localization and Xinchuang requirements.',
  },
  {
    title: 'AI platform operators',
    desc: 'Manage models, compute, users, applications, quotas, logs and security policies from one AI platform.',
  },
  {
    title: 'Operations and infrastructure teams',
    desc: 'Bring multi-source compute, local models and external model services into a unified operating system.',
  },
  {
    title: 'Business application teams',
    desc: 'Use stable, governed intelligent capabilities without repeatedly handling model access, scheduling and audit concerns.',
  },
] as const

const stats = [
  { num: '40+', label: 'model service adaptors' },
  { num: '10+', label: 'model access protocol families' },
  { num: '3', label: 'platform distribution capabilities' },
  { num: '6', label: 'console languages' },
] as const

function About() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const currentYear = new Date().getFullYear()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-5xl space-y-16 px-4 py-12 md:py-20'>
        <AnimateInView className='text-center'>
          <div className='mb-6 flex justify-center'>
            <div className='flex size-20 items-center justify-center rounded-3xl border border-blue-500/15 bg-blue-500/5 shadow-sm'>
              <Sparkles className='size-10 text-blue-500' />
            </div>
          </div>
          <h1 className='text-4xl font-bold tracking-tight md:text-5xl'>
            {t('About Baize AI Platform')}
          </h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-lg leading-relaxed'>
            {t(
              'Baize AI Platform connects model services, applications and governance capabilities so organizations can use AI through a stable, controllable and observable operating layer.'
            )}
          </p>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Button className='group rounded-lg' render={<Link to='/docs' />}>
              {t('Read docs')}
              <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
            </Button>
            <Button
              variant='outline'
              className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
              render={<Link to='/' />}
            >
              {t('Back to home')}
            </Button>
          </div>
        </AnimateInView>

        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8'>
            <div className='grid grid-cols-2 gap-6 md:grid-cols-4'>
              {stats.map((stat) => (
                <div key={stat.label} className='text-center'>
                  <div className='text-3xl font-bold tracking-tight text-foreground'>
                    {stat.num}
                  </div>
                  <div className='text-muted-foreground mt-1 text-sm'>
                    {t(stat.label)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </AnimateInView>

        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='flex flex-col gap-6 md:flex-row md:items-start md:gap-10'>
              <div className='shrink-0'>
                <div className='flex size-14 items-center justify-center rounded-2xl border border-blue-500/15 bg-blue-500/5'>
                  <Shield className='size-7 text-blue-500' />
                </div>
              </div>
              <div className='flex-1'>
                <h2 className='text-xl font-bold'>{t('Service modes')}</h2>
                <div className='text-muted-foreground mt-2 space-y-3 leading-relaxed'>
                  <p>
                    {t(
                      'Baize AI Platform supports both online access and private deployment. Online access is suitable for evaluation, lightweight team use and cross-organization collaboration.'
                    )}
                  </p>
                  <p>
                    {t(
                      'Private deployment is designed for organizations that need data, permissions, model resources and operational records to remain inside their own controlled boundary.'
                    )}
                  </p>
                  <p>
                    {t(
                      'The same control plane manages model access, routing, quotas, audit logs and operational visibility, so teams can move from trial use to private deployment without changing core workflows.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AnimateInView>

        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 relative overflow-hidden rounded-2xl border p-8 md:p-10'>
            <div
              aria-hidden
              className='pointer-events-none absolute -top-20 -right-20 size-64 opacity-20 dark:opacity-10'
              style={{
                background:
                  'radial-gradient(circle, oklch(0.65 0.15 250 / 60%) 0%, transparent 70%)',
              }}
            />
            <div className='relative flex flex-col gap-6 md:flex-row md:items-center md:gap-10'>
              <div className='shrink-0'>
                <div className='flex size-14 items-center justify-center rounded-2xl border border-amber-500/15 bg-amber-500/5'>
                  <KeyRound className='size-7 text-amber-500' />
                </div>
              </div>
              <div>
                <h2 className='text-xl font-bold'>{t('Product mission')}</h2>
                <p className='text-muted-foreground mt-2 leading-relaxed'>
                  {t(
                    'Connect compute, models and business scenarios through a trusted AI Hub, so organizations can use artificial intelligence safely, efficiently and controllably under localization and Xinchuang systems.'
                  )}
                </p>
              </div>
            </div>
          </div>
        </AnimateInView>

        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='mb-5 flex items-center gap-3'>
              <div className='flex size-12 items-center justify-center rounded-2xl border border-blue-500/15 bg-blue-500/5'>
                <Sparkles className='size-6 text-blue-500' />
              </div>
              <div>
                <h2 className='text-xl font-bold'>
                  {t('The legend and meaning of Baize')}
                </h2>
                <p className='text-muted-foreground text-sm'>
                  {t('Know all things, perceive wisdom')}
                </p>
              </div>
            </div>
            <div className='text-muted-foreground space-y-4 leading-relaxed'>
              <p>
                {t(
                  'In ancient Chinese mythology, Baize is an auspicious divine beast of high status. It is said to understand all things under heaven, speak human language, and know the names, forms and ways to subdue spirits and strange beings. The Yellow Emperor once consulted Baize and recorded its knowledge as the Baize Tu, using it to understand the world, avoid misfortune and protect the people.'
                )}
              </p>
              <p>
                {t(
                  'Baize symbolizes universal knowledge, wise insight, turning danger into safety and protective auspiciousness. It appears only under enlightened rule and is regarded as a sign of order, wisdom and peace.'
                )}
              </p>
              <p>
                {t(
                  'Today, the name Baize is given to the AI platform to carry the meaning of knowing all things and perceiving wisdom. The platform gathers multi-source compute and intelligent models, adapts to localization and Xinchuang environments, and provides model scheduling plus intelligent routing so complex model access, compute allocation, permission control and usage governance become clear and controllable.'
                )}
              </p>
              <p>
                {t(
                  'Baize AI Platform aims to be the AI Hub foundation for organizations: gather compute, schedule models and connect intelligence, making every AI capability call safe, stable, trusted and well governed.'
                )}
              </p>
            </div>
          </div>
        </AnimateInView>

        <section>
          <AnimateInView className='mb-10 text-center'>
            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
              {t('Core capabilities')}
            </h2>
            <p className='text-muted-foreground mt-2'>
              {t(
                'A trusted AI Hub for localization adaptation, compute access, model scheduling, routing middleware and AI resource governance.'
              )}
            </p>
          </AnimateInView>
          <div className='grid gap-5 md:grid-cols-2 lg:grid-cols-3'>
            {capabilities.map((capability, index) => (
              <AnimateInView
                key={capability.title}
                delay={index * 80}
                animation='fade-up'
              >
                <div className='border-border/40 bg-muted/20 group hover:bg-muted/30 h-full rounded-xl border p-6 transition-colors duration-300'>
                  <div className='mb-4 flex items-center gap-3'>
                    <div className='border-border/40 bg-background flex size-10 items-center justify-center rounded-xl border shadow-sm'>
                      {capability.icon}
                    </div>
                    <h3 className='font-semibold'>{t(capability.title)}</h3>
                  </div>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(capability.desc)}
                  </p>
                </div>
              </AnimateInView>
            ))}
          </div>
        </section>

        <section>
          <AnimateInView className='mb-10 text-center'>
            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
              {t('Who it is for')}
            </h2>
            <p className='text-muted-foreground mt-2'>
              {t(
                'Baize AI Platform is designed for organizational AI adoption and operation scenarios where localization, trust, controllability and reliability matter.'
              )}
            </p>
          </AnimateInView>
          <div className='grid gap-5 md:grid-cols-2'>
            {audiences.map((audience, index) => (
              <AnimateInView
                key={audience.title}
                delay={index * 100}
                animation='fade-up'
              >
                <div className='border-border/40 bg-muted/20 group hover:bg-muted/30 h-full rounded-xl border p-6 transition-colors duration-300'>
                  <div className='mb-3 flex items-center gap-3'>
                    <Route className='text-primary size-5' />
                    <h3 className='font-semibold'>{t(audience.title)}</h3>
                  </div>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(audience.desc)}
                  </p>
                </div>
              </AnimateInView>
            ))}
          </div>
        </section>

        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='flex flex-col gap-6 md:flex-row md:items-start md:gap-10'>
              <div className='shrink-0'>
                <div className='flex size-14 items-center justify-center rounded-2xl border border-emerald-500/15 bg-emerald-500/5'>
                  <Mail className='size-7 text-emerald-500' />
                </div>
              </div>
              <div className='flex-1'>
                <h2 className='text-xl font-bold'>{t('Contact and community')}</h2>
                <p className='text-muted-foreground mt-2 leading-relaxed'>
                  {t(
                    'For deployment questions, model adaptation work, enterprise operation needs or community support, use the project repository and organization channels.'
                  )}
                </p>
                <div className='mt-4 flex flex-wrap gap-4 text-sm'>
                  <a
                    href='https://github.com/BaizorAI/new-api'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary hover:underline'
                  >
                    {t('GitHub repository')}
                  </a>
                  <span className='text-muted-foreground/40'>/</span>
                  <a
                    href='https://github.com/BaizorAI'
                    target='_blank'
                    rel='noopener noreferrer'
                    className='text-primary hover:underline'
                  >
                    {t('BaizorAI community')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </AnimateInView>

        <AnimateInView delay={100} className='text-center'>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-10'>
            <BarChart3 className='text-muted-foreground/50 mx-auto size-10' />
            <h2 className='mt-4 text-2xl font-bold'>
              {t('Use AI capabilities through one trusted AI Hub')}
            </h2>
            <p className='text-muted-foreground mx-auto mt-3 max-w-lg'>
              {t(
                'Connect compute, schedule models, govern usage and provide stable intelligent capabilities for every business scenario.'
              )}
            </p>
            <div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
              <Button className='group rounded-lg' render={<Link to='/docs' />}>
                {t('Read docs')}
                <ArrowRight className='ml-1.5 size-4 transition-transform duration-200 group-hover:translate-x-0.5' />
              </Button>
              <Button
                variant='outline'
                className='border-border/50 hover:border-border hover:bg-muted/50 rounded-lg'
                render={<Link to='/' />}
              >
                {t('Back to home')}
              </Button>
            </div>
          </div>
        </AnimateInView>

        <div className='border-border/30 mt-8 border-t pt-8 text-center text-xs text-muted-foreground/60'>
          <p>
            <a
              href='https://github.com/BaizorAI/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('Baizor API')}
            </a>{' '}
            © {currentYear}{' '}
            <a
              href='https://github.com/BaizorAI'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('BaizorAI')}
            </a>{' '}
            {t('| Based on')} {t('One API')} © 2026 {t('QiMa')}
          </p>
          <p>
            {t('NewAPI')} © {currentYear} {t('QuantumNous')}{' '}
            {t('| Based on')} {t('One API')} © 2023 {t('JustSong')}
          </p>
          <p className='mt-1'>
            {t('This project must be used in compliance with the')}{' '}
            <a
              href='https://github.com/BaizorAI/new-api/blob/main/LICENSE'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('AGPL v3.0 License')}
            </a>
          </p>
          {status?.version && (
            <p className='mt-1'>
              {t('Version')}: {status.version}
            </p>
          )}
        </div>
      </div>
    </PublicLayout>
  )
}

export { About }
