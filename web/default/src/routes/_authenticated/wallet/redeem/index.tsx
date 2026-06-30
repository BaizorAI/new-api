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
import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { Gift, Loader2 } from 'lucide-react'

import { SectionPageLayout } from '@/components/layout'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TitledCard } from '@/components/ui/titled-card'
import { useRedemption } from '@/features/wallet/hooks'
import { useTopupInfo } from '@/features/wallet/hooks'

export const Route = createFileRoute('/_authenticated/wallet/redeem/')({
  component: WalletRedeemPage,
})

function WalletRedeemPage() {
  const { t } = useTranslation()
  const [code, setCode] = useState('')
  const { redeeming, redeemCode } = useRedemption()
  const { topupInfo } = useTopupInfo()

  const redemptionEnabled = topupInfo?.enable_redemption !== false
  const topupLink = topupInfo?.topup_link

  const handleRedeem = async () => {
    if (!code.trim()) return
    const success = await redeemCode(code)
    if (success) setCode('')
  }

  return (
    <SectionPageLayout>
      <SectionPageLayout.Title>{t('Redemption Code')}</SectionPageLayout.Title>
      <SectionPageLayout.Content>
        <div className='mx-auto w-full max-w-lg'>
          <TitledCard
            title={t('Redemption Code')}
            description={t('Enter your redemption code')}
            icon={<Gift className='h-4 w-4' />}
            disableHoverEffect
          >
            {redemptionEnabled ? (
              <div className='space-y-3'>
                <div className='grid grid-cols-[minmax(0,1fr)_auto] gap-2'>
                  <Input
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleRedeem()}
                    placeholder={t('Enter your redemption code')}
                    className='h-10'
                  />
                  <Button
                    onClick={handleRedeem}
                    disabled={redeeming || !code.trim()}
                    className='h-10 px-5'
                  >
                    {redeeming && (
                      <Loader2 className='mr-2 h-4 w-4 animate-spin' />
                    )}
                    {t('Redeem')}
                  </Button>
                </div>
                {topupLink && (
                  <p className='text-muted-foreground text-sm'>
                    {t('Need a redemption code?')}{' '}
                    <a
                      href={topupLink}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='underline-offset-4 hover:underline'
                    >
                      {t('Get one here')}
                    </a>
                  </p>
                )}
              </div>
            ) : (
              <Alert>
                <AlertDescription>
                  {t(
                    'Redemption codes are disabled until the administrator confirms compliance terms.'
                  )}
                </AlertDescription>
              </Alert>
            )}
          </TitledCard>
        </div>
      </SectionPageLayout.Content>
    </SectionPageLayout>
  )
}
