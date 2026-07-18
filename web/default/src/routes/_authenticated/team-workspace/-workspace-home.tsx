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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clapperboard,
  FileCheck2,
  FileText,
  ListChecks,
  Loader2,
  MessageSquare,
  Sparkles,
  Wallet,
  XCircle,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  listHermesExecutionTasks,
  listHermesSkills,
  type HermesExecutionTask,
  type HermesExecutionTaskStatus,
  type HermesSkill,
} from '@/features/hermes-playground/api'
import {
  formatSessionTime,
  getHermesBaseScope,
  loadHermesConversations,
  sortSessions,
  type HermesConversation,
} from '@/features/hermes-playground/sessions'
import {
  createPlaygroundStorageKeys,
  loadMessages,
} from '@/features/playground/lib'
import {
  extractHermesFileArtifacts,
  renderHermesDataPathsAsLinks,
} from '@/features/playground/lib/hermes-file-links'
import { parseThinkTags } from '@/features/playground/lib/message-utils'
import type { Message } from '@/features/playground/types'
import { getSelf } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

type SessionItem = {
  id: string
  title: string
  href: '/team-workspace' | '/hermes-playground' | '/one-person-company'
  search?: {
    team_id?: number
    panel?: 'sessions' | 'results' | 'skills' | 'messages' | 'tasks'
  }
  teamName?: string
  updatedAt: number
}

type ResultItem = {
  id: string
  title: string
  kind: string
  href: '/team-workspace' | '/hermes-playground' | '/one-person-company'
  search?: {
    team_id?: number
    panel?: 'sessions' | 'results' | 'skills' | 'messages' | 'tasks'
  }
  sourceTitle?: string
  teamName?: string
  updatedAt: number
}

