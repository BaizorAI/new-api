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
import { type Table } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import {
  CardRowContent,
  MobileCardList,
  tableHasCompactMeta,
} from '@/components/data-table'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

import { type BlogArticle } from '../types'

interface BlogHallMobileListProps {
  table: Table<BlogArticle>
  isLoading?: boolean
  emptyTitle?: string
  emptyDescription?: string
}

export function BlogHallMobileList({
  table,
  isLoading,
  emptyTitle,
  emptyDescription,
}: BlogHallMobileListProps) {
  const { t } = useTranslation()
  const rows = table.getRowModel().rows
  const compact = tableHasCompactMeta(table)
  const selectedCount = table.getSelectedRowModel().rows.length

  if (isLoading || rows.length === 0) {
    return (
      <MobileCardList
        table={table}
        isLoading={isLoading}
        emptyTitle={emptyTitle}
        emptyDescription={emptyDescription}
      />
    )
  }

  return (
    <div className='divide-y overflow-hidden rounded-lg border'>
      {/* Select-all header */}
      <div className='flex items-center justify-between gap-3 bg-muted/30 px-3 py-2'>
        <span className='text-muted-foreground text-xs'>
          {selectedCount > 0
            ? t('{{count}} selected', { count: selectedCount })
            : t('Select items for bulk actions')}
        </span>
        <Checkbox
          checked={table.getIsAllPageRowsSelected()}
          indeterminate={table.getIsSomePageRowsSelected()}
          onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          aria-label={t('Select all')}
        />
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          className={cn(
            'relative pr-10',
            'px-3 py-2.5',
            row.getIsSelected() && 'bg-muted/50'
          )}
        >
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label={t('Select row')}
            className='absolute top-2.5 right-3'
          />
          <CardRowContent row={row} compact={compact} />
        </div>
      ))}
    </div>
  )
}
