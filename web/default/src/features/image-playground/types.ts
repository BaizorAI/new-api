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

// Generated image record
export interface GeneratedImage {
  id: string
  url?: string
  b64_json?: string
  revised_prompt?: string
  model: string
  prompt: string
  size: string
  quality: string
  timestamp: number
}
