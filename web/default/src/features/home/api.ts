import { api } from '@/lib/api'

export async function getHomePageContent(): Promise<{
  success: boolean
  data?: string
}> {
  const res = await api.get('/api/home_page_content')
  return res.data
}
