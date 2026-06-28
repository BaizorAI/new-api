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
import { useQueries, useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BriefcaseBusiness,
  FileCheck2,
  FileText,
  MessageSquare,
  Sparkles,
  Users,
  Wallet,
} from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  listHermesSkills,
  listTeamHermesConversations,
  type HermesSkill,
  type HermesTeamConversationRecord,
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
import type { Message } from '@/features/playground/types'
import { listTeams } from '@/features/teams/api'
import type { Team } from '@/features/teams/types'
import { getSelf } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'

type SessionItem = {
  id: string
  title: string
  href: '/team-workspace' | '/hermes-playground' | '/one-person-company'
  search?: {
    team_id?: number
    panel?: 'sessions' | 'results' | 'skills' | 'messages'
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
    panel?: 'sessions' | 'results' | 'skills' | 'messages'
  }
  updatedAt: number
}

export function WorkspaceHome() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.auth.user)
  const userId = user?.id

  const teamsQuery = useQuery({
    queryKey: ['workspace-home', 'teams'],
    queryFn: listTeams,
    staleTime: 30_000,
  })
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

  const teams = useMemo<Team[]>(() => {
    if (!teamsQuery.data?.success) return []
    return teamsQuery.data.data ?? []
  }, [teamsQuery.data])

  const teamConversationQueries = useQueries({
    queries: teams.slice(0, 5).map((team) => ({
      queryKey: ['workspace-home', 'team-sessions', team.id],
      queryFn: () => listTeamHermesConversations(team.id).catch(() => []),
      staleTime: 30_000,
    })),
  })
  const teamSkillQueries = useQueries({
    queries: teams.slice(0, 3).map((team) => ({
      queryKey: ['workspace-home', 'team-skills', team.id],
      queryFn: () => listHermesSkills({ teamId: team.id }).catch(() => []),
      staleTime: 30_000,
    })),
  })

  const teamSessions = useMemo<SessionItem[]>(() => {
    return teamConversationQueries
      .flatMap((query, index) =>
        ((query.data ?? []) as HermesTeamConversationRecord[]).map(
          (session) => ({
            id: `team-${session.id}`,
            title: session.title,
            href: '/team-workspace' as const,
            search: { team_id: teams[index]?.id, panel: 'sessions' as const },
            teamName: teams[index]?.name,
            updatedAt: session.updatedAt,
          })
        )
      )
      .filter((session) => Boolean(session.search?.team_id))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 4)
  }, [teamConversationQueries, teams])

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
      .slice(0, 4)
  }, [userId])

  const skills = personalSkillsQuery.data ?? []
  const recentSkills = skills
    .filter((skill) => skill.ownerScope === 'user' || skill.source === 'user')
    .slice(0, 4)
  const baizorSkills = skills
    .filter(
      (skill) => skill.ownerScope === 'baizor' || skill.source === 'baizor'
    )
    .slice(0, 4)
  const teamSkills = useMemo(() => {
    return dedupeSkills(teamSkillQueries.flatMap((query) => query.data ?? []))
      .filter((skill) => skill.ownerScope === 'team' || skill.source === 'team')
      .slice(0, 4)
  }, [teamSkillQueries])

  const latestResults = useMemo<ResultItem[]>(() => {
    const teamResults = teamConversationQueries.flatMap((query, index) =>
      ((query.data ?? []) as HermesTeamConversationRecord[]).flatMap(
        (session) =>
          toResultItems(session, session.messages, {
            href: '/team-workspace',
            search: {
              team_id: teams[index]?.id,
              panel: 'results',
            },
          })
      )
    )
    const personalResults =
      typeof window === 'undefined' || !userId
        ? []
        : [
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
    return [...teamResults, ...personalResults]
      .filter((item) => item.search?.team_id !== undefined || !item.search)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 6)
  }, [teamConversationQueries, teams, userId])

  const quota = Number(selfQuery.data?.data?.quota ?? user?.quota ?? 0)
  const quotaState = getQuotaState(quota)
  const firstTeam = teams[0]

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Workspace Home')}</SectionPageLayout.Title>
      <SectionPageLayout.Actions>
        <Button size='sm' render={<Link to='/one-person-company' />}>
          <BriefcaseBusiness data-icon='inline-start' />
          {t('Start personal work')}
        </Button>
      </SectionPageLayout.Actions>
      <SectionPageLayout.Content>
        <div className='mx-auto max-w-7xl space-y-4'>
          <section className='bg-muted/20 rounded-xl border p-4 sm:p-5'>
            <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <div>
                <h1 className='text-xl font-semibold tracking-tight'>
                  {t('Start from the work you care about')}
                </h1>
                <p className='text-muted-foreground mt-1 text-sm'>
                  {t(
                    'Continue conversations, enter a team workspace, reuse skills, find results, and keep enough balance for today.'
                  )}
                </p>
              </div>
              {firstTeam ? (
                <Button
                  variant='outline'
                  render={
                    <Link
                      to='/team-workspace'
                      search={{ team_id: firstTeam.id }}
                    />
                  }
                >
                  <Users data-icon='inline-start' />
                  {t('Enter team workspace')}
                </Button>
              ) : null}
            </div>
          </section>

          <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
            <QuickActionCard
              icon={<MessageSquare className='size-4' />}
              title={t('Ask AI to do a task')}
              description={t(
                'Start with a real task, then keep the conversation and files together.'
              )}
              action={t('Start task')}
              to='/hermes-playground'
            />
            {firstTeam ? (
              <QuickActionCard
                icon={<Users className='size-4' />}
                title={t('Work with a team')}
                description={t(
                  'Share sessions, skills and results with teammates in one workspace.'
                )}
                action={t('Enter team')}
                to='/team-workspace'
                search={{ team_id: firstTeam.id }}
              />
            ) : (
              <QuickActionCard
                icon={<Users className='size-4' />}
                title={t('Work with a team')}
                description={t(
                  'Share sessions, skills and results with teammates in one workspace.'
                )}
                action={t('Enter team')}
                to='/team-workspace'
              />
            )}
            <QuickActionCard
              icon={<Sparkles className='size-4' />}
              title={t('Skill Store')}
              description={t(
                'Pick a reusable skill for reports, slides, documents, data work or team operations.'
              )}
              action={t('Browse skills')}
              to={firstTeam ? '/team-workspace' : '/hermes-playground'}
              search={
                firstTeam
                  ? { team_id: firstTeam.id, panel: 'skills' }
                  : { panel: 'skills' }
              }
            />
            <QuickActionCard
              icon={<MessageSquare className='size-4' />}
              title={t('Message platforms')}
              description={t(
                'Connect WeChat so messages can enter your AI workspace.'
              )}
              action={t('Connect channel')}
              to='/hermes-playground'
              search={{ panel: 'messages' }}
            />
            <QuickActionCard
              icon={<FileCheck2 className='size-4' />}
              title={t('Find results')}
              description={t(
                'Open recent reports, slides, documents and attached file results.'
              )}
              action={t('View results')}
              to={firstTeam ? '/team-workspace' : '/hermes-playground'}
              search={
                firstTeam
                  ? { team_id: firstTeam.id, panel: 'results' }
                  : undefined
              }
            />
          </div>

          <div className='grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]'>
            <div className='space-y-4'>
              <Panel
                icon={<MessageSquare className='size-4' />}
                title={t('Continue work')}
                description={t(
                  'Pick up recent team or personal conversations.'
                )}
              >
                <div className='grid gap-3 md:grid-cols-2'>
                  <SessionList
                    emptyText={t('No recent team sessions yet')}
                    items={teamSessions}
                    title={t('Recent team sessions')}
                  />
                  <SessionList
                    emptyText={t('No recent personal sessions yet')}
                    items={personalSessions}
                    title={t('Personal sessions')}
                  />
                </div>
              </Panel>

              <Panel
                icon={<Sparkles className='size-4' />}
                title={t('Skill Store')}
                description={t(
                  'Choose proven skills by scenario and reuse them in personal or team work.'
                )}
              >
                <SkillScenarioGrid />
                <div className='mt-3 grid gap-3 md:grid-cols-3'>
                  <SkillList
                    emptyText={t('Used skills will appear here')}
                    skills={recentSkills}
                    title={t('Recently used')}
                  />
                  <SkillList
                    emptyText={t('No team recommended skills yet')}
                    skills={teamSkills}
                    title={t('Team recommended')}
                  />
                  <SkillList
                    emptyText={t('No Baizor shared skills yet')}
                    skills={baizorSkills}
                    title={t('Baizor shared skills')}
                  />
                </div>
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
            </div>

            <aside className='space-y-4'>
              <Panel
                icon={<Users className='size-4' />}
                title={t('Team collaboration')}
                description={t('Enter a team workspace to work together.')}
              >
                <div className='space-y-2'>
                  {teams.length > 0 ? (
                    teams
                      .slice(0, 6)
                      .map((team) => <TeamCard key={team.id} team={team} />)
                  ) : (
                    <EmptyLine
                      text={t('Create or join a team to collaborate')}
                    />
                  )}
                </div>
              </Panel>

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
                    <p className='mt-1'>
                      {t('Team work is paid by the selected team.')}
                    </p>
                  </div>
                  <Button className='w-full' render={<Link to='/wallet' />}>
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
  to: '/team-workspace' | '/hermes-playground'
  search?: {
    team_id?: number
    panel?: 'sessions' | 'results' | 'skills' | 'messages'
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
  const title = props.item.title || t('New session')
  return (
    <Link
      to={props.item.href}
      search={props.item.search}
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

function SkillScenarioGrid() {
  const { t } = useTranslation()
  const scenarios = [
    'PPT and presentations',
    'Research reports',
    'Data analysis',
    'Document writing',
    'Team operations',
  ]

  return (
    <div className='flex flex-wrap gap-2'>
      {scenarios.map((scenario) => (
        <span
          key={scenario}
          className='bg-muted/30 text-muted-foreground rounded-full border px-3 py-1 text-xs font-medium'
        >
          {t(scenario)}
        </span>
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
              <div className='truncate text-sm font-medium'>{skill.name}</div>
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

function TeamCard(props: { team: Team }) {
  const { t } = useTranslation()
  const state = getQuotaState(Number(props.team.quota ?? 0))
  return (
    <Link
      to='/team-workspace'
      search={{ team_id: props.team.id }}
      className='bg-background hover:bg-muted/30 block rounded-lg border p-3 transition-colors'
    >
      <div className='flex items-center justify-between gap-3'>
        <div className='min-w-0'>
          <div className='truncate text-sm font-medium'>{props.team.name}</div>
          <div className='text-muted-foreground mt-1 text-xs'>
            {t('Team workspace')}
          </div>
        </div>
        <Badge variant={state.variant}>{t(state.badge)}</Badge>
      </div>
    </Link>
  )
}

function ResultCard(props: { item: ResultItem }) {
  const { t } = useTranslation()
  return (
    <Link
      to={props.item.href}
      search={props.item.search}
      className='bg-background hover:bg-muted/30 block rounded-lg border p-3 transition-colors'
    >
      <div className='flex items-start gap-3'>
        <div className='bg-muted text-muted-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg'>
          <FileText className='size-4' />
        </div>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <Badge variant='secondary'>{t(props.item.kind)}</Badge>
            <span className='text-muted-foreground text-xs'>
              {formatSessionTime(props.item.updatedAt, t('Just now'))}
            </span>
          </div>
          <div className='mt-2 truncate text-sm font-medium'>
            {props.item.title || t('Untitled result')}
          </div>
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
      panel?: 'sessions' | 'results' | 'skills' | 'messages'
    }
  }
): ResultItem[] {
  const attachments = messages.flatMap((message) => message.attachments ?? [])
  const assistantMessages = messages.filter(
    (message) => message.from === 'assistant'
  )
  const fileResults = attachments.map((attachment, index) => ({
    id: `${target.href}-${session.id}-file-${index}`,
    title: attachment.filename || session.title,
    kind: getResultKind(attachment.filename),
    href: target.href,
    search: target.search,
    updatedAt: session.updatedAt,
  }))
  if (fileResults.length > 0) return fileResults
  if (assistantMessages.length === 0) return []
  return [
    {
      id: `${target.href}-${session.id}-document`,
      title: session.title,
      kind: 'Document',
      href: target.href,
      search: target.search,
      updatedAt: session.updatedAt,
    },
  ]
}

function getResultKind(filename?: string): string {
  const lower = filename?.toLowerCase() ?? ''
  if (lower.endsWith('.ppt') || lower.endsWith('.pptx')) return 'PPT'
  if (lower.includes('report') || lower.includes('报告')) return 'Report'
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

function dedupeSkills(skills: HermesSkill[]): HermesSkill[] {
  const map = new Map<string, HermesSkill>()
  for (const skill of skills) {
    const key = `${skill.ownerScope}-${skill.name}`
    if (!map.has(key)) map.set(key, skill)
  }
  return [...map.values()]
}
