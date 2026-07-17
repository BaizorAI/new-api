import { api } from '@/lib/api'

export type OnlineUser = {
  id: number
  username: string
  email: string
  group: string
}

export type OnlineStatusData = {
  dashboard_users: OnlineUser[]
  relay_users: OnlineUser[]
}

export async function getOnlineStatus() {
  const res = await api.get<{ success: boolean; data: OnlineStatusData }>(
    '/api/admin/online-status'
  )
  return res.data
}

export async function sendHeartbeat() {
  try {
    await api.post('/api/user/heartbeat', {}, { skipErrorHandler: true, skipBusinessError: true })
  } catch {
    // Heartbeat is best-effort — silence errors.
  }
}
