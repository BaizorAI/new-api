import { useQuery } from '@tanstack/react-query'
import { Activity, Globe, Monitor, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { FadeIn } from '@/components/page-transition'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

import { getOnlineStatus } from './api'

const POLL_INTERVAL_MS = 30_000

export function OnlineStatus() {
  const { t } = useTranslation()

  const { data, isLoading } = useQuery({
    queryKey: ['online-status'],
    queryFn: getOnlineStatus,
    refetchInterval: POLL_INTERVAL_MS,
  })

  const dashboardUsers = data?.data?.dashboard_users ?? []
  const relayUsers = data?.data?.relay_users ?? []

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Online Status')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <FadeIn>
          <div className='grid gap-4 md:grid-cols-2'>
            <UserCard
              title={t('Dashboard Users')}
              icon={Monitor}
              users={dashboardUsers}
              loading={isLoading}
              emptyText={t('No dashboard users online')}
            />
            <UserCard
              title={t('Relay Users')}
              icon={Globe}
              users={relayUsers}
              loading={isLoading}
              emptyText={t('No relay users active')}
            />
          </div>
        </FadeIn>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}

function UserCard(props: {
  title: string
  icon: React.ElementType
  users: { id: number; username: string; email: string; group: string }[]
  loading: boolean
  emptyText: string
}) {
  const { t } = useTranslation()
  const Icon = props.icon

  return (
    <Card>
      <CardHeader className='flex flex-row items-center justify-between pb-2'>
        <CardTitle className='text-base font-medium'>
          <Icon className='mr-2 inline size-4' aria-hidden='true' />
          {props.title}
        </CardTitle>
        {props.loading ? (
          <Skeleton className='h-5 w-16' />
        ) : (
          <Badge variant='secondary' className='text-sm'>
            {props.users.length} {t('users online')}
          </Badge>
        )}
      </CardHeader>
      <CardContent>
        {props.loading ? (
          <div className='space-y-2'>
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        ) : props.users.length === 0 ? (
          <p className='text-muted-foreground py-4 text-center text-sm'>
            {props.emptyText}
          </p>
        ) : (
          <div className='max-h-96 overflow-auto'>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className='w-16'>ID</TableHead>
                  <TableHead>{t('Username')}</TableHead>
                  <TableHead className='hidden sm:table-cell'>
                    {t('Email')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className='text-muted-foreground font-mono text-xs'>
                      {user.id}
                    </TableCell>
                    <TableCell className='font-medium'>
                      {user.username}
                    </TableCell>
                    <TableCell className='text-muted-foreground hidden text-sm sm:table-cell'>
                      {user.email || '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
