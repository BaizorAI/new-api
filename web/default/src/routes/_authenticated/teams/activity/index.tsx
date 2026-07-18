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
import { createFileRoute, Link } from '@tanstack/react-router'
import { MessageSquare } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  listTeamHermesConversations,
  type HermesTeamConversationRecord,
} from '@/features/hermes-playground/api'
import { formatSessionTime } from '@/features/hermes-playground/sessions'
import { listTeams } from '@/features/teams/api'
import type { Team } from '@/features/teams/types'

export const Route = createFileRoute('/_authenticated/teams/activity/')({
  component: TeamActivityPage,
})

function TeamActivityPage() {
  const { t } = useTranslation()

  const teamsQuery = useQuery({
    queryKey: ['team-activity', 'teams'],
    queryFn: listTeams,
    staleTime: 30_000,
  })

  const teams = useMemo<Team[]>(() => {
    if (!teamsQuery.data?.success) return []
    return teamsQuery.data.data ?? []
  }, [teamsQuery.data])

  const conversationQueries = useQueries({
    queries: teams.map((team) => ({
      queryKey: ['team-activity', 'team-sessions', team.id],
      queryFn: () => listTeamHermesConversations(team.id).catch(() => []),
      staleTime: 30_000,
    })),
  })

  const activities = useMemo(() => {
    return conversationQueries
      .flatMap((query, index) =>
        ((query.data ?? []) as HermesTeamConversationRecord[]).map(
          (session) => ({
            id: `team-${teams[index].id}-${session.id}`,
            title: session.title,
            teamName: teams[index].name,
            teamId: teams[index].id,
            updatedAt: session.updatedAt,
          })
        )
      )
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 20)
  }, [conversationQueries, teams])

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Team activity')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        {teams.length === 0 ? (
          <div className='text-muted-foreground'>
            {t('Create or join a team to collaborate')}
          </div>
        ) : (
          <div className='space-y-3'>
            {activities.map((item) => (
              <Link
                key={item.id}
                to='/workspace/team/$teamId'
                params={{ teamId: String(item.teamId) }}
                search={{ panel: 'sessions' }}
                className='bg-background hover:bg-muted/30 flex items-center justify-between rounded-lg border p-4 transition-colors'
              >
                <div className='flex items-center gap-3'>
                  <div className='bg-muted text-muted-foreground flex size-9 items-center justify-center rounded-lg'>
                    <MessageSquare className='size-4' />
                  </div>
                  <div>
                    <div className='text-sm font-medium'>
                      {item.title || t('New session')}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      {item.teamName} ·{' '}
                      {formatSessionTime(item.updatedAt, t('Just now'))}
                    </div>
                  </div>
                </div>
                <Button variant='ghost' size='sm'>
                  {t('Open')}
                </Button>
              </Link>
            ))}
          </div>
        )}
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
