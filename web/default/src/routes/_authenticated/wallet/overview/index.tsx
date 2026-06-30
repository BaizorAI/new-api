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
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'

import { SectionPageLayout } from '@/components/layout'
import { getSelfSubscriptionFull } from '@/features/subscriptions/api'
import { listTeams } from '@/features/teams/api'
import { BillingOwnershipCard } from '@/features/wallet/components/billing-ownership-card'
import { WalletStatsCard } from '@/features/wallet/components/wallet-stats-card'
import type { UserWalletData } from '@/features/wallet/types'
import { getSelf } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/wallet/overview/')({
  component: WalletOverviewPage,
})

function WalletOverviewPage() {
  const { t } = useTranslation()

  const { data: selfRes, isLoading: selfLoading } = useQuery({
    queryKey: ['wallet', 'self'],
    queryFn: getSelf,
    staleTime: 30_000,
  })
  const { data: teamsRes, isLoading: teamsLoading } = useQuery({
    queryKey: ['wallet', 'teams'],
    queryFn: listTeams,
    staleTime: 30_000,
  })
  const { data: subsRes, isLoading: subsLoading } = useQuery({
    queryKey: ['wallet', 'subscriptions'],
    queryFn: getSelfSubscriptionFull,
    staleTime: 30_000,
  })

  const user = selfRes?.success ? ((selfRes.data as UserWalletData) ?? null) : null
  const teams = teamsRes?.success ? (teamsRes.data ?? []) : []
  const activeSubscriptions = subsRes?.success
    ? (subsRes.data?.subscriptions ?? [])
    : []
  const loading = selfLoading || teamsLoading || subsLoading

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Wallet Overview')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto flex w-full max-w-5xl flex-col gap-4 sm:gap-5'>
          <WalletStatsCard user={user} loading={loading} />
          <BillingOwnershipCard
            user={user}
            teams={teams}
            activeSubscriptions={activeSubscriptions}
            loading={loading}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
