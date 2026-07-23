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
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className='inline-flex items-center justify-center rounded-md border
      border-b-2 bg-muted px-1.5 py-0.5 text-[11px] font-medium
      min-w-[22px] text-muted-foreground'>
      {children}
    </kbd>
  )
}

interface ShortcutEntry {
  keys: string[]
  label: string
}

function isMac(): boolean {
  return /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

function modKey(): string {
  return isMac() ? '⌘' : 'Ctrl'
}

function shiftKey(): string {
  return isMac() ? '⇧' : 'Shift'
}

export function ShortcutsDialog({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const { t } = useTranslation()
  const mod = modKey()
  const shift = shiftKey()

  const shortcuts: ShortcutEntry[] = [
    { keys: ['?'], label: t('Keyboard Shortcuts') },
    { keys: [mod, 'Z'], label: t('Undo') },
    { keys: [mod, shift, 'Z'], label: t('Redo') },
    { keys: [mod, 'S'], label: t('Export Workflow') },
    { keys: [mod, 'I'], label: t('Import Workflow') },
  ]

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
      <DialogContent className='sm:max-w-sm'>
        <DialogHeader>
          <DialogTitle>{t('Keyboard Shortcuts')}</DialogTitle>
        </DialogHeader>

        <div className='space-y-1'>
          {shortcuts.map((sc) => (
            <div
              key={sc.label}
              className='flex items-center justify-between rounded px-2 py-1.5
                text-sm'
            >
              <span>{sc.label}</span>
              <span className='flex items-center gap-0.5'>
                {sc.keys.map((k, i) => (
                  <Kbd key={i}>{k}</Kbd>
                ))}
              </span>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