export function WorkspaceHome() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const userId = user?.id

  const selfQuery = useQuery({
    queryKey: ['workspace-home', 'self'],
    queryFn: () => getSelf({ silent: true }).catch(() => null),
    staleTime: 15_000,
  })
  const personalSkillsQuery = useQuery({
    queryKey: ['workspace-home', 'skills', 'personal'],
    queryFn: () => listHermesSkills().catch(() => []),
    staleTime: 30_000,
  })
  const tasksQuery = useQuery({
    queryKey: ['workspace-home', 'tasks'],
    queryFn: () => listHermesExecutionTasks({ limit: 5 }).catch(() => []),
    staleTime: 10_000,
  })

  const personalSessions = useMemo<SessionItem[]>(() => {
    if (!userId || typeof window === 'undefined') return []
    const hermesBase = getHermesBaseScope(userId, 'hermes')
    const companyBase = getHermesBaseScope(userId, 'one_person_company')
    return [
      ...toSessionItems(
        loadHermesConversations(hermesBase),
        '/hermes-playground'
      ),
      ...toSessionItems(
        loadHermesConversations(companyBase),
        '/one-person-company'
      ),
    ]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6)
  }, [userId])

  const tasks = tasksQuery.data ?? []

  const skills = personalSkillsQuery.data ?? []
  const recentSkills = skills
    .filter((skill) => skill.ownerScope === 'user' || skill.source === 'user')
    .slice(0, 4)
  const baizorSkills = skills
    .filter(
      (skill) => skill.ownerScope === 'baizor' || skill.source === 'baizor'
    )
    .slice(0, 4)

  const latestResults = useMemo<ResultItem[]>(() => {
    if (typeof window === 'undefined' || !userId) return []
    return [
      ...toPersonalResults(
        loadHermesConversations(getHermesBaseScope(userId, 'hermes')),
        '/hermes-playground'
      ),
      ...toPersonalResults(
        loadHermesConversations(
          getHermesBaseScope(userId, 'one_person_company')
        ),
        '/one-person-company'
      ),
    ]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6)
  }, [userId])

  const quota = Number(selfQuery.data?.data?.quota ?? user?.quota ?? 0)
  const quotaState = getQuotaState(quota)

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Home')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto max-w-7xl space-y-4'>
          <section className='bg-primary/5 border-primary/10 rounded-xl border p-5 sm:p-6'>
            <div className='flex flex-col gap-4 md:flex-row md:items-center md:justify-between'>
              <div>
                <h1 className='text-xl font-semibold tracking-tight'>
                  {t('Let AI handle your tasks')}
                </h1>
                <p className='text-muted-foreground mt-1 max-w-xl text-sm'>
                  {t(
                    'Describe what you need, and AI will plan, execute, and deliver results.'
                  )}
                </p>
              </div>
              <Button render={<Link to='/hermes-playground' />}>
                <Sparkles data-icon='inline-start' />
                {t('Start a new task')}
              </Button>
            </div>
          </section>

          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-4'>
            <QuickActionCard
              icon={<MessageSquare className='size-4' />}
              title={t('Ask AI to do a task')}
              description={t(
                'Start with a real task, then keep the conversation and files together.'
              )}
              action={t('Start task')}
              to='/hermes-playground'
            />
            <QuickActionCard
              icon={<Clapperboard className='size-4' />}
              title={t('Film Studio')}
              description={t(
                'Create images, videos, film projects and manage assets.'
              )}
              action={t('Enter Film Studio')}
              to='/image-playground'
            />
            <QuickActionCard
              icon={<FileCheck2 className='size-4' />}
              title={t('Find results')}
              description={t(
                'Open recent reports, slides, documents and attached file results.'
              )}
              action={t('View results')}
              to='/hermes-playground'
              search={{ panel: 'results' }}
            />
            <QuickActionCard
              icon={<BookOpen className='size-4' />}
              title={t('Blog Hall')}
              description={t(
                'Write, edit and publish articles to Blog Hall.'
              )}
              action={t('Write a blog')}
              to='/blog-hall'
            />
          </div>

          <div className='grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]'>
            <div className='space-y-4'>
              <Panel
                icon={<ListChecks className='size-4' />}
                title={t('My tasks')}
                description={t(
                  'View your running, completed and failed tasks.'
                )}
              >
                {tasks.length > 0 ? (
                  <TaskList items={tasks} />
                ) : (
                  <EmptyLine text={t('No running tasks yet')} />
                )}
                <div className='mt-3'>
                  <Button
                    variant='ghost'
                    size='sm'
                    render={
                      <Link
                        to='/hermes-playground'
                        search={{ panel: 'tasks' }}
                      />
                    }
                  >
                    {t('View all tasks')}
                    <ArrowRight data-icon='inline-end' />
                  </Button>
                </div>
              </Panel>

              <Panel
                icon={<MessageSquare className='size-4' />}
                title={t('Continue work')}
                description={t(
                  'Pick up recent personal conversations.'
                )}
              >
                <SessionList
                  emptyText={t('No recent personal sessions yet')}
                  items={personalSessions}
                  title={t('Personal sessions')}
                />
              </Panel>

              <Panel
                icon={<FileCheck2 className='size-4' />}
                title={t('Latest results')}
                description={t('Reports, slides, documents and file results.')}
              >
                {latestResults.length > 0 ? (
                  <div className='grid gap-3 md:grid-cols-2'>
                    {latestResults.map((item) => (
                      <ResultCard key={item.id} item={item} />
                    ))}
                  </div>
                ) : (
                  <EmptyLine text={t('No result files yet')} />
                )}
              </Panel>

              <Panel
                icon={<Sparkles className='size-4' />}
                title={t('Skill Store')}
                description={t(
                  'Choose proven skills by scenario and reuse them in your work.'
                )}
              >
                <TaskScenarioGrid />
                <div className='mt-3 grid gap-3 md:grid-cols-2'>
                  <SkillList
                    emptyText={t('Used skills will appear here')}
                    skills={recentSkills}
                    title={t('Recently used')}
                  />
                  <SkillList
                    emptyText={t('No Baizor shared skills yet')}
                    skills={baizorSkills}
                    title={t('Baizor shared skills')}
                  />
                </div>
              </Panel>
            </div>

            <aside className='space-y-4'>
              <Panel
                icon={<Wallet className='size-4' />}
                title={t('Balance status')}
                description={t('Only show whether work can continue today.')}
              >
                <div className='space-y-3'>
                  <div className='bg-background rounded-lg border p-3'>
                    <div className='flex items-center justify-between gap-3'>
                      <div>
                        <div className='text-sm font-medium'>
                          {t(quotaState.title)}
                        </div>
                        <div className='text-muted-foreground mt-1 text-xs'>
                          {t(quotaState.description)}
                        </div>
                      </div>
                      <Badge variant={quotaState.variant}>
                        {t(quotaState.badge)}
                      </Badge>
                    </div>
                  </div>
                  <div className='text-muted-foreground bg-muted/20 rounded-lg border p-3 text-sm leading-relaxed'>
                    <p>{t('Current work is paid by your personal wallet.')}</p>
                  </div>
                  <Button className='w-full' render={<Link to='/wallet/topup' />}>
                    {t('Top up')}
                    <ArrowRight data-icon='inline-end' />
                  </Button>
                </div>
              </Panel>
            </aside>
          </div>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function QuickActionCard(props: {
  icon: React.ReactNode
  title: string
  description: string
  action: string
  to: '/team-workspace' | '/hermes-playground' | '/image-playground' | '/blog-hall'
  search?: {
    team_id?: number
    panel?: 'sessions' | 'results' | 'skills' | 'messages' | 'tasks'
  }
}) {
  const content = <QuickActionCardContent {...props} />

  if (!props.search) {
    return (
      <Link
        to={props.to}
        className='group bg-background hover:bg-muted/30 flex min-h-36 flex-col justify-between rounded-xl border p-4 transition-colors'
      >
        {content}
      </Link>
    )
  }

  return (
    <Link
      to={props.to}
      search={props.search}
      className='group bg-background hover:bg-muted/30 flex min-h-36 flex-col justify-between rounded-xl border p-4 transition-colors'
    >
      {content}
    </Link>
  )
}

