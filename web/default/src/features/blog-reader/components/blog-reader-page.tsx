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
import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { BookOpen, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'

import { getPublishedArticles } from '../api'

import type { BlogArticle, BlogAuthor } from '@/features/blog-hall/types'

const PAGE_SIZE = 12

export function BlogReaderPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['blog-public', page],
    queryFn: () => getPublishedArticles({ p: page, page_size: PAGE_SIZE }),
  })

  const articles = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className='min-h-screen bg-background'>
      <div className='mx-auto max-w-4xl px-4 py-12'>
        {/* Header */}
        <div className='mb-10 flex items-center justify-between gap-3'>
          <div className='flex items-center gap-3'>
            <BookOpen className='text-primary h-8 w-8' />
            <div>
              <h1 className='text-3xl font-bold'>{t('Blog Hall')}</h1>
              <p className='text-muted-foreground text-sm'>
                {t('Published articles')}
              </p>
            </div>
          </div>
          <Link
            to='/blog/authors'
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            <Users className='mr-1.5 h-4 w-4' />
            {t('Authors')}
          </Link>
        </div>

        {/* Article list */}
        {isLoading ? (
          <div className='space-y-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className='bg-muted animate-pulse rounded-lg p-6 h-36'
              />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-24 text-center gap-3'>
            <BookOpen className='text-muted-foreground h-10 w-10' />
            <p className='text-muted-foreground'>
              {t('No published articles yet.')}
            </p>
          </div>
        ) : (
          <div className='space-y-4'>
            {articles.map((article: BlogArticle) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className='mt-8 flex items-center justify-center gap-3'>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              <ChevronLeft className='h-4 w-4' />
              {t('Previous')}
            </Button>
            <span className='text-muted-foreground text-sm'>
              {page} / {totalPages}
            </span>
            <Button
              variant='outline'
              size='sm'
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              {t('Next')}
              <ChevronRight className='h-4 w-4' />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

function ArticleCard({ article }: { article: BlogArticle }) {
  const { t } = useTranslation()
  return (
    <Link
      to='/blog/$articleId'
      params={{ articleId: String(article.id) }}
      className='block'
    >
      <article className='group border-border bg-card hover:border-primary/50 rounded-lg border overflow-hidden transition-colors'>
        {article.cover_image && (
          <img
            src={article.cover_image}
            alt={article.title}
            className='h-48 w-full object-cover'
          />
        )}
        <div className='p-6'>
          <div className='mb-2 flex items-start justify-between gap-4'>
            <h2 className='text-card-foreground group-hover:text-primary text-xl font-semibold leading-snug transition-colors'>
              {article.title}
            </h2>
            <time className='text-muted-foreground shrink-0 font-mono text-xs'>
              {formatTimestampToDate(article.published_at || article.created_time)}
            </time>
          </div>

          {article.summary && (
            <p className='text-muted-foreground mb-3 line-clamp-2 text-sm'>
              {article.summary}
            </p>
          )}

          {article.tags.length > 0 && (
            <div className='flex flex-wrap gap-1'>
              {article.tags.slice(0, 5).map((tag) => (
                <StatusBadge
                  key={tag}
                  label={tag}
                  variant='neutral'
                  copyable={false}
                  className='text-xs'
                />
              ))}
            </div>
          )}

          <div className='mt-4 flex items-center justify-between'>
            {article.author ? (
              <AuthorInline author={article.author} />
            ) : (
              <span />
            )}
            <span className='text-primary/70 text-sm font-medium'>
              {t('Read article')} →
            </span>
          </div>
        </div>
      </article>
    </Link>
  )
}

function AuthorInline({ author }: { author: BlogAuthor }) {
  const initial = author.display_name.charAt(0).toUpperCase()
  const avatar = author.avatar ? (
    <img
      src={author.avatar}
      alt={author.display_name}
      className='size-6 rounded-full object-cover'
    />
  ) : (
    <span className='bg-primary/10 text-primary flex size-6 items-center justify-center rounded-full text-xs font-medium'>
      {initial}
    </span>
  )

  if (author.slug) {
    return (
      <Link
        to='/blog/authors/$authorSlug'
        params={{ authorSlug: author.slug }}
        onClick={(e) => e.stopPropagation()}
        className='inline-flex items-center gap-2 text-sm hover:underline'
      >
        {avatar}
        <span className='text-muted-foreground'>{author.display_name}</span>
      </Link>
    )
  }

  return (
    <span className='inline-flex items-center gap-2 text-sm'>
      {avatar}
      <span className='text-muted-foreground'>{author.display_name}</span>
    </span>
  )
}
