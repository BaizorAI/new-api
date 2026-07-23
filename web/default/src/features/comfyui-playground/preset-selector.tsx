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
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Trash2, Pencil, Check, X } from 'lucide-react'

import { renamePreset } from './preset-manager'
import type { WorkflowPreset } from './types'

interface PresetSelectorProps {
  presets: WorkflowPreset[]
  disabled: boolean
  onSave: (name: string) => void
  onLoad: (preset: WorkflowPreset) => void
  onDelete: (name: string) => void
  onRename: (oldName: string, newName: string) => void
}

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  return new Date(ts).toLocaleDateString()
}

export function PresetSelector({
  presets,
  disabled,
  onSave,
  onLoad,
  onDelete,
  onRename,
}: PresetSelectorProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [saveName, setSaveName] = useState('')
  const [editingName, setEditingName] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSave = () => {
    const name = saveName.trim()
    if (!name) return
    onSave(name)
    setSaveName('')
  }

  const handleStartEdit = (name: string) => {
    setEditingName(name)
    setEditValue(name)
  }

  const handleConfirmEdit = () => {
    if (editingName && editValue.trim() && editValue.trim() !== editingName) {
      onRename(editingName, editValue.trim())
    }
    setEditingName(null)
    setEditValue('')
  }

  const handleSaveKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSave()
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleConfirmEdit()
    if (e.key === 'Escape') setEditingName(null)
  }

  return (
    <div className='relative'>
      <button
        className='rounded-lg px-3 py-1 text-sm font-medium text-muted-foreground
          transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50'
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
      >
        {t('Presets')}
        {presets.length > 0 && (
          <span className='ml-1 text-xs text-muted-foreground'>({presets.length})</span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className='absolute left-0 top-full z-50 mt-1 w-72 rounded-lg border bg-card shadow-xl'
        >
          {/* Save row */}
          <div className='flex gap-1.5 border-b p-2'>
            <input
              ref={inputRef}
              type='text'
              className='min-w-0 flex-1 rounded border bg-background px-2 py-1 text-xs
                focus:outline-none focus:ring-1 focus:ring-primary/30'
              placeholder={t('Preset name...')}
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              onKeyDown={handleSaveKeyDown}
            />
            <button
              className='shrink-0 rounded bg-primary px-2.5 py-1 text-xs font-medium
                text-primary-foreground transition-opacity hover:opacity-80
                disabled:opacity-40'
              disabled={!saveName.trim()}
              onClick={handleSave}
            >
              {t('Save')}
            </button>
          </div>

          {/* Preset list */}
          <div className='max-h-64 overflow-y-auto'>
            {presets.length === 0 ? (
              <p className='px-3 py-4 text-center text-xs text-muted-foreground'>
                {t('No saved presets.')}
              </p>
            ) : (
              presets.map((preset) => (
                <div
                  key={preset.name}
                  className='flex items-center gap-1.5 border-b
                    border-muted/50 px-2 py-1.5 last:border-b-0
                    hover:bg-muted/50'
                >
                  {editingName === preset.name ? (
                    <>
                      <input
                        type='text'
                        className='min-w-0 flex-1 rounded border bg-background px-1.5 py-0.5 text-xs
                          focus:outline-none focus:ring-1 focus:ring-primary/30'
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={handleEditKeyDown}
                        autoFocus
                      />
                      <button
                        className='rounded p-0.5 hover:bg-background'
                        onClick={handleConfirmEdit}
                      >
                        <Check className='h-3 w-3 text-green-500' />
                      </button>
                      <button
                        className='rounded p-0.5 hover:bg-background'
                        onClick={() => setEditingName(null)}
                      >
                        <X className='h-3 w-3 text-muted-foreground' />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className='min-w-0 flex-1 truncate px-1 py-0.5 text-left text-xs
                          transition-colors hover:text-primary'
                        onClick={() => onLoad(preset)}
                      >
                        <span className='font-medium'>{preset.name}</span>
                        <span className='ml-2 text-[10px] text-muted-foreground'>
                          {timeAgo(preset.savedAt)}
                        </span>
                      </button>
                      <button
                        className='shrink-0 rounded p-0.5 text-muted-foreground
                          hover:bg-background hover:text-foreground'
                        onClick={() => handleStartEdit(preset.name)}
                      >
                        <Pencil className='h-3 w-3' />
                      </button>
                      <button
                        className='shrink-0 rounded p-0.5 text-muted-foreground
                          hover:bg-red-100 hover:text-red-500'
                        onClick={() => onDelete(preset.name)}
                      >
                        <Trash2 className='h-3 w-3' />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
