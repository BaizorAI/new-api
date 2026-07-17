import { createFileRoute, redirect } from '@tanstack/react-router'

import { OnlineStatus } from '@/features/online-status'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/online-status/')({
  beforeLoad: () => {
    const role = useAuthStore.getState().auth.user?.role
    if (role == null || role < ROLE.ADMIN) {
      throw redirect({ to: '/team-workspace' })
    }
  },
  component: OnlineStatus,
})
