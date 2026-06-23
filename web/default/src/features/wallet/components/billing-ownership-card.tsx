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
import { BadgeCheck, Building2, CircleSlash, WalletCards } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatQuota } from '@/lib/format'
import type { UserSubscriptionRecord } from '@/features/subscriptions/types'
import type { Team } from '@/features/teams/types'
import type { UserWalletData } from '../types'

interface BillingOwnershipCardProps {
  user: UserWalletData | null
  teams: Team[]
  activeSubscriptions: UserSubscriptionRecord[]
  loading?: boolean
}

export function BillingOwnershipCard(props: BillingOwnershipCardProps) {
  const { t } = useTranslation()

  if (props.loading) {
    return (
      <Card>
        <CardHeader className='pb-2'>
          <Skeleton className='h-5 w-32' />
        </CardHeader>
        <CardContent className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className='rounded-md border p-3'>
              <Skeleton className='h-3.5 w-24' />
              <Skeleton className='mt-2 h-6 w-28' />
              <Skeleton className='mt-1.5 h-3.5 w-20' />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  const teamWallet = props.teams.reduce((sum, team) => sum + team.quota, 0)
  const teamUsedQuota = props.teams.reduce(
    (sum, team) => sum + team.used_quota,
    0
  )
  const teamRequests = props.teams.reduce(
    (sum, team) => sum + team.request_count,
    0
  )

  const items = [
    {
      label: t('Personal Wallet'),
      value: formatQuota(props.user?.quota ?? 0),
      description: t('Current Balance'),
      icon: WalletCards,
    },
    {
      label: t('Personal Subscription'),
      value:
        props.activeSubscriptions.length > 0
          ? String(props.activeSubscriptions.length)
          : t('None'),
      description:
        props.activeSubscriptions.length > 0
          ? t('Active subscriptions')
          : t('No active subscription'),
      icon: BadgeCheck,
    },
    {
      label: t('Team Wallet'),
      value: formatQuota(teamWallet),
      description: t('Across {{count}} teams', { count: props.teams.length }),
      icon: Building2,
    },
    {
      label: t('Team Quota'),
      value: formatQuota(teamUsedQuota),
      description: t('{{count}} team requests', { count: teamRequests }),
      icon: WalletCards,
    },
    {
      label: t('Team Subscription'),
      value: t('None'),
      description: t('No active team subscription'),
      icon: CircleSlash,
    },
  ]

  return (
    <Card>
      <CardHeader className='pb-2'>
        <CardTitle className='text-base'>{t('Billing Ownership')}</CardTitle>
      </CardHeader>
      <CardContent className='grid gap-3 sm:grid-cols-2 xl:grid-cols-5'>
        {items.map((item) => (
          <div key={item.label} className='rounded-md border p-3'>
            <div className='flex items-center gap-2'>
              <item.icon className='text-muted-foreground/60 size-3.5 shrink-0' />
              <div className='text-muted-foreground truncate text-xs font-medium tracking-wider uppercase'>
                {item.label}
              </div>
            </div>
            <div className='text-foreground mt-1.5 font-mono text-lg font-bold break-all tabular-nums'>
              {item.value}
            </div>
            <div className='text-muted-foreground/70 mt-1 text-xs'>
              {item.description}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