function QuickActionCardContent(props: {
  icon: React.ReactNode
  title: string
  description: string
  action: string
}) {
  return (
    <>
      <div className='space-y-3'>
        <div className='bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg'>
          {props.icon}
        </div>
        <div>
          <h2 className='text-sm font-semibold'>{props.title}</h2>
          <p className='text-muted-foreground mt-1 line-clamp-2 text-sm leading-relaxed'>
            {props.description}
          </p>
        </div>
      </div>
      <div className='text-primary mt-4 flex items-center gap-1 text-sm font-medium'>
        {props.action}
        <ArrowRight className='size-4 transition-transform group-hover:translate-x-0.5' />
      </div>
    </>
  )
}

function Panel(props: {
  icon: React.ReactNode
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className='bg-background rounded-xl border p-4 shadow-xs'>
      <div className='mb-4 flex items-start gap-3'>
        <div className='bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg'>
          {props.icon}
        </div>
        <div className='min-w-0'>
          <h2 className='font-semibold'>{props.title}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            {props.description}
          </p>
        </div>
      </div>
      {props.children}
    </section>
  )
}

function SessionList(props: {
  title: string
  items: SessionItem[]
  emptyText: string
}) {
  return (
    <div className='bg-muted/10 rounded-lg border p-3'>
      <div className='mb-2 text-sm font-medium'>{props.title}</div>
      <div className='space-y-2'>
        {props.items.length > 0 ? (
          props.items.map((item) => <SessionCard key={item.id} item={item} />)
        ) : (
          <EmptyLine text={props.emptyText} />
        )}
      </div>
    </div>
  )
}

function SessionCard(props: { item: SessionItem }) {
  const { t } = useTranslation()
  const { item } = props
  const title = item.title || t('New session')
  return (
    <Link
      to={item.href}
      search={item.search}
      className='bg-background hover:bg-muted/30 block rounded-lg border p-3 transition-colors'
    >
      <div className='flex items-start justify-between gap-3'>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>{title}</div>
          <div className='text-muted-foreground mt-1 text-xs'>
            {props.item.teamName
              ? props.item.teamName
              : t('Updated {{time}}', {
                  time: formatSessionTime(props.item.updatedAt, t('Just now')),
                })}
          </div>
        </div>
        <ArrowRight className='text-muted-foreground mt-0.5 size-4 shrink-0' />
      </div>
    </Link>
  )
}

function TaskList(props: { items: HermesExecutionTask[] }) {
  return (
    <div className='space-y-2'>
      {props.items.map((item) => (
        <TaskCard key={item.taskId} item={item} />
      ))}
    </div>
  )
}

