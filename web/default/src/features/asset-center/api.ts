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
  const searchParams = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') searchParams.set(k, String(v))
  })
  const res = await fetch(`${BASE}?${searchParams.toString()}`)
  if (!res.ok) throw new Error(`Failed to fetch assets: ${res.statusText}`)
  return res.json()
}

export async function fetchAssetTypes(): Promise<string[]> {
  const res = await fetch(`${BASE}/types`)
  if (!res.ok) throw new Error(`Failed to fetch asset types: ${res.statusText}`)
  return res.json()
}

export async function createAsset(
  payload: AssetCreatePayload
): Promise<AssetItem> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to create asset: ${res.statusText}`)
  return res.json()
}

export async function getAsset(id: number): Promise<AssetItem> {
  const res = await fetch(`${BASE}/${id}`)
  if (!res.ok) throw new Error(`Failed to fetch asset: ${res.statusText}`)
  return res.json()
}

export async function updateAsset(
  id: number,
  payload: AssetUpdatePayload
): Promise<AssetItem> {
  const res = await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Failed to update asset: ${res.statusText}`)
  return res.json()
}

export async function deleteAsset(id: number): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(`Failed to delete asset: ${res.statusText}`)
}
