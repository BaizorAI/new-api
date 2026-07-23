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
import type { AdjustableParam, ComfyuiWorkflow } from './types'

const STORAGE_KEY = 'comfyui-autosave'
const SAVE_DELAY = 2000

let saveTimer: ReturnType<typeof setTimeout> | null = null

export interface AutoSaveData {
  workflow: ComfyuiWorkflow
  enhancedPrompt: string
  workflowName: string | null
  adjustableParams: AdjustableParam[]
  savedAt: number
}

export function scheduleAutoSave(data: AutoSaveData): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    } catch {
      // localStorage full or unavailable
    }
    saveTimer = null
  }, SAVE_DELAY)
}

export function loadAutoSave(): AutoSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as AutoSaveData
  } catch {
    return null
  }
}

export function clearAutoSave(): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignored
  }
}

export function hasAutoSave(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null
  } catch {
    return false
  }
}
