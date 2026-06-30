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
import { SubscriptionPlansCard } from '@/features/wallet/components/subscription-plans-card'
import { useTopupInfo } from '@/features/wallet/hooks'
import { getSelf } from '@/lib/api'

export const Route = createFileRoute('/_authenticated/wallet/subscriptions/')({
  component: WalletSubscriptionsPage,
})

function WalletSubscriptionsPage() {
  const { t } = useTranslation()
  const { topupInfo } = useTopupInfo()

  const { data: selfRes } = useQuery({
    queryKey: ['wallet', 'self'],
    queryFn: getSelf,
    staleTime: 30_000,
  })
  const userQuota = selfRes?.success ? (selfRes.data?.quota ?? undefined) : undefined

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Subscription Plans')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-5xl'>
          <SubscriptionPlansCard
            topupInfo={topupInfo}
            userQuota={userQuota}
          />
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
