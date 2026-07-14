import { api } from '@/lib/api'

import { API_ENDPOINTS } from './constants'
import type {
  ImageGenerationRequest,
  ImageGenerationResponse,
  ImageModelOption,
  GroupOption,
  GeneratedImage,
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

// ── History API (server-side persistence) ───────────────────────

/**
 * Fetch image generation history for the current user
 */
export async function getImageHistory(
  page = 1,
  pageSize = 50
): Promise<{ items: GeneratedImage[]; total: number }> {
  const res = await api.get(API_ENDPOINTS.IMAGE_HISTORY, {
    params: { p: page, page_size: pageSize },
  })
  const { data } = res
  if (!data.success || !data.data) {
    return { items: [], total: 0 }
  }
  return {
    items: data.data.items ?? [],
    total: data.data.total ?? 0,
  }
}

/**
 * Save a single image history entry
 */
export async function saveImageHistory(entry: {
  prompt: string
  model: string
  size: string
  quality: string
  image_url: string
  revised_prompt?: string
}): Promise<GeneratedImage> {
  const res = await api.post(API_ENDPOINTS.IMAGE_HISTORY, entry)
  return res.data.data
}

/**
 * Delete a single history entry
 */
export async function deleteImageHistory(id: number): Promise<void> {
  await api.delete(`${API_ENDPOINTS.IMAGE_HISTORY}/${id}`)
}

/**
 * Clear all history for the current user
 */
export async function clearImageHistory(): Promise<void> {
  await api.delete(API_ENDPOINTS.IMAGE_HISTORY)
}

// ── Model & group APIs ──────────────────────────────────────────

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
