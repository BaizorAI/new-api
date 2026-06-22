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
  WalletCards,
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
    title: 'AI user guide',
    desc: 'Start from business scenarios, authorized applications, model use and operational visibility instead of underlying model differences.',
    items: ['Choose business scenarios', 'Authorize applications', 'Observe AI usage'],
  },
  {
    icon: <RouteIcon className='size-5 text-blue-500' />,
    title: 'Platform overview',
    desc: 'Understand how Baize AI Platform connects applications, model services, routing policy and governance in one operating layer.',
    items: ['Platform positioning', 'Capability supply model', 'Unified governance layer'],
  },
  {
    icon: <Settings className='size-5 text-violet-500' />,
    title: 'Localization and Xinchuang adaptation',
    desc: 'Plan private, intranet and trusted deployments for localized infrastructure and Xinchuang-oriented environments.',
    items: ['Private and intranet deployment', 'Localized infrastructure readiness', 'Trusted operation requirements'],
  },
  {
    icon: <Database className='size-5 text-emerald-500' />,
    title: 'Compute and model access',
    desc: 'Connect multi-source compute, private model services and external intelligent models through one governed capability pool.',
    items: ['Multi-source compute access', 'Private model services', 'External intelligent models'],
  },
  {
    icon: <Bot className='size-5 text-teal-500' />,
    title: 'Hermes sidecar multi-user scenario',
    desc: 'Run Hermes in a separate container and publish it as a governed platform model for teams, applications and business users.',
    items: ['Internal sidecar service', 'Platform model exposure', 'Team quota and audit'],
  },
  {
    icon: <BarChart3 className='size-5 text-amber-500' />,
    title: 'Model scheduling and routing middleware',
    desc: 'Configure priority, weight, tags, grouping, health checks, fallback strategy and transparent routing behavior.',
    items: ['Model scheduling policies', 'Routing middleware strategy', 'Health and fallback controls'],
  },
  {
    icon: <WalletCards className='size-5 text-cyan-500' />,
    title: 'Permission, quota and security governance',
    desc: 'Manage users, application credentials, access boundaries, quota allocation, usage records and security audit flows.',
    items: ['User and credential management', 'Quota and usage governance', 'Security audit records'],
  },
  {
    icon: <Shield className='size-5 text-rose-500' />,
    title: 'Private deployment capability',
    desc: 'Use Baize AI Platform online, or deploy it privately inside the organization so data, permissions, model resources and operational signals stay within a controlled boundary.',
    items: ['Online use', 'Private deployment', 'Digital employee foundation'],
  },
] as const

