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
import { type ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { formatTimestampToDate } from '@/lib/format'

import { BLOG_ARTICLE_STATUSES } from '../constants'
import { type BlogArticle } from '../types'
import { BlogHallRowActions } from './blog-hall-row-actions'

export function useBlogHallColumns(): ColumnDef<BlogArticle>[] {
  const { t } = useTranslation()
  return [
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <TableId value={row.getValue('id') as number} className='w-[60px]' />
      ),
      size: 80,
    },
    {
      accessorKey: 'title',
      header: t('Title'),
      meta: { mobileTitle: true },
      cell: ({ row }) => (
        <span className='font-medium'>{row.getValue('title')}</span>
      ),
      size: 260,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: ({ row }) => {
        const status = row.getValue('status') as BlogArticle['status']
        const cfg = BLOG_ARTICLE_STATUSES[status]
        if (!cfg) return null
        return (
          <StatusBadge
            label={t(cfg.labelKey)}
            variant={cfg.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      filterFn: (row, id, value: string[]) =>
        value.includes(row.getValue(id) as string),
      size: 120,
    },
    {
      id: 'author',
      header: t('Author'),
      meta: { mobileHidden: true },
      accessorFn: (row) => row.author?.display_name ?? row.author_id,
      cell: ({ row }) => {
        const article = row.original
        const author = article.author
        const authorId = article.author_id
        const displayName = author?.display_name
        if (!displayName) {
          return (
            <span className='text-muted-foreground text-sm'>
              ID: {authorId}
            </span>
          )
        }
        return (
          <div className='flex flex-col'>
            <span className='text-sm'>{displayName}</span>
            <span className='text-muted-foreground text-xs'>
              ID: {authorId}
            </span>
          </div>
        )
      },
      size: 160,
    },
    {
      accessorKey: 'tags',
      header: t('Tags'),
      meta: { mobileHidden: true },
      cell: ({ row }) => {
        const tags = row.getValue('tags') as string[]
        if (!tags.length) {
          return <span className='text-muted-foreground text-sm'>—</span>
        }
        return (
          <div className='flex flex-wrap gap-1'>
            {tags.slice(0, 3).map((tag) => (
              <StatusBadge
                key={tag}
                label={tag}
                variant='neutral'
                copyable={false}
                className='-ml-0 text-xs'
              />
            ))}
            {tags.length > 3 && (
              <span className='text-muted-foreground text-xs self-center'>
                +{tags.length - 3}
              </span>
            )}
          </div>
        )
      },
      size: 200,
    },
    {
      accessorKey: 'created_time',
      header: t('Created'),
      meta: { mobileHidden: true },
      cell: ({ row }) => (
        <div className='min-w-[160px] font-mono text-sm'>
          {formatTimestampToDate(row.getValue('created_time'))}
        </div>
      ),
      size: 180,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: ({ row }) => <BlogHallRowActions row={row} />,
      meta: { pinned: 'right' as const },
    },
  ]
}
