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
import { createFileRoute, Link, useSearch } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { buttonVariants } from '@/components/ui/button'
import { Button } from '@/components/ui/button'
import { searchPublishedArticles } from '@/features/blog-reader/api'
import { ArticleCard } from '@/features/blog-reader/components/article-card'
import { BlogSearchForm } from '@/features/blog-reader/components/blog-search-form'
import { usePageMeta } from '@/lib/page-meta'

import type { BlogArticle } from '@/features/blog-hall/types'

const PAGE_SIZE = 12

const searchSchema = z.object({
  q: z.string().optional().catch(''),
})

function BlogSearchPage() {
  const { t } = useTranslation()
  const { q = '' } = useSearch({ from: '/blog/search/', strict: true })
  const [page, setPage] = useState(1)

  const title = q
    ? t('Search results for "{{query}}"', { query: q })
    : t('Search articles')
  usePageMeta({
    title,
    description: t('Published articles'),
    type: 'website',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['blog-search', q, page],
    queryFn: () =>
      searchPublishedArticles({ q, p: page, page_size: PAGE_SIZE }),
    enabled: q.trim().length > 0,
  })

  const articles = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className='min-h-screen bg-background'>
      <div className='mx-auto max-w-4xl px-4 py-12'>
        <div className='mb-8'>
          <Link
            to='/blog'
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <ArrowLeft className='h-4 w-4' />
            {t('All Articles')}
          </Link>
        </div>

        <h1 className='mb-4 text-3xl font-bold'>{title}</h1>

        <div className='mb-8'>
          <BlogSearchForm initialQuery={q} />
        </div>

        {isLoading ? (
          <div className='space-y-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className='bg-muted animate-pulse h-36 rounded-lg p-6'
              />
            ))}
          </div>
        ) : q.trim().length === 0 ? (
          <p className='text-muted-foreground py-12 text-center'>
            {t('Enter a keyword to search articles.')}
          </p>
        ) : articles.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-24 text-center gap-3'>
            <BookOpen className='text-muted-foreground h-10 w-10' />
            <p className='text-muted-foreground'>{t('No results found')}</p>
          </div>
        ) : (
          <>
            <div className='space-y-4'>
              {articles.map((article: BlogArticle) => (
                <ArticleCard key={article.guid} article={article} />
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
      </div>
    </div>
  )
}

export const Route = createFileRoute('/blog/search/')({
  component: BlogSearchPage,
  validateSearch: searchSchema,
})
