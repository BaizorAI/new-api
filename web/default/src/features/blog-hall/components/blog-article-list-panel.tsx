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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useLocation, useNavigate, useParams } from '@tanstack/react-router'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

import { createBlogArticle, deleteBlogArticle, getBlogArticles } from '../api'
import { groupArticlesByTime } from '../lib/time-groups'

export function BlogArticleListPanel() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const href = useLocation({ select: (l) => l.href })
  const params = useParams({ strict: false })
  const activeArticleId = 'articleId' in params ? Number(params.articleId) : null
  const queryClient = useQueryClient()
  const [isCreating, setIsCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const { data } = useQuery({
    queryKey: ['blog-articles-sidebar'],
    queryFn: () => getBlogArticles({ p: 1, page_size: 50 }),
    staleTime: 30_000,
  })

  const articles = data?.data?.items ?? []
  const timeGroups = useMemo(() => groupArticlesByTime(articles), [articles])

  const handleCreate = async () => {
    if (isCreating) return
    setIsCreating(true)
    try {
      const result = await createBlogArticle({
        title: t('Untitled article'),
        summary: '',
        content: '',
        tags: [],
        status: 'draft',
      })
      if (result.success && result.data) {
        void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
        await navigate({
          to: '/blog-hall/$articleId',
          params: { articleId: String(result.data.id) },
        })
      }
    } finally {
      setIsCreating(false)
    }
  }

  const handleDelete = async () => {
    if (deletingId === null) return
    const idToDelete = deletingId
    setDeletingId(null)
    const result = await deleteBlogArticle(idToDelete)
    if (result.success) {
      toast.success(t('Article deleted.'))
      void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
      if (href.includes(`/blog-hall/${idToDelete}`)) {
        void navigate({ to: '/blog-hall' })
      }
    }
  }

  const deletingArticle = articles.find((a) => a.id === deletingId)

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-border shrink-0 border-b p-3'>
        <Button
          className='w-full'
          disabled={isCreating}
          onClick={() => void handleCreate()}
          size='sm'
        >
          <Plus className='size-4' aria-hidden='true' />
          {t('New Blog')}
        </Button>
      </div>

      {/* Article list */}
      <ScrollArea className='flex-1'>
        <div className='p-2'>
          {timeGroups.length === 0 && (
            <div className='flex flex-col items-center gap-2 py-8 text-center'>
              <FileText className='text-muted-foreground/40 size-8' aria-hidden='true' />
              <p className='text-muted-foreground text-xs'>
                {t('No articles yet')}
              </p>
            </div>
          )}

          {timeGroups.map((group) => (
            <div key={group.labelKey} className='mb-3'>
              <div className='text-muted-foreground px-2 py-1.5 text-xs font-medium'>
                {t(group.labelKey)}
              </div>
              {group.articles.map((article) => {
                const isActive = activeArticleId === article.id
                return (
                  <div
                    key={article.id}
                    className='group relative'
                  >
                    <Link
                      to='/blog-hall/$articleId'
                      params={{ articleId: String(article.id) }}
                      className={`block truncate rounded-md px-2 py-1.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-primary/10 text-primary font-medium'
                          : 'text-foreground hover:bg-muted'
                      }`}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      {article.title || t('Untitled article')}
                    </Link>
                    <button
                      type='button'
                      className='absolute top-1/2 right-1.5 hidden -translate-y-1/2 rounded-sm p-0.5 opacity-0 transition-opacity group-hover:block group-hover:opacity-70 hover:opacity-100'
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setDeletingId(article.id)
                      }}
                      aria-label={t('Delete')}
                      title={t('Delete')}
                    >
                      <Trash2 className='text-muted-foreground size-3.5' aria-hidden='true' />
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Delete confirmation */}
      <AlertDialog
        open={deletingId !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('Delete Article')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('This will permanently delete the article')}{' '}
              &ldquo;{deletingArticle?.title}&rdquo;.{' '}
              {t('This action cannot be undone.')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('Cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              {t('Delete')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
