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
export interface ComfyuiGenerateRequest {
  prompt: string
  width?: number
  height?: number
  frames?: number
  steps?: number
}

export interface ComfyuiFile {
  filename: string
  comfyui_url: string
  local_url: string
  local_path: string
  scp_ok: boolean
  scp_error: string
  node_id: string
}

export interface ComfyuiGenerateResponse {
  status: string
  prompt_id: string
  files: ComfyuiFile[]
  width: number
  height: number
  frames: number
  steps: number
  error?: string
}

export interface ComfyuiChatChoice {
  index: number
  message: {
    role: string
    content: string
  }
  finish_reason: string
}

export interface ComfyuiChatResponse {
  id: string
  object: string
  created: number
  model: string
  choices: ComfyuiChatChoice[]
}

export interface QueueStatus {
  queue_position: number
  status: 'queued' | 'processing' | 'done'
}

// ── Workflow-related types ───────────────────────────────────────────────

/** A ComfyUI workflow node (API format). */
export interface ComfyuiWorkflowNode {
  class_type: string
  _meta?: { title: string }
  inputs: Record<string, ComfyuiNodeInput>
}

/** An input value: primitive or a connection tuple [sourceNodeId, outputIndex]. */
export type ComfyuiNodeInput = string | number | boolean | ComfyuiNodeConnection

export type ComfyuiNodeConnection = [string, number]

/** Full ComfyUI workflow: nodeId → node. */
export interface ComfyuiWorkflow {
  [nodeId: string]: ComfyuiWorkflowNode
}

/** A single adjustable parameter discovered by the backend. */
export interface AdjustableParam {
  node_id: string
  class_type: string
  title: string
  field_name: string
  type: 'string' | 'number' | 'boolean'
  default_value: unknown
}

/** Workflow file in the listing. */
export interface WorkflowListItem {
  name: string
  path: string
}

/** Response from GET /pg/hermes/comfyui-workflows. */
export interface WorkflowListResponse {
  workflows: WorkflowListItem[]
}

/** Response from GET /pg/hermes/comfyui-workflows/:name. */
export interface WorkflowDetail {
  name: string
  workflow: ComfyuiWorkflow
  adjustable_params: AdjustableParam[]
}

/** A user-saved workflow preset stored in localStorage. */
export interface WorkflowPreset {
  name: string
  savedAt: number
  workflow: ComfyuiWorkflow
  workflowName: string | null
}

/** A past generation result saved in localStorage. */
export interface GenerationEntry {
  id: string
  prompt: string
  enhancedPrompt: string
  width: number
  height: number
  frames: number
  steps: number
  seed: number
  cfg: number
  promptId: string
  videos: { name: string; url: string }[]
  workflowName: string | null
  createdAt: number
}
