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
import { useLocation } from '@tanstack/react-router'
import { useEffect, useMemo, useRef } from 'react'

import { Main } from '@/components/layout'
import {
  CardStaggerContainer,
  CardStaggerItem,
} from '@/components/page-transition'
import { useStatus } from '@/hooks/use-status'
import { useAuthStore } from '@/stores/auth-store'

import { CheckinCalendarCard } from './components/checkin-calendar-card'
import { LanguagePreferencesCard } from './components/language-preferences-card'
import { PasskeyCard } from './components/passkey-card'
import { ProfileHeader } from './components/profile-header'
import { ProfileSecurityCard } from './components/profile-security-card'
import { ProfileSettingsCard } from './components/profile-settings-card'
import { SidebarModulesCard } from './components/sidebar-modules-card'
import { TwoFACard } from './components/two-fa-card'
import { useProfile } from './hooks'

export function Profile() {
  const { profile, loading, refreshProfile } = useProfile()
  const { status } = useStatus()
  const permissions = useAuthStore((s) => s.auth.user?.permissions)
  const href = useLocation({ select: (location) => location.href })
  const headerRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const securityRef = useRef<HTMLDivElement>(null)
  const sidebarRef = useRef<HTMLDivElement>(null)

  const checkinEnabled = status?.checkin_enabled === true
  const turnstileEnabled = !!(
    status?.turnstile_check && status?.turnstile_site_key
  )
  const turnstileSiteKey = status?.turnstile_site_key || ''
  const canConfigureSidebar = permissions?.sidebar_settings !== false
  const activeSection = useMemo(() => {
    const params = new URLSearchParams(href.split('?')[1]?.split('#')[0] ?? '')
    return params.get('section')
  }, [href])

  useEffect(() => {
    let target: HTMLDivElement | null = null

    if (activeSection === 'account' || activeSection === 'preferences') {
      target = settingsRef.current
    } else if (activeSection === 'security') {
      target = securityRef.current
    } else if (activeSection === 'sidebar') {
      target = sidebarRef.current
    } else if (activeSection === 'profile') {
      target = headerRef.current
    }

    target?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [activeSection])

  return (
    <Main>
      <div className='min-h-0 flex-1 overflow-auto px-3 py-3 sm:px-4 sm:py-6'>
        <CardStaggerContainer className='mx-auto flex w-full max-w-7xl flex-col gap-4 sm:gap-6'>
          <CardStaggerItem>
            <div ref={headerRef}>
              <ProfileHeader profile={profile} loading={loading} />
            </div>
          </CardStaggerItem>

          <CardStaggerItem>
            <div className='grid gap-4 sm:gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,0.46fr)] xl:items-start'>
              <div className='space-y-4 sm:space-y-6'>
                <div ref={settingsRef}>
                  <ProfileSettingsCard
                    profile={profile}
                    loading={loading}
                    onProfileUpdate={refreshProfile}
                    activeSection={activeSection}
                  />
                </div>
                <LanguagePreferencesCard
                  profile={profile}
                  onProfileUpdate={refreshProfile}
                />
                <div ref={securityRef}>
                  <ProfileSecurityCard profile={profile} loading={loading} />
                </div>
              </div>

              <div className='space-y-4 sm:space-y-6 xl:sticky xl:top-6'>
                {checkinEnabled && (
                  <CheckinCalendarCard
                    checkinEnabled={checkinEnabled}
                    turnstileEnabled={turnstileEnabled}
                    turnstileSiteKey={turnstileSiteKey}
                  />
                )}
                {canConfigureSidebar && (
                  <div ref={sidebarRef}>
                    <SidebarModulesCard />
                  </div>
                )}
                <PasskeyCard loading={loading} />
                <TwoFACard loading={loading} />
              </div>
            </div>
          </CardStaggerItem>
        </CardStaggerContainer>
      </div>
    </Main>
  )
}
