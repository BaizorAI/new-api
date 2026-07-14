import { api } from '@/lib/api'

import { API_ENDPOINTS } from './constants'
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelOption,
  GroupOption,
} from './types'

/**
 * Send image generation request (group in body, matching chat playground pattern)
 */
export async function sendImageGeneration(
  payload: ImageGenerationRequest
): Promise<ImageGenerationResponse> {
  const res = await api.post(API_ENDPOINTS.IMAGE_GENERATIONS, payload, {
    skipErrorHandler: true,
  } as Record<string, unknown>)
  return res.data
}

/**
 * Get user available image models
 */
export async function getUserImageModels(): Promise<ImageModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
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

/**
 * Get user groups
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>
  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}
