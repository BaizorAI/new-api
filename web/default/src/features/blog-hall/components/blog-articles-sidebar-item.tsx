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
import { Link, useLocation, useNavigate } from '@tanstack/react-router'
import { Plus, Trash2 } from 'lucide-react'
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
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'

import type { NavBlogArticles } from '@/components/layout/types'
import { SidebarCollapsibleShell } from '@/components/layout/components/sidebar-collapsible-shell'
import { createBlogArticle, deleteBlogArticle, getBlogArticles } from '../api'
import { groupArticlesByTime } from '../lib/time-groups'

type Props = { item: NavBlogArticles }

export function BlogArticlesItem({ item }: Props) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const href = useLocation({ select: (l) => l.href })
  const { setOpenMobile } = useSidebar()
  const queryClient = useQueryClient()
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const isBlogActive = href.startsWith('/blog-hall')

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
        setOpenMobile(false)
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
        void navigate({ to: '/blog-hall/' })
      }
    }
  }

  const expandedContent = (
    <>
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          onClick={() => void handleCreate()}
          disabled={isCreating}
        >
          <Plus className='size-3.5' aria-hidden='true' />
          <span>{t('New Article')}</span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>

      {articles.length === 0 && (
        <SidebarMenuSubItem>
          <span className='text-muted-foreground px-2 py-1 text-xs italic'>
            {t('No articles yet')}
          </span>
        </SidebarMenuSubItem>
      )}

      {timeGroups.map((group) => (
        <SidebarMenuSubItem key={group.labelKey}>
          <span className='text-muted-foreground px-2 pt-2 pb-0.5 text-[10px] font-medium uppercase tracking-wider'>
            {t(group.labelKey)}
          </span>
          {group.articles.map((article) => {
            const isActive =
              href === `/blog-hall/${article.id}` ||
              href === `/blog-hall/${article.id}/`
            return (
              <SidebarMenuSubItem key={article.id}>
                <SidebarMenuSubButton
                  isActive={isActive}
                  render={
                    <Link
                      to='/blog-hall/$articleId'
                      params={{ articleId: String(article.id) }}
                      onClick={() => setOpenMobile(false)}
                      aria-current={isActive ? 'page' : undefined}
                    />
                  }
                >
                  <span className='min-w-0 flex-1 truncate'>{article.title}</span>
                </SidebarMenuSubButton>
                <SidebarMenuAction
                  showOnHover
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setDeletingId(article.id)
                  }}
                  aria-label={t('Delete')}
                  title={t('Delete')}
                >
                  <Trash2 className='size-3.5' aria-hidden='true' />
                </SidebarMenuAction>
              </SidebarMenuSubItem>
            )
          })}
        </SidebarMenuSubItem>
      ))}
    </>
  )

  const collapsedContent = (
    <>
      <DropdownMenuItem
        onClick={() => void handleCreate()}
        disabled={isCreating}
      >
        <Plus className='size-4' aria-hidden='true' />
        {t('New Article')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      {articles.map((article) => {
        const isActive =
          href === `/blog-hall/${article.id}` ||
          href === `/blog-hall/${article.id}/`
        return (
          <DropdownMenuItem
            key={article.id}
            render={
              <Link
                to='/blog-hall/$articleId'
                params={{ articleId: String(article.id) }}
                className={isActive ? 'bg-secondary' : ''}
                onClick={() => setOpenMobile(false)}
                aria-current={isActive ? 'page' : undefined}
              />
            }
          >
            <span className='max-w-52 truncate'>{article.title}</span>
          </DropdownMenuItem>
        )
      })}
    </>
  )

  const deletingArticle = articles.find((a) => a.id === deletingId)

  return (
    <>
      <SidebarCollapsibleShell
        id={`blog-articles-${item.title}`}
        title={item.title}
        icon={item.icon}
        description={item.description}
        isActive={isBlogActive}
        defaultOpen={isBlogActive}
        action={
          <SidebarMenuAction
            showOnHover
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              void handleCreate()
            }}
            aria-label={t('New Article')}
            title={t('New Article')}
          >
            <Plus className='size-3.5' aria-hidden='true' />
          </SidebarMenuAction>
        }
        expandedContent={expandedContent}
        collapsedContent={collapsedContent}
      />

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
    </>
  )
}
