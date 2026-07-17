export type AssetType =
  | 'character'
  | 'storyboard'
  | 'clip'
  | 'lora'
  | 'scene'
  | 'music'

export type AssetVisibility = 'private' | 'team' | 'public'

export type AssetItem = {
  id: number
  user_id: number
  project_id: number | null
  asset_type: AssetType
  name: string
  description: string
  url: string
  thumbnail_url: string
  metadata: string
  visibility: AssetVisibility
  tags: string
  file_size: number
  width: number
  height: number
  duration: number
  source_app: string
  source_id: number | null
  created_at: number
  updated_at: number
}

export type AssetListResponse = {
  items: AssetItem[]
  total: number
  page: number
}

export type AssetCreatePayload = {
  name: string
  asset_type: AssetType
  description?: string
  url?: string
  thumbnail_url?: string
  metadata?: string
  visibility?: AssetVisibility
  tags?: string
  file_size?: number
  width?: number
  height?: number
  duration?: number
  source_app?: string
  source_id?: number
  project_id?: number
}

export type AssetUpdatePayload = Partial<AssetCreatePayload>

/** Human-readable labels for asset types (i18n keys) */
export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  character: 'Character',
  storyboard: 'Storyboard',
  clip: 'Video Clip',
  lora: 'LoRA Model',
  scene: 'Scene',
  music: 'Music',
}
