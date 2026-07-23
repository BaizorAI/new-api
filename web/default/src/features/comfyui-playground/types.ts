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
