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

import { clearHistory } from './history-manager'
import type { GenerationEntry } from './types'

interface HistoryPanelProps {
  history: GenerationEntry[]
  onLoad: (entry: GenerationEntry) => void
  onRefresh: () => void
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

export function HistoryPanel({ history, onLoad, onRefresh }: HistoryPanelProps) {
  const { t } = useTranslation()

  if (history.length === 0) return null

  return (
    <div className='rounded-lg border p-3'>
      <div className='mb-2 flex items-center justify-between'>
        <p className='text-xs font-semibold text-muted-foreground'>
          {t('Generation History')}
        </p>
        <button
          className='text-[10px] text-muted-foreground transition-colors hover:text-red-500'
          onClick={() => {
            clearHistory()
            onRefresh()
          }}
        >
          {t('Clear')}
        </button>
      </div>
      <div className='max-h-52 space-y-1.5 overflow-y-auto'>
        {history.map((entry) => (
          <button
            key={entry.id}
            className='w-full rounded border border-muted/50 px-2 py-1.5 text-left
              transition-colors hover:bg-muted/50'
            onClick={() => onLoad(entry)}
          >
            <p className='truncate text-[11px] leading-tight'>
              {entry.prompt || entry.enhancedPrompt}
            </p>
            <div className='mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground'>
              <span>
                {entry.width}×{entry.height}
              </span>
              {entry.frames > 1 && (
                <span> · {entry.frames}f</span>
              )}
              <span> · {entry.steps}s</span>
              {entry.cfg != null && entry.cfg > 0 && (
                <span> · CFG {entry.cfg}</span>
              )}
              {entry.videos.length > 0 && (
                <span className='rounded-full bg-green-100 px-1 text-[9px] text-green-700 dark:bg-green-900/30 dark:text-green-400'>
                  {entry.videos.length}
                </span>
              )}
              <span className='ml-auto'>{timeAgo(entry.createdAt)}</span>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
