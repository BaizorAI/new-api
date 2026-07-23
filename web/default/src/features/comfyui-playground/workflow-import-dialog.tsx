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
import { useState, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { parseImportedWorkflow } from './api'
import type { WorkflowDetail } from './types'

interface WorkflowImportDialogProps {
  open: boolean
  onClose: () => void
  onImport: (detail: WorkflowDetail) => void
}

export function WorkflowImportDialog({
  open,
  onClose,
  onImport,
}: WorkflowImportDialogProps) {
  const { t } = useTranslation()
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImport = () => {
    try {
      const detail = parseImportedWorkflow(jsonText.trim())
      setError(null)
      onImport(detail)
      onClose()
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? `${t('Invalid workflow JSON')}: ${e.message}`
          : t('Invalid workflow JSON'),
      )
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setJsonText(reader.result as string)
      setError(null)
    }
    reader.readAsText(file)
    // Reset so the same file can be selected again
    e.target.value = ''
  }

  const handleClose = () => {
    setJsonText('')
    setError(null)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose() }}>
      <DialogContent className='sm:max-w-lg'>
        <DialogHeader>
          <DialogTitle>{t('Import Workflow')}</DialogTitle>
        </DialogHeader>

        <div className='flex flex-col gap-2'>
          <textarea
            className='min-h-[240px] w-full rounded-lg border bg-background px-3 py-2
              font-mono text-xs resize-y focus:outline-none focus:ring-2
              focus:ring-primary/20'
            value={jsonText}
            onChange={(e) => {
              setJsonText(e.target.value)
              setError(null)
            }}
            placeholder={t('Paste ComfyUI workflow JSON here...')}
            spellCheck={false}
          />

          <div>
            <input
              ref={fileInputRef}
              type='file'
              accept='.json'
              className='hidden'
              onChange={handleFileSelect}
            />
            <button
              type='button'
              className='flex items-center gap-1.5 rounded-lg border border-dashed
                border-muted-foreground/30 px-3 py-1.5 text-xs text-muted-foreground
                transition-colors hover:border-primary/50 hover:text-primary'
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className='h-3 w-3' />
              {t('Upload file')}
            </button>
          </div>

          {error && (
            <p className='text-xs text-destructive'>{error}</p>
          )}
        </div>

        <DialogFooter>
          <button
            type='button'
            className='rounded-lg border px-3 py-1.5 text-sm transition-colors
              hover:bg-muted'
            onClick={handleClose}
          >
            {t('Cancel')}
          </button>
          <button
            type='button'
            className='rounded-lg bg-primary px-4 py-1.5 text-sm font-medium
              text-primary-foreground transition-opacity hover:opacity-80
              disabled:opacity-50'
            disabled={!jsonText.trim()}
            onClick={handleImport}
          >
            {t('Import')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
