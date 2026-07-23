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
import { useTranslation } from 'react-i18next'

import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { loadAutoSave } from './auto-save-manager'

function timeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return new Date(ts).toLocaleDateString()
}

interface RestoreDraftDialogProps {
  open: boolean
  onRestore: () => void
  onDiscard: () => void
}

export function RestoreDraftDialog({
  open,
  onRestore,
  onDiscard,
}: RestoreDraftDialogProps) {
  const { t } = useTranslation()
  const data = loadAutoSave()
  const savedAt = data?.savedAt ?? 0
  const workflowName = data?.workflowName

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onDiscard() }}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('Unsaved Draft Found')}</DialogTitle>
          <DialogDescription>
            {t('Found an unsaved workflow draft. Would you like to restore it?')}
            {workflowName && (
              <span className='block mt-1 text-muted-foreground'>
                {workflowName} &middot; {timeAgo(savedAt)}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <button
            type='button'
            className='rounded-lg border px-3 py-1.5 text-sm
              transition-colors hover:bg-muted'
            onClick={onDiscard}
          >
            {t('Discard')}
          </button>
          <button
            type='button'
            className='rounded-lg bg-primary px-4 py-1.5 text-sm font-medium
              text-primary-foreground transition-opacity hover:opacity-80'
            onClick={onRestore}
          >
            {t('Restore')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
