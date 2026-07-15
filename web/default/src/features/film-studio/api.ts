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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  PaginatedResponse,
  StudioCharacter,
  StudioCharacterFormData,
  StudioProject,
  StudioProjectFormData,
  StudioProjectWithStages,
  StudioShot,
  StudioShotFormData,
  StudioStage,
} from './types'

// ============================================================================
// Projects
// ============================================================================

export async function getStudioProjects(params: {
  p?: number
  page_size?: number
  status?: number
} = {}): Promise<PaginatedResponse<StudioProject>> {
  const { p = 1, page_size = 20, status } = params
  let url = `/api/studio/projects?p=${p}&page_size=${page_size}`
  if (status !== undefined && status > 0) url += `&status=${status}`
  const res = await api.get(url)
  return res.data
}

export async function getStudioProject(
  id: number
): Promise<ApiResponse<StudioProjectWithStages>> {
  const res = await api.get(`/api/studio/projects/${id}`)
  return res.data
}

export async function createStudioProject(
  data: StudioProjectFormData
): Promise<ApiResponse<StudioProjectWithStages>> {
  const res = await api.post('/api/studio/projects', data)
  return res.data
}

export async function updateStudioProject(
  id: number,
  data: Partial<StudioProjectFormData & { status: number }>
): Promise<ApiResponse<StudioProject>> {
  const res = await api.put(`/api/studio/projects/${id}`, data)
  return res.data
}

export async function deleteStudioProject(
  id: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/studio/projects/${id}`)
  return res.data
}

// ============================================================================
// Stages
// ============================================================================

export async function getStudioStages(
  projectId: number
): Promise<ApiResponse<StudioStage[]>> {
  const res = await api.get(`/api/studio/projects/${projectId}/stages`)
  return res.data
}

export async function updateStudioStage(
  projectId: number,
  key: string,
  data: { status?: number; total_items?: number; done_items?: number; output_data?: string }
): Promise<ApiResponse<StudioStage>> {
  const res = await api.put(
    `/api/studio/projects/${projectId}/stages/${key}`,
    data
  )
  return res.data
}

// ============================================================================
// Shots
// ============================================================================

export async function getStudioShots(
  projectId: number
): Promise<ApiResponse<StudioShot[]>> {
  const res = await api.get(`/api/studio/projects/${projectId}/shots`)
  return res.data
}

export async function createStudioShots(
  projectId: number,
  shots: StudioShotFormData[]
): Promise<ApiResponse<StudioShot[]>> {
  const res = await api.post(
    `/api/studio/projects/${projectId}/shots`,
    { shots }
  )
  return res.data
}

export async function updateStudioShot(
  projectId: number,
  shotId: number,
  data: Partial<StudioShotFormData & { image_url: string; video_url: string; video_task_id: string; status: number }>
): Promise<ApiResponse<StudioShot>> {
  const res = await api.put(
    `/api/studio/projects/${projectId}/shots/${shotId}`,
    data
  )
  return res.data
}

export async function deleteStudioShot(
  projectId: number,
  shotId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/studio/projects/${projectId}/shots/${shotId}`
  )
  return res.data
}

// ============================================================================
// Characters
// ============================================================================

export async function getStudioCharacters(
  projectId: number
): Promise<ApiResponse<StudioCharacter[]>> {
  const res = await api.get(`/api/studio/projects/${projectId}/characters`)
  return res.data
}

export async function createStudioCharacter(
  projectId: number,
  data: StudioCharacterFormData
): Promise<ApiResponse<StudioCharacter>> {
  const res = await api.post(
    `/api/studio/projects/${projectId}/characters`,
    data
  )
  return res.data
}

export async function updateStudioCharacter(
  projectId: number,
  charId: number,
  data: Partial<StudioCharacterFormData>
): Promise<ApiResponse<StudioCharacter>> {
  const res = await api.put(
    `/api/studio/projects/${projectId}/characters/${charId}`,
    data
  )
  return res.data
}

export async function deleteStudioCharacter(
  projectId: number,
  charId: number
): Promise<ApiResponse> {
  const res = await api.delete(
    `/api/studio/projects/${projectId}/characters/${charId}`
  )
  return res.data
}

// ============================================================================
// AI Generation
// ============================================================================

export interface StudioQuickGenRequest {
  type: 'image' | 'analyze' | 'describe'
  prompt: string
  stage_key?: string
  shot_id?: number
  model?: string
  size?: string
}

export interface StudioQuickGenResponse {
  type: string
  record_id?: number
  image_url?: string
  text?: string
  shot_id?: number
}

export async function studioQuickGenerate(
  projectId: number,
  data: StudioQuickGenRequest
): Promise<ApiResponse<StudioQuickGenResponse>> {
  const res = await api.post(
    `/api/studio/projects/${projectId}/quick-generate`,
    data
  )
  return res.data
}

export interface StudioShotGenRequest {
  type?: 'image' | 'video'
  model?: string
  size?: string
}

export async function studioShotGenerate(
  projectId: number,
  shotId: number,
  data?: StudioShotGenRequest
): Promise<ApiResponse<{ type: string; record_id: number; shot_id: number }>> {
  const res = await api.post(
    `/api/studio/projects/${projectId}/shots/${shotId}/generate`,
    data ?? {}
  )
  return res.data
}

// ============================================================================
// AI Agent (Hermes Execution Tasks)
// ============================================================================

export interface StudioAgentCreateRequest {
  skill: string
  stage_key?: string
  context?: string
  model?: string
}

export interface StudioAgentCreateResponse {
  task_id: string
  status: string
  title: string
}

export async function studioAgentCreate(
  projectId: number,
  data: StudioAgentCreateRequest
): Promise<ApiResponse<StudioAgentCreateResponse>> {
  const res = await api.post(
    `/api/studio/projects/${projectId}/agent-create`,
    data
  )
  return res.data
}
