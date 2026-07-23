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
import type { WorkflowPreset } from './types'

const STORAGE_KEY = 'comfyui-presets'

function readStore(): Record<string, WorkflowPreset> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function writeStore(data: Record<string, WorkflowPreset>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

export function loadPresets(): WorkflowPreset[] {
  const store = readStore()
  return Object.values(store).sort((a, b) => b.savedAt - a.savedAt)
}

export function savePreset(preset: WorkflowPreset): void {
  const store = readStore()
  store[preset.name] = preset
  writeStore(store)
}

export function deletePreset(name: string): void {
  const store = readStore()
  delete store[name]
  writeStore(store)
}

export function renamePreset(oldName: string, newName: string): boolean {
  const store = readStore()
  if (store[newName] && oldName !== newName) return false
  const preset = store[oldName]
  if (!preset) return false
  delete store[oldName]
  store[newName] = { ...preset, name: newName }
  writeStore(store)
  return true
}
