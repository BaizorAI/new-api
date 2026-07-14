import { api } from '@/lib/api'

export interface ImageModelOption {
  label: string
  value: string
}

export interface ImageGenerationRequest {
  model: string
  prompt: string
  size?: string
  quality?: string
  n?: number
}

export interface ImageGenerationResponse {
  data: Array<{
    url?: string
    b64_json?: string
    revised_prompt?: string
  }>
  created: number
}

export async function getUserImageModels(): Promise<ImageModelOption[]> {
  const res = await api.get('/api/user/models', {
    params: { capability: 'image' },
  })
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

export async function getUserGroups(): Promise<
  Array<{ label: string; value: string; ratio: number; desc?: string }>
> {
  const res = await api.get('/api/user/self/groups')
  const { data } = res

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<
    string,
    { desc: string; ratio: number }
  >
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}

export async function generateImage(
  payload: ImageGenerationRequest,
  group?: string
): Promise<ImageGenerationResponse> {
  const headers: Record<string, string> = {}
  if (group) {
    headers['X-New-Api-Group'] = group
  }
  const res = await api.post('/pg/images/generations', payload, {
    headers,
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}
