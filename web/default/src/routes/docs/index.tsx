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
import { createFileRoute, Link } from '@tanstack/react-router'
import {
  BarChart3,
  BookOpen,
  Bot,
  Database,
  KeyRound,
  Route as RouteIcon,
  Settings,
  Shield,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { AnimateInView } from '@/components/animate-in-view'
import { PublicLayout } from '@/components/layout'

export const Route = createFileRoute('/docs/')({
  component: DocsPage,
})

const docSections = [
  {
    icon: <BookOpen className='size-5 text-sky-500' />,
    title: 'Start with workspaces',
    desc: 'Choose the place where work happens first: personal work, team collaboration or HermesAgent sessions.',
    items: ['My Teams', 'One-Person Company', 'HermesAgent'],
  },
  {
    icon: <Bot className='size-5 text-teal-500' />,
    title: 'Use skills to repeat good work',
    desc: 'Skills turn repeated prompts, procedures and domain experience into reusable capability for yourself or a team.',
    items: ['My skills', 'Team skills', 'Baizor Skills'],
  },
  {
    icon: <Database className='size-5 text-emerald-500' />,
    title: 'Keep results with the conversation',
    desc: 'Uploaded files, generated documents, exported outputs and conversation context should stay connected to the work that produced them.',
    items: ['Uploaded files', 'Result files', 'Session history'],
  },
  {
    icon: <KeyRound className='size-5 text-violet-500' />,
    title: 'Collaborate as a team',
    desc: 'Team members share sessions, skills and results while owners manage members, roles and team-level permissions.',
    items: ['Shared sessions', 'Team members', 'Team roles'],
  },
  {
    icon: <RouteIcon className='size-5 text-blue-500' />,
    title: 'Models stay in the background',
    desc: 'People work through workspaces and skills. Model permissions, quota and audit stay available when the work needs governance.',
    items: ['Model permissions', 'Quota governance', 'Usage audit'],
  },
  {
    icon: <Settings className='size-5 text-amber-500' />,
    title: 'Private deployment when needed',
    desc: 'Use the online service for fast adoption, then deploy privately when data, network, compliance or dedicated compute boundaries require it.',
    items: ['Online use', 'Private deployment', 'Controlled boundary'],
  },
] as const

const privateDeploymentHighlights = [
  'Online service fits quick evaluation, lightweight team use and cross-organization collaboration.',
  'Private deployment fits data-sensitive, intranet, Xinchuang and dedicated compute scenarios where organizations need controllable AI capability boundaries.',
  'Users still enter through the same workspaces, skills and results even when the deployment moves from online service to private environment.',
  'Private deployment keeps model resources, permissions, quota, audit records and operation signals inside the controlled boundary.',
  'Hermes sidecar fits private agent runtime scenarios where users access agent capabilities through platform workspaces instead of direct service endpoints.',
] as const

function DocsPage() {
  const { t } = useTranslation()

  return (
    <PublicLayout>
      <div className='mx-auto max-w-5xl px-4 py-12 md:py-16'>
        <AnimateInView className='mb-12 text-center'>
          <div className='mb-4 flex justify-center'>
            <div className='flex size-16 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/5'>
              <BookOpen className='size-8 text-blue-500' />
            </div>
          </div>
          <h1 className='text-3xl font-bold tracking-tight md:text-4xl'>
            {t('How to work with Baizor AI Platform')}
          </h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-base'>
            {t(
              'Start from the work you care about: choose a workspace, run skills, share sessions and keep results where the work continues.'
            )}
          </p>
        </AnimateInView>

        <div className='space-y-10'>
          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('Start from user workflows')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <p className='text-muted-foreground leading-relaxed'>
                {t(
                  'Baizor AI Platform is organized around workspaces. A user starts in personal work, team collaboration or HermesAgent, then uses skills and files to finish actual tasks.'
                )}
              </p>
              <p className='text-muted-foreground mt-4 leading-relaxed'>
                {t(
                  'Teams can share conversations, promote useful skills, and keep generated results attached to the work context so knowledge does not disappear in one-off chats.'
                )}
              </p>
              <p className='text-muted-foreground mt-4 leading-relaxed'>
                {t(
                  'Workspace tasks stay first; model access, quota, audit and private deployment support the work when stronger boundaries are needed.'
                )}
              </p>
            </div>
          </section>

          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('What to learn first')}
            </h2>
            <div className='grid gap-4 md:grid-cols-2'>
              {docSections.map((section) => (
                <div
                  key={section.title}
                  className='border-border/40 bg-muted/20 flex flex-col gap-3 rounded-xl border p-5'
                >
                  <div className='flex items-center gap-3'>
                    <div className='border-border/40 bg-background flex size-9 items-center justify-center rounded-lg border'>
                      {section.icon}
                    </div>
                    <h3 className='font-semibold'>{t(section.title)}</h3>
                  </div>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(section.desc)}
                  </p>
                  <ul className='text-muted-foreground list-disc space-y-1 pl-5 text-sm'>
                    {section.items.map((item) => (
                      <li key={item}>{t(item)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('Recommended user onboarding flow')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <ol className='text-muted-foreground list-decimal space-y-3 pl-5 leading-relaxed'>
                <li>
                  <strong className='text-foreground'>
                    {t('Create your workspace')}:&nbsp;
                  </strong>
                  {t(
                    'Start with My Teams, One-Person Company or HermesAgent depending on whether the work is shared, personal or agent-driven.'
                  )}
                </li>
                <li>
                  <strong className='text-foreground'>
                    {t('Run a real task')}:&nbsp;
                  </strong>
                  {t(
                    'Upload relevant files, ask the agent to produce a result, and keep the output attached to the session.'
                  )}
                </li>
                <li>
                  <strong className='text-foreground'>
                    {t('Turn repeated work into a skill')}:&nbsp;
                  </strong>
                  {t(
                    'When a prompt or workflow works well, save it as a personal skill and refine it through reuse.'
                  )}
                </li>
                <li>
                  <strong className='text-foreground'>
                    {t('Share with a team')}:&nbsp;
                  </strong>
                  {t(
                    'Promote useful skills to team skills, pin important team sessions, and let members reuse proven workflows.'
                  )}
                </li>
                <li>
                  <strong className='text-foreground'>
                    {t('Keep team boundaries clear when needed')}:&nbsp;
                  </strong>
                  {t(
                    'Set members, roles, model access and cost policies when the work needs them, then keep the day-to-day flow centered on shared sessions, skills and results.'
                  )}
                </li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('HermesAgent in team work')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <div className='mb-4 flex items-center gap-2'>
                <Bot className='size-5 text-teal-500' />
                <h3 className='font-semibold'>
                  {t('Use HermesAgent through platform workspaces')}
                </h3>
              </div>
              <p className='text-muted-foreground mb-4 leading-relaxed'>
                {t(
                  'HermesAgent should feel like a workbench, not a raw service endpoint. Users create sessions, call skills, attach files, produce results and share reusable workflows through the platform.'
                )}
              </p>
              <ul className='text-muted-foreground list-disc space-y-2 pl-5 leading-relaxed'>
                <li>
                  {t(
                    'In the product, HermesAgent appears inside personal and team workspaces so people can start from sessions, skills, files and results.'
                  )}
                </li>
                <li>
                  {t(
                    'Team sessions should follow team membership, roles, quota boundaries and audit requirements.'
                  )}
                </li>
                <li>
                  {t(
                    'When an agent workflow becomes repeatable, save it as a skill and decide whether it belongs to personal, team or Baizor shared skills.'
                  )}
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('Private deployment as a continuation of the same workflow')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <div className='mb-4 flex items-center gap-2'>
                <Database className='size-5 text-blue-500' />
                <h3 className='font-semibold'>
                  {t('Online first, private when required')}
                </h3>
              </div>
              <p className='text-muted-foreground mb-4 leading-relaxed'>
                {t(
                  'Private deployment should not change how users work. The same workspaces, sessions, skills and results remain the front door; the deployment only changes where data, model resources and governance records live.'
                )}
              </p>
              <ul className='text-muted-foreground list-disc space-y-2 pl-5 leading-relaxed'>
                {privateDeploymentHighlights.map((item) => (
                  <li key={item}>{t(item)}</li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('For team setup and governance')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <div className='grid gap-4 md:grid-cols-3'>
                <div>
                  <KeyRound className='mb-2 size-5 text-emerald-500' />
                  <h3 className='mb-1 font-semibold'>
                    {t('Model access setup')}
                  </h3>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(
                      'Connect the model capabilities your teams need after the workspace flow is clear.'
                    )}
                  </p>
                </div>
                <div>
                  <BarChart3 className='mb-2 size-5 text-amber-500' />
                  <h3 className='mb-1 font-semibold'>
                    {t('Skill and workflow operations')}
                  </h3>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(
                      'Maintain personal, team and Baizor shared skills so useful work patterns stay reusable.'
                    )}
                  </p>
                </div>
                <div>
                  <Shield className='mb-2 size-5 text-violet-500' />
                  <h3 className='mb-1 font-semibold'>
                    {t('Collaboration boundaries')}
                  </h3>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(
                      'Apply account security, billing, model access, audit or deployment controls when a team needs stronger boundaries.'
                    )}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6 text-sm'>
              <p className='text-muted-foreground leading-relaxed'>
                {t(
                  'Need the product-level requirements? Read the PRD in the repository docs directory for scope, user stories, implementation decisions and testing decisions.'
                )}{' '}
                <Link to='/about' className='text-primary hover:underline'>
                  {t('About Baizor AI Platform')}
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  )
}