const privateDeploymentHighlights = [
  'Online service fits quick evaluation, lightweight team use and cross-organization collaboration.',
  'Private deployment fits data-sensitive, intranet, Xinchuang and dedicated compute scenarios where organizations need controllable AI capability boundaries.',
  'Hermes sidecar fits private agent runtime scenarios where users should access agent capabilities through platform credentials, model permissions, quotas and logs.',
  'A digital employee is not a single chatbot. It is an AI work unit composed of models, knowledge, tools, permissions, workflows, memory, audit records and operational policies.',
  'Baize AI Platform provides the AI Hub layer for digital employees: connect compute and models, govern access, dispatch the right capability, observe usage and keep business execution traceable.',
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
            {t('Baize AI Platform documentation')}
          </h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-2xl text-base'>
            {t(
              'A practical guide for AI users to use Baize AI Platform across trusted operations, localization adaptation, model scheduling, unified compute access and intelligent routing governance.'
            )}
          </p>
        </AnimateInView>

        <div className='space-y-10'>
          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('Platform overview')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <p className='text-muted-foreground leading-relaxed'>
                {t(
                  'Baize AI Platform supports both online access and private deployment. Online access is suitable for evaluation, lightweight team use and cross-organization collaboration.'
                )}
              </p>
              <p className='text-muted-foreground mt-4 leading-relaxed'>
                {t(
                  'Private deployment is designed for organizations that need data, permissions, model resources and operational records to remain inside their own controlled boundary.'
                )}
              </p>
              <p className='text-muted-foreground mt-4 leading-relaxed'>
                {t(
                  'The same control plane manages model access, routing, quotas, audit logs and operational visibility, so teams can move from trial use to private deployment without changing core workflows.'
                )}
              </p>
            </div>
          </section>

          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('Documentation map')}
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
              {t('Private deployment and onboarding flow')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <ol className='text-muted-foreground list-decimal space-y-3 pl-5 leading-relaxed'>
                <li>
                  <strong className='text-foreground'>
                    {t('Confirm deployment baseline')}:&nbsp;
                  </strong>
                  {t(
                    'Choose private, intranet or public-facing deployment mode, then configure database, cache and health-check settings.'
                  )}
                </li>
                <li>
                  <strong className='text-foreground'>
                    {t('Connect compute and model services')}:&nbsp;
                  </strong>
                  {t(
                    'Add localized compute, private models and external intelligent models, then organize them by business scope and capability type.'
                  )}
                </li>
                <li>
                  <strong className='text-foreground'>
                    {t('Configure scheduling middleware')}:&nbsp;
                  </strong>
                  {t(
                    'Set model priorities, weights, tags, groups, health rules and fallback strategies for reliable model dispatch.'
                  )}
                </li>
                <li>
                  <strong className='text-foreground'>
                    {t('Set governance rules')}:&nbsp;
                  </strong>
                  {t(
                    'Create users and application credentials with quota boundaries, model permissions, access policies and audit requirements.'
                  )}
                </li>
                <li>
                  <strong className='text-foreground'>
                    {t('Monitor operations')}:&nbsp;
                  </strong>
                  {t(
                    'Review usage data, request logs, model service health, performance metrics, cache state and security audit records.'
                  )}
                </li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('Hermes sidecar multi-user scenario')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <div className='mb-4 flex items-center gap-2'>
                <Bot className='size-5 text-teal-500' />
                <h3 className='font-semibold'>
                  {t('Use Hermes through platform models')}
                </h3>
              </div>
              <p className='text-muted-foreground mb-4 leading-relaxed'>
                {t(
                  'Hermes can run as an internal sidecar container and be added to the platform as an OpenAI-compatible model service. Users call the platform model, while the Hermes service remains inside the Docker network.'
                )}
              </p>
              <ul className='text-muted-foreground list-disc space-y-2 pl-5 leading-relaxed'>
                <li>
                  {t(
                    'Expose Hermes only to the internal Docker network, then configure a platform channel with the base URL http://hermes:8642/v1.'
                  )}
                </li>
                <li>
                  {t(
                    'Give users and teams access through platform keys, model permissions, quotas, IP restrictions and audit logs.'
                  )}
                </li>
                <li>
                  {t(
                    'When Hermes needs a foundation model, configure it to call the platform endpoint with a dedicated service account or team key.'
                  )}
                </li>
              </ul>
            </div>
          </section>

          <section>
            <h2 className='mb-4 text-xl font-bold'>
              {t('Private deployment as a product capability')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <div className='mb-4 flex items-center gap-2'>
                <Database className='size-5 text-blue-500' />
                <h3 className='font-semibold'>
                  {t('Online use and private deployment')}
                </h3>
              </div>
              <p className='text-muted-foreground mb-4 leading-relaxed'>
                {t(
                  'Private deployment is a product feature, not only an operations choice. It lets organizations build digital employees on a controlled AI Hub while keeping data, permissions, model resources and operational evidence inside their own governance boundary.'
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
              {t('Implementation extension points')}
            </h2>
            <div className='border-border/40 bg-muted/20 rounded-xl border p-6'>
              <div className='grid gap-4 md:grid-cols-3'>
                <div>
                  <KeyRound className='mb-2 size-5 text-emerald-500' />
                  <h3 className='mb-1 font-semibold'>{t('Model service adaptation')}</h3>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(
                      'Add model request conversion, response handling, usage extraction and localized compute adaptation without changing business applications.'
                    )}
                  </p>
                </div>
                <div>
                  <BarChart3 className='mb-2 size-5 text-amber-500' />
                  <h3 className='mb-1 font-semibold'>{t('Scheduling policies')}</h3>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(
                      'Extend priority, weight, tag, group, health and fallback rules as model service requirements evolve.'
                    )}
                  </p>
                </div>
                <div>
                  <Shield className='mb-2 size-5 text-violet-500' />
                  <h3 className='mb-1 font-semibold'>{t('Safety boundaries')}</h3>
                  <p className='text-muted-foreground text-sm leading-relaxed'>
                    {t(
                      'Preserve protected project identity, keep JSON handling and database compatibility rules, and test externally visible behavior.'
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
                  {t('About Baize AI Platform')}
                </Link>
              </p>
            </div>
          </section>
        </div>
      </div>
    </PublicLayout>
  )
}