function TaskCard(props: { item: HermesExecutionTask }) {
  const { t } = useTranslation()
  const { item } = props
  const title = item.title || t('Untitled task')
  const statusMeta = getTaskStatusMeta(item.status, t)
  const StatusIcon = statusMeta.icon

  return (
    <Link
      to='/hermes-playground'
      search={{ panel: 'tasks' }}
      className='bg-background hover:bg-muted/30 flex items-center justify-between rounded-lg border p-3 transition-colors'
    >
      <div className='flex items-center gap-3 min-w-0'>
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${statusMeta.bgColor}`}>
          <StatusIcon className={`size-4 ${statusMeta.color}`} />
        </div>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>{title}</div>
          <div className='text-muted-foreground mt-1 text-xs'>
            {formatSessionTime(item.updatedAt, t('Just now'))} · {t(statusMeta.label)}
          </div>
        </div>
      </div>
      <ArrowRight className='text-muted-foreground mt-0.5 size-4 shrink-0' />
    </Link>
  )
}

function getTaskStatusMeta(
  status: HermesExecutionTaskStatus,
  t: (key: string) => string
) {
  switch (status) {
    case 'running':
      return {
        icon: Loader2,
        label: t('Running'),
        color: 'text-blue-600',
        bgColor: 'bg-blue-50',
      }
    case 'succeeded':
      return {
        icon: CheckCircle2,
        label: t('Completed'),
        color: 'text-emerald-600',
        bgColor: 'bg-emerald-50',
      }
    case 'failed':
      return {
        icon: XCircle,
        label: t('Failed'),
        color: 'text-red-600',
        bgColor: 'bg-red-50',
      }
    case 'canceled':
      return {
        icon: XCircle,
        label: t('Canceled'),
        color: 'text-slate-600',
        bgColor: 'bg-slate-100',
      }
    case 'queued':
    default:
      return {
        icon: CheckCircle2,
        label: t('Queued'),
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
      }
  }
}

function TaskScenarioGrid() {
  const { t } = useTranslation()
  const scenarios = [
    'PPT and presentations',
    'Research reports',
    'Data analysis',
    'Document writing',
    'Image and video generation',
  ]

  return (
    <div className='flex flex-wrap gap-2'>
      {scenarios.map((scenario) => (
        <Link
          key={scenario}
          to='/hermes-playground'
          className='bg-muted/30 text-muted-foreground hover:bg-muted/50 rounded-full border px-3 py-1 text-xs font-medium transition-colors'
        >
          {t(scenario)}
        </Link>
      ))}
    </div>
  )
}

function SkillList(props: {
  title: string
  skills: HermesSkill[]
  emptyText: string
}) {
  return (
    <div className='bg-muted/10 rounded-lg border p-3'>
      <div className='mb-2 text-sm font-medium'>{props.title}</div>
      <div className='space-y-2'>
        {props.skills.length > 0 ? (
          props.skills.map((skill) => (
            <div
              key={`${skill.ownerScope}-${skill.name}`}
              className='bg-background rounded-lg border p-3'
            >
              <div className='truncate text-sm font-medium'>{skill.displayName || skill.name}</div>
              {skill.description ? (
                <div className='text-muted-foreground mt-1 line-clamp-2 text-xs'>
                  {skill.description}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <EmptyLine text={props.emptyText} />
        )}
      </div>
    </div>
  )
}

function ResultCard(props: { item: ResultItem }) {
  const { t } = useTranslation()
  const { item } = props
  const context = [item.teamName, item.sourceTitle].filter(Boolean).join(' / ')

  return (
    <Link
      to={item.href}
      search={item.search}
      className='bg-background hover:bg-muted/30 block rounded-lg border p-3 transition-colors'
    >
      <div className='flex items-start gap-3'>
        <div className='bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg'>
          <FileText className='size-4' />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <Badge variant='secondary'>{t(item.kind)}</Badge>
            <span className='text-muted-foreground text-xs'>
              {formatSessionTime(item.updatedAt, t('Just now'))}
            </span>
          </div>
          <div className='mt-2 truncate text-sm font-medium'>
            {item.title || t('Untitled result')}
          </div>
          {context ? (
            <div className='text-muted-foreground mt-1 truncate text-xs'>
              {context}
            </div>
          ) : null}
        </div>
      </div>
    </Link>
  )
}

function EmptyLine(props: { text: string }) {
  return (
    <div className='text-muted-foreground bg-muted/10 rounded-lg border border-dashed p-3 text-sm'>
      {props.text}
    </div>
  )
}

function toSessionItems(
  sessions: HermesConversation[],
  href: '/hermes-playground' | '/one-person-company'
): SessionItem[] {
  return sortSessions(sessions).map((session) => ({
    id: `${href}-${session.id}`,
    title: session.title,
    href,
    updatedAt: session.updatedAt,
  }))
}

function toPersonalResults(
  sessions: HermesConversation[],
  href: '/hermes-playground' | '/one-person-company'
): ResultItem[] {
  return sessions.flatMap((session) => {
    const messages =
      loadMessages(createPlaygroundStorageKeys(session.storageScope)) ?? []
    return toResultItems(session, messages, { href })
  })
}

function toResultItems(
  session: HermesConversation,
  messages: Message[],
  target: {
    href: '/team-workspace' | '/hermes-playground' | '/one-person-company'
    search?: {
      team_id?: number
      panel?: 'sessions' | 'results' | 'skills' | 'messages' | 'tasks'
    }
    teamName?: string
  }
): ResultItem[] {
  const safeMessages = messages.filter(isMessageLike)
  const assistantMessages = safeMessages.filter(
    (message) => message.from === 'assistant'
  )
  const fileResults = [
    ...extractAssistantResultFiles(session, assistantMessages, target),
    ...safeMessages
      .flatMap((message) => message.attachments ?? [])
      .filter(isAttachmentLike)
      .map((attachment, index) => ({
        id: `${target.href}-${session.id}-file-${index}`,
        title: attachment.filename || session.title,
        kind: getResultKind(attachment.filename),
        href: target.href,
        search: target.search,
        sourceTitle: session.title,
        teamName: target.teamName,
        updatedAt: session.updatedAt,
      })),
  ]

  if (fileResults.length > 0) return fileResults
  if (assistantMessages.length === 0) return []
  return [
    {
      id: `${target.href}-${session.id}-document`,
      title: session.title,
      kind: 'Document',
      href: target.href,
      search: target.search,
      sourceTitle: session.title,
      teamName: target.teamName,
      updatedAt: session.updatedAt,
    },
  ]
}

function extractAssistantResultFiles(
  session: HermesConversation,
  messages: Message[],
  target: {
    href: '/team-workspace' | '/hermes-playground' | '/one-person-company'
    search?: {
      team_id?: number
      panel?: 'sessions' | 'results' | 'skills' | 'messages' | 'tasks'
    }
    teamName?: string
  }
): ResultItem[] {
  const artifacts = new Map<string, ResultItem>()

  for (const message of messages) {
    for (const version of message.versions) {
      const visibleContent = renderHermesDataPathsAsLinks(
        parseThinkTags(version.content).visibleContent
      )
      for (const artifact of extractHermesFileArtifacts(visibleContent)) {
        artifacts.set(artifact.href, {
          id: `${target.href}-${session.id}-artifact-${artifact.href}`,
          title: artifact.filename || artifact.label || session.title,
          kind: getResultKind(artifact.filename || artifact.label),
          href: target.href,
          search: target.search,
          sourceTitle: session.title,
          teamName: target.teamName,
          updatedAt: session.updatedAt,
        })
      }
    }
  }

  return [...artifacts.values()]
}
function isMessageLike(value: unknown): value is Message {
  return Boolean(value && typeof value === 'object' && 'from' in value)
}

function isAttachmentLike(value: unknown): value is { filename?: string } {
  return Boolean(value && typeof value === 'object')
}

function getResultKind(filename?: string): string {
  const lower = filename?.toLowerCase() ?? ''
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'PPT'
  if (/report|research|\u62a5\u544a|\u8c03\u7814/.test(lower)) {
    return 'Report'
  }
  if (
    lower.endsWith('.doc') ||
    lower.endsWith('.docx') ||
    lower.endsWith('.md') ||
    lower.endsWith('.pdf')
  ) {
    return 'Document'
  }
  return 'Attachment result'
}

function getQuotaState(quota: number): {
  title: string
  description: string
  badge: string
  variant: 'default' | 'secondary' | 'destructive' | 'outline'
} {
  if (quota <= 0) {
    return {
      title: 'Needs top-up',
      description: 'Work may stop until balance is topped up.',
      badge: 'Not enough',
      variant: 'destructive',
    }
  }
  if (quota < 10_000) {
    return {
      title: 'Running low',
      description: 'Enough for light work, top up before heavier work.',
      badge: 'Low',
      variant: 'outline',
    }
  }
  return {
    title: 'Enough for now',
    description: 'You can continue normal work today.',
    badge: 'Enough',
    variant: 'secondary',
  }
}

