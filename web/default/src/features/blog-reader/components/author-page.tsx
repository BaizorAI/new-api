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
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { Button, buttonVariants } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'

import { getBlogAuthor, getBlogAuthorArticles } from '../author-api'

import type { BlogArticle } from '@/features/blog-hall/types'

const PAGE_SIZE = 12

export function AuthorPage() {
  const { t } = useTranslation()
  const { authorSlug } = useParams({ from: '/blog/authors/$authorSlug/' })
  const slug = decodeURIComponent(authorSlug)
  const [page, setPage] = useState(1)

  const authorQuery = useQuery({
    queryKey: ['blog-author', slug],
    queryFn: () => getBlogAuthor(slug),
    enabled: !!slug,
  })

  const articlesQuery = useQuery({
    queryKey: ['blog-author-articles', slug, page],
    queryFn: () => getBlogAuthorArticles(slug, { p: page, page_size: PAGE_SIZE }),
    enabled: !!slug,
  })

  const author = authorQuery.data?.data
  const articles = articlesQuery.data?.data?.items ?? []
  const total = articlesQuery.data?.data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const initial = author?.display_name.charAt(0).toUpperCase() ?? '?'

  return (
    <div className='min-h-screen bg-background'>
      <div className='mx-auto max-w-4xl px-4 py-12'>
        {/* Back button */}
        <div className='mb-8'>
          <Link
            to='/blog'
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <ArrowLeft className='h-4 w-4' />
            {t('All Articles')}
          </Link>
        </div>

        {authorQuery.isLoading ? (
          <div className='space-y-4'>
            <div className='bg-muted animate-pulse h-24 w-full rounded-lg' />
          </div>
        ) : !author ? (
          <p className='text-destructive text-center'>{t('Author not found.')}</p>
        ) : (
          <>
            {/* Author header */}
            <div className='mb-10 flex items-start gap-5'>
              {author.avatar ? (
                <img
                  src={author.avatar}
                  alt={author.display_name}
                  className='size-20 rounded-full object-cover'
                />
              ) : (
                <span className='bg-primary/10 text-primary flex size-20 items-center justify-center rounded-full text-3xl font-medium'>
                  {initial}
                </span>
              )}
              <div className='flex-1'>
                <h1 className='text-3xl font-bold'>{author.display_name}</h1>
                {author.bio && (
                  <p className='text-muted-foreground mt-2 max-w-2xl whitespace-pre-line'>
                    {author.bio}
                  </p>
                )}
                <p className='text-muted-foreground mt-2 text-sm'>
                  {t('{count} articles', { count: author.article_count })}
                </p>
              </div>
            </div>

            {/* Articles */}
            <h2 className='mb-4 flex items-center gap-2 text-xl font-semibold'>
              <BookOpen className='h-5 w-5' />
              {t('Articles')}
            </h2>

            {articlesQuery.isLoading ? (
              <div className='space-y-4'>
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className='bg-muted animate-pulse h-36 rounded-lg' />
                ))}
              </div>
            ) : articles.length === 0 ? (
              <p className='text-muted-foreground py-12 text-center'>
                {t('No published articles yet.')}
              </p>
            ) : (
              <>
                <div className='space-y-4'>
                  {articles.map((article: BlogArticle) => (
                    <ArticleCard key={article.id} article={article} />
                  ))}
                </div>

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
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function ArticleCard({ article }: { article: BlogArticle }) {
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
            <h3 className='text-card-foreground group-hover:text-primary text-xl font-semibold leading-snug transition-colors'>
              {article.title}
            </h3>
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
        </div>
      </article>
    </Link>
  )
}
