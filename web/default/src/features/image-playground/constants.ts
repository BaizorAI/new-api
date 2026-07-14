import type { ImagePlaygroundConfig } from './types'

// API endpoints
export const API_ENDPOINTS = {
  IMAGE_GENERATIONS: '/pg/images/generations',
  IMAGE_GENERATE: '/api/user/image-playground/generate',
  IMAGE_HISTORY: '/api/user/image-playground/history',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
} as const

// Default group
export const DEFAULT_GROUP = 'default' as const

// Default configuration
export const DEFAULT_CONFIG: ImagePlaygroundConfig = {
  model: 'huayu-drama-4',
  group: DEFAULT_GROUP,
  size: '1024x1024',
  quality: 'standard',
}

export const SIZE_OPTIONS = ['1024x1024', '1024x1792', '1792x1024'] as const
export const QUALITY_OPTIONS = ['standard', 'hd'] as const

// Storage keys (config only — history is server-side)
export const STORAGE_KEYS = {
  CONFIG: 'image_playground_config',
} as const

// Error messages
export const ERROR_MESSAGES = {
  API_REQUEST_ERROR: 'Request error occurred',
  PROMPT_REQUIRED: 'Prompt is required',
} as const

// Polling interval for pending images (ms)
export const PENDING_POLL_INTERVAL_MS = 3000
