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
import { useQueryClient } from '@tanstack/react-query'
import { type Table } from '@tanstack/react-table'
import { Archive, Loader2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableBulkActions as BulkActionsToolbar } from '@/components/data-table'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { BLOG_ARTICLE_STATUS } from '@/features/blog-hall/constants'

import {
  batchDeleteBlogArticles,
  batchUpdateBlogArticles,
} from '../api'
import { type BlogArticle } from '../types'

interface BlogHallBulkActionsProps {
  table: Table<BlogArticle>
}

export function BlogHallBulkActions({ table }: BlogHallBulkActionsProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [pendingAction, setPendingAction] = useState<
    'publish' | 'archive' | 'delete' | null
  >(null)

  const selectedRows = table.getFilteredSelectedRowModel().rows
  const selectedIds = selectedRows.reduce<number[]>((ids, row) => {
    const id = row.original.id
    if (typeof id === 'number') {
      ids.push(id)
    }
    return ids
  }, [])

  const handleClearSelection = () => {
    table.resetRowSelection()
  }

  const handleBatchUpdate = async (status: BlogArticle['status']) => {
    if (selectedIds.length === 0) return
    setPendingAction(status === BLOG_ARTICLE_STATUS.PUBLISHED ? 'publish' : 'archive')
    try {
      const result = await batchUpdateBlogArticles({ ids: selectedIds, status })
      if (result.success) {
        const messageKey =
          status === BLOG_ARTICLE_STATUS.PUBLISHED
            ? '{{count}} article(s) published'
            : '{{count}} article(s) archived'
        toast.success(t(messageKey, { count: selectedIds.length }))
        handleClearSelection()
        await queryClient.invalidateQueries({ queryKey: ['blog-articles'] })
      } else {
        toast.error(result.message || t('Failed to update articles'))
      }
    } finally {
      setPendingAction(null)
    }
  }

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return
    setPendingAction('delete')
    try {
      const result = await batchDeleteBlogArticles(selectedIds)
      if (result.success) {
        toast.success(
          t('{{count}} article(s) deleted', { count: selectedIds.length })
        )
        setShowDeleteConfirm(false)
        handleClearSelection()
        await queryClient.invalidateQueries({ queryKey: ['blog-articles'] })
      } else {
        toast.error(result.message || t('Failed to delete articles'))
      }
    } finally {
      setPendingAction(null)
    }
  }

  const isLoading = pendingAction !== null

  return (
    <>
      <BulkActionsToolbar table={table} entityName='article'>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={() => handleBatchUpdate(BLOG_ARTICLE_STATUS.PUBLISHED)}
                disabled={isLoading}
                className='size-8'
                aria-label={t('Publish selected articles')}
                title={t('Publish selected articles')}
              />
            }
          >
            {pendingAction === 'publish' ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Archive className='rotate-180' />
            )}
            <span className='sr-only'>{t('Publish selected articles')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Publish selected articles')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='outline'
                size='icon'
                onClick={() => handleBatchUpdate(BLOG_ARTICLE_STATUS.ARCHIVED)}
                disabled={isLoading}
                className='size-8'
                aria-label={t('Archive selected articles')}
                title={t('Archive selected articles')}
              />
            }
          >
            {pendingAction === 'archive' ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Archive />
            )}
            <span className='sr-only'>{t('Archive selected articles')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Archive selected articles')}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                variant='destructive'
                size='icon'
                onClick={() => setShowDeleteConfirm(true)}
                disabled={isLoading}
                className='size-8'
                aria-label={t('Delete selected articles')}
                title={t('Delete selected articles')}
              />
            }
          >
            {pendingAction === 'delete' ? (
              <Loader2 className='animate-spin' />
            ) : (
              <Trash2 />
            )}
            <span className='sr-only'>{t('Delete selected articles')}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p>{t('Delete selected articles')}</p>
          </TooltipContent>
        </Tooltip>
      </BulkActionsToolbar>

      <Dialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title={t('Delete Articles?')}
        description={t(
          'Are you sure you want to delete {{count}} selected article(s)? This action cannot be undone.',
          { count: selectedIds.length }
        )}
        contentHeight='auto'
        footer={
          <>
            <Button
              variant='outline'
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isLoading}
            >
              {t('Cancel')}
            </Button>
            <Button
              variant='destructive'
              onClick={handleBatchDelete}
              disabled={isLoading}
            >
              {pendingAction === 'delete' && (
                <Loader2 className='animate-spin' />
              )}
              {t('Delete')}
            </Button>
          </>
        }
      >
        {null}
      </Dialog>
    </>
  )
}
