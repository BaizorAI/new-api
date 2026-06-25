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
  Bot,
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
    title: 'Workspaces for real work',
    desc: 'Personal, team and HermesAgent workspaces keep conversations, files, skills and results connected to the task.',
  },
  {
    icon: <GitBranch className='size-5 text-violet-500' />,
    title: 'Skills that teams can improve',
    desc: 'Useful workflows can move from personal practice to team skills or Baizor shared skills, turning experience into reusable capability.',
  },
  {
    icon: <WalletCards className='size-5 text-emerald-500' />,
    title: 'Shared sessions and results',
    desc: 'Team members can collaborate around shared conversations, generated documents, uploaded files and exported outcomes.',
  },
  {
    icon: <Shield className='size-5 text-amber-500' />,
    title: 'Governance behind the scenes',
    desc: 'Model channels, quota, billing, access keys, roles and audit records stay available for administrators without overwhelming ordinary users.',
  },
  {
    icon: <Database className='size-5 text-cyan-500' />,
    title: 'Private deployment path',
    desc: 'Organizations can start online and move to private deployment when data, network, compliance or dedicated compute boundaries require it.',
  },
  {
    icon: <Bot className='size-5 text-teal-500' />,
    title: 'HermesAgent work partner',
    desc: 'HermesAgent helps users run repeatable work, refine skills and keep agent sessions available across personal and team workspaces.',
  },
] as const

const audiences = [
  {
    title: 'People doing daily knowledge work',
    desc: 'Research, write, summarize, compare, generate documents and keep useful workflows as skills for next time.',
  },
  {
    title: 'Teams that need shared AI capability',
    desc: 'Collaborate through team sessions, shared results and team skills instead of isolated one-off chats.',
  },
  {
    title: 'Operators and administrators',
    desc: 'Keep model access, quota, billing, users, roles, audit and deployment controls in management areas.',
  },
  {
    title: 'Organizations with private deployment needs',
    desc: 'Keep the same user workflow while moving data, model resources and operational records into a controlled boundary.',
  },
] as const

const stats = [
  { num: '3', label: 'workspace modes' },
  { num: '4', label: 'shared skill workflows' },
  { num: '3', label: 'result-centered views' },
  { num: '4', label: 'management safeguards' },
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
              'Baize AI Platform helps people and teams work with AI through workspaces, reusable skills, shared sessions and result files, while model access and governance stay controlled in the background.'
            )}
          </p>
          <div className='mt-8 flex flex-wrap items-center justify-center gap-3'>
            <Button className='group rounded-lg' render={<Link to='/docs' />}>
              {t('See how it works')}
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
                  <div className='text-foreground text-3xl font-bold tracking-tight'>
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
                <h2 className='text-xl font-bold'>{t('How people use it')}</h2>
                <div className='text-muted-foreground mt-2 space-y-3 leading-relaxed'>
                  <p>
                    {t(
                      'Users should not have to start from channels, keys or routing rules. They start from a workspace: personal work, team work or HermesAgent.'
                    )}
                  </p>
                  <p>
                    {t(
                      'Inside a workspace, conversations, attachments, reusable skills and final outputs stay connected to the task so good work can be repeated and shared.'
                    )}
                  </p>
                  <p>
                    {t(
                      'When governance is required, administrators manage members, roles, model access, quota, billing and audit from management areas.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </AnimateInView>

        <AnimateInView delay={100}>
          <div className='border-border/40 bg-muted/20 rounded-2xl border p-8 md:p-10'>
            <div className='flex flex-col gap-6 md:flex-row md:items-start md:gap-10'>
              <div className='shrink-0'>
                <div className='flex size-14 items-center justify-center rounded-2xl border border-teal-500/15 bg-teal-500/5'>
                  <Bot className='size-7 text-teal-500' />
                </div>
              </div>
              <div className='flex-1'>
                <h2 className='text-xl font-bold'>
                  {t('HermesAgent in the product experience')}
                </h2>
                <div className='text-muted-foreground mt-2 space-y-3 leading-relaxed'>
                  <p>
                    {t(
                      'HermesAgent is presented as a work partner inside the platform: users create sessions, attach files, call skills, produce results and keep improving useful workflows.'
                    )}
                  </p>
                  <p>
                    {t(
                      'For operators, Hermes can still run as a sidecar and use platform-governed model access, quotas and audit records. For users, the entry stays simple.'
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
                    'Make AI work reusable: help individuals finish tasks, help teams share and improve skills, and help organizations keep governance under control.'
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
                  {t('Why Baize')}
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
                  'Today, the name Baize is given to the AI platform to carry the meaning of knowing all things and perceiving wisdom. The platform gathers models, tools, skills and workspaces so complex AI capability becomes usable, shareable and governable.'
                )}
              </p>
              <p>
                {t(
                  'Baize AI Platform aims to become the workbench where people collaborate with AI, improve skills together and turn successful work into reusable team capability.'
                )}
              </p>
            </div>
          </div>
        </AnimateInView>

        <section>
          <AnimateInView className='mb-10 text-center'>
            <h2 className='text-2xl font-bold tracking-tight md:text-3xl'>
              {t('What the platform foregrounds')}
            </h2>
            <p className='text-muted-foreground mt-2'>
              {t(
                'Workspaces, skills, shared sessions and results are first. Technical controls are still available, but they live where operators expect them.'
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
                'Baize AI Platform is designed for users who need useful AI work today and teams that need those workflows to become shared capability tomorrow.'
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
                <h2 className='text-xl font-bold'>
                  {t('Contact and community')}
                </h2>
                <p className='text-muted-foreground mt-2 leading-relaxed'>
                  {t(
                    'For workspace adoption, private deployment, HermesAgent integration, model governance or community support, use the project repository and organization channels.'
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
              {t('Build shared AI capability from everyday work')}
            </h2>
            <p className='text-muted-foreground mx-auto mt-3 max-w-lg'>
              {t(
                'Start with one useful result, save the repeatable method as a skill, and let the team improve it together.'
              )}
            </p>
            <div className='mt-6 flex flex-wrap items-center justify-center gap-3'>
              <Button className='group rounded-lg' render={<Link to='/docs' />}>
                {t('See how it works')}
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

        <div className='border-border/30 text-muted-foreground/60 mt-8 border-t pt-8 text-center text-xs'>
          <p>
            <a
              href='https://github.com/BaizorAI/new-api'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('Baizor API')}
            </a>{' '}
            {'\u00a9'} {currentYear}{' '}
            <a
              href='https://github.com/BaizorAI'
              target='_blank'
              rel='noopener noreferrer'
              className='text-primary hover:underline'
            >
              {t('BaizorAI')}
            </a>{' '}
            {t('| Based on')} {t('One API')} {'\u00a9'} 2026 {t('QiMa')}
          </p>
          <p>
            {t('NewAPI')} {'\u00a9'} {currentYear} {t('QuantumNous')} {t('| Based on')}{' '}
            {t('One API')} {'\u00a9'} 2023 {t('JustSong')}
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
