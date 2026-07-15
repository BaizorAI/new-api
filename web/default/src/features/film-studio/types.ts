/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { z } from 'zod'

// ============================================================================
// Studio Project
// ============================================================================

export const studioProjectSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  team_id: z.number(),
  name: z.string(),
  brief: z.string(),
  genre: z.string(),
  status: z.number(),
  style_dna: z.string(),
  cover_url: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
  stage_total: z.number().optional(),
  stage_done: z.number().optional(),
})

export type StudioProject = z.infer<typeof studioProjectSchema>

export interface StudioProjectFormData {
  name: string
  brief: string
  genre: string
  style_dna?: string
  cover_url?: string
}

// ============================================================================
// Studio Stage (auto-generated pipeline nodes)
// ============================================================================

export const studioStageSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  key: z.string(),
  name: z.string(),
  order: z.number(),
  status: z.number(),
  auto_skill: z.string(),
  total_items: z.number(),
  done_items: z.number(),
  output_data: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type StudioStage = z.infer<typeof studioStageSchema>

export type StageKey =
  | 'script'
  | 'characters'
  | 'storyboard'
  | 'image_gen'
  | 'video_gen'
  | 'post'
  | 'review'

// ============================================================================
// Studio Shot
// ============================================================================

export const studioShotSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  scene_number: z.number(),
  shot_number: z.number(),
  description: z.string(),
  camera_angle: z.string(),
  camera_move: z.string(),
  duration: z.number(),
  image_prompt: z.string(),
  image_url: z.string(),
  video_prompt: z.string(),
  video_url: z.string(),
  video_task_id: z.string(),
  status: z.number(),
  character_ids: z.string(),
  sort_order: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type StudioShot = z.infer<typeof studioShotSchema>

export interface StudioShotFormData {
  scene_number: number
  shot_number: number
  description: string
  camera_angle?: string
  camera_move?: string
  duration?: number
  image_prompt?: string
  video_prompt?: string
  character_ids?: string
  sort_order?: number
}

// ============================================================================
// Studio Character
// ============================================================================

export const studioCharacterSchema = z.object({
  id: z.number(),
  project_id: z.number(),
  name: z.string(),
  description: z.string(),
  visual_prompt: z.string(),
  reference_url: z.string(),
  lora_params: z.string(),
  created_at: z.number(),
  updated_at: z.number(),
})

export type StudioCharacter = z.infer<typeof studioCharacterSchema>

export interface StudioCharacterFormData {
  name: string
  description: string
  visual_prompt?: string
  reference_url?: string
  lora_params?: string
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface PaginatedResponse<T> {
  success: boolean
  message?: string
  data?: {
    items: T[]
    total: number
    page: number
    page_size: number
  }
}

// ============================================================================
// Project with stages (returned by GET /api/studio/projects/:id)
// ============================================================================

export interface StudioProjectWithStages extends StudioProject {
  stages?: StudioStage[]
}
