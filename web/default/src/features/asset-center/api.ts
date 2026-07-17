import { api } from '@/lib/api'

import type { AssetCreatePayload, AssetItem, AssetListResponse, AssetUpdatePayload } from './types'

const BASE = '/api/asset-center'

export async function fetchAssets(params: {
  asset_type?: string
  project_id?: string
  visibility?: string
  search?: string
  page?: number
  page_size?: number
}): Promise<AssetListResponse> {
  const res = await api.get(BASE, { params })
  return res.data
}

export async function fetchAssetTypes(): Promise<string[]> {
  const res = await api.get(`${BASE}/types`)
  return res.data
}

export async function createAsset(
  payload: AssetCreatePayload
): Promise<AssetItem> {
  const res = await api.post(BASE, payload)
  return res.data
}

export async function getAsset(id: number): Promise<AssetItem> {
  const res = await api.get(`${BASE}/${id}`)
  return res.data
}

export async function updateAsset(
  id: number,
  payload: AssetUpdatePayload
): Promise<AssetItem> {
  const res = await api.put(`${BASE}/${id}`, payload)
  return res.data
}

export async function deleteAsset(id: number): Promise<void> {
  await api.delete(`${BASE}/${id}`)
}
