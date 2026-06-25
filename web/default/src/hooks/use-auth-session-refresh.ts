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
import { useNavigate, useRouter } from '@tanstack/react-router'
import { useCallback, useEffect, useRef } from 'react'

import { getSelf } from '@/lib/api'
import { useAuthStore, type AuthUser } from '@/stores/auth-store'

const AUTH_REFRESH_INTERVAL_MS = 30 * 1000

function hasPermissionSurfaceChanged(before: AuthUser | null, after: AuthUser) {
  if (!before) return true
  return (
    before.role !== after.role ||
    before.status !== after.status ||
    before.group !== after.group ||
    before.sidebar_modules !== after.sidebar_modules ||
    JSON.stringify(before.permissions ?? {}) !==
      JSON.stringify(after.permissions ?? {})
  )
}

export function useAuthSessionRefresh() {
  const userId = useAuthStore((state) => state.auth.user?.id)
  const router = useRouter()
  const navigate = useNavigate()
  const inFlightRef = useRef(false)

  const refreshSession = useCallback(async () => {
    if (!userId || inFlightRef.current) return
    inFlightRef.current = true
    try {
      const res = await getSelf({ silent: true }).catch(() => null)
      const auth = useAuthStore.getState().auth
      const currentUser = auth.user
      if (!res?.success || !res.data) {
        auth.reset()
        const redirect = router.history.location.href
        navigate({ to: '/sign-in', search: { redirect } })
        return
      }
      const nextUser = res.data as AuthUser
      if (currentUser?.id !== nextUser.id) return
      const shouldInvalidate = hasPermissionSurfaceChanged(currentUser, nextUser)
      auth.setUser(nextUser)
      if (shouldInvalidate) {
        await router.invalidate()
      }
    } finally {
      inFlightRef.current = false
    }
  }, [navigate, router, userId])

  useEffect(() => {
    if (!userId) return

    refreshSession()
    const intervalId = window.setInterval(
      refreshSession,
      AUTH_REFRESH_INTERVAL_MS
    )
    const handleFocus = () => refreshSession()
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSession()
    }

    window.addEventListener('focus', handleFocus)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.clearInterval(intervalId)
      window.removeEventListener('focus', handleFocus)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [refreshSession, userId])
}
