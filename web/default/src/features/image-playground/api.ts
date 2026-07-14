import { api } from '@/lib/api'

import { API_ENDPOINTS } from './constants'
import type {
  ImageModelOption,
  GroupOption,
  GeneratedImage,
} from './types'

// ── Async generation API ───────────────────────────────────────

/**
 * Submit an image generation request. The backend creates a pending
 * history entry and processes the generation in a background goroutine.
 * Returns immediately with the pending record.
 */
export async function submitImageGeneration(params: {
  prompt: string
  model: string
  size: string
  quality: string
  group: string
}): Promise<GeneratedImage> {
  const res = await api.post(API_ENDPOINTS.IMAGE_GENERATE, params)
  return res.data.data
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
