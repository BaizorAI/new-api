// Image generation request/response types
export interface ImageGenerationRequest {
  model: string
  group: string
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

// Config
export interface ImagePlaygroundConfig {
  model: string
  group: string
  size: string
  quality: string
}

// Model and group options
export interface ImageModelOption {
  label: string
  value: string
}

export interface GroupOption {
  label: string
  value: string
  ratio: number
  desc?: string
}

// Status constants
export const IMAGE_STATUS = {
  PENDING: 1,
  COMPLETED: 2,
  FAILED: 3,
} as const

// Generated image record (matches backend ImagePlaygroundHistory)
export interface GeneratedImage {
  id: number
  prompt: string
  model: string
  size: string
  quality: string
  group: string
  status: number
  image_url?: string
  b64_json?: string
  revised_prompt?: string
  error_message?: string
  created_at: number
}
