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
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Search, Plus } from 'lucide-react'

import { filterNodeLibrary, LIBRARY_CATEGORIES } from './node-library'
import type { LibraryCategory } from './node-library'

interface NodeLibraryPanelProps {
  onAddNode: (classType: string) => void
}

const CATEGORY_LABELS: Record<LibraryCategory, string> = {
  loaders: 'Loaders',
  conditioning: 'Conditioning',
  latent: 'Latent',
  sampling: 'Sampling',
  output: 'Output',
  primitives: 'Primitives',
  other: 'Other',
}

export function NodeLibraryPanel({ onAddNode }: NodeLibraryPanelProps) {
  const { t } = useTranslation()
  const [collapsed, setCollapsed] = useState(false)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<LibraryCategory | 'all'>('all')

  const results = useMemo(
    () => filterNodeLibrary(query, category),
    [query, category],
  )

  return (
    <div className='border-t'>
      {/* Header / collapse toggle */}
      <button
        className='flex w-full items-center justify-between px-3 py-2 text-xs font-semibold
          text-muted-foreground hover:text-foreground transition-colors'
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>{t('Node Library')}</span>
        {collapsed ? <ChevronRight className='h-3.5 w-3.5' /> : <ChevronDown className='h-3.5 w-3.5' />}
      </button>

      {!collapsed && (
        <div className='px-2 pb-2 space-y-1.5'>
          {/* Search */}
          <div className='relative'>
            <Search className='absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground' />
            <input
              type='text'
              className='w-full rounded border bg-background py-1 pl-6 pr-2 text-[11px]
                placeholder:text-muted-foreground/50
                focus:outline-none focus:ring-1 focus:ring-primary/30'
              placeholder={t('Search nodes...')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>

          {/* Category tabs */}
          <div className='flex flex-wrap gap-0.5'>
            <button
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors
                ${category === 'all' ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
              onClick={() => setCategory('all')}
            >
              {t('All')}
            </button>
            {LIBRARY_CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors
                  ${category === cat ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                onClick={() => setCategory(cat)}
              >
                {CATEGORY_LABELS[cat]}
              </button>
            ))}
          </div>

          {/* Node list */}
          <div className='max-h-64 overflow-y-auto space-y-0.5'>
            {results.length === 0 ? (
              <p className='text-[10px] text-muted-foreground px-1 py-3 text-center'>
                {t('No nodes found')}
              </p>
            ) : (
              results.map((entry) => (
                <button
                  key={entry.classType}
                  className='flex w-full items-center justify-between rounded px-2 py-1
                    text-left hover:bg-muted/50 transition-colors group/item'
                  onClick={() => onAddNode(entry.classType)}
                >
                  <div className='min-w-0'>
                    <p className='text-[11px] font-medium truncate text-foreground/80'>
                      {entry.defaultMeta?.title ?? entry.classType}
                    </p>
                    <p className='text-[10px] text-muted-foreground truncate'>
                      {entry.classType}
                    </p>
                  </div>
                  <Plus className='h-3 w-3 shrink-0 text-muted-foreground opacity-0
                    group-hover/item:opacity-100 transition-opacity' />
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
