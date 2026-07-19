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
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { usePageMeta } from '@/lib/page-meta'

import { getPublishedArticles, getPublishedBlogTags } from '../api'
import { ArticleCard } from './article-card'
import { BlogSearchForm } from './blog-search-form'
import { BlogTag } from './blog-tag'

import type { BlogArticle } from '@/features/blog-hall/types'

const PAGE_SIZE = 12

export function BlogReaderPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const canonicalUrl = `${window.location.origin}/blog`
  usePageMeta({
    title: `${t('Blog Hall')} | ${t('Published articles')}`,
    description: t('Published articles'),
    type: 'website',
    canonicalUrl,
    jsonLd: {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          url: window.location.origin,
          name: t('Blog Hall'),
        },
        {
          '@type': 'Blog',
          url: canonicalUrl,
          name: t('Blog Hall'),
          description: t('Published articles'),
        },
      ],
    },
  })

  const { data, isLoading } = useQuery({
    queryKey: ['blog-public', page],
    queryFn: () => getPublishedArticles({ p: page, page_size: PAGE_SIZE }),
  })

  const tagsQuery = useQuery({
    queryKey: ['blog-tags'],
    queryFn: () => getPublishedBlogTags(),
  })
  const tags = tagsQuery.data?.data ?? []

  const articles = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  const featured = articles[0] as BlogArticle | undefined
  const rest = articles.slice(1) as BlogArticle[]

  return (
    <div className='min-h-screen bg-background'>
      {/* Hero */}
      <section className='relative overflow-hidden border-b bg-gradient-to-br from-background via-background to-muted/50 pt-16 pb-12 md:pt-24 md:pb-16'>
        <div className='absolute inset-0 bg-[radial-gradient(circle_at_top_right,var(--primary)/5%,transparent_40%)]' />
        <div className='relative mx-auto max-w-6xl px-4 text-center'>
          <h1 className='font-serif text-4xl font-bold tracking-tight md:text-6xl'>
            {t('Blog Hall')}
          </h1>
          <p className='text-muted-foreground mx-auto mt-4 max-w-xl text-lg'>
            {t('Published articles')}
          </p>
          <div className='mx-auto mt-8 max-w-2xl'>
            <BlogSearchForm className='shadow-sm' />
          </div>
        </div>
      </section>

      <main className='mx-auto max-w-6xl px-4 py-12'>
        {/* Tag cloud */}
        {tags.length > 0 && (
          <div className='mb-10 flex flex-wrap items-center justify-center gap-2'>
            {tags.slice(0, 14).map(({ tag }) => (
              <BlogTag key={tag} tag={tag} />
            ))}
          </div>
        )}

        {isLoading ? (
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className='bg-muted animate-pulse h-80 rounded-2xl'
              />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-24 text-center gap-3'>
            <BookOpenIcon />
            <p className='text-muted-foreground'>
              {t('No published articles yet.')}
            </p>
          </div>
        ) : (
          <>
            {featured && (
              <section className='mb-10'>
                <h2 className='mb-4 font-serif text-xl font-semibold tracking-tight'>
                  {t('Featured')}
                </h2>
                <ArticleCard article={featured} variant='featured' />
              </section>
            )}

            <section>
              <h2 className='mb-4 font-serif text-xl font-semibold tracking-tight'>
                {t('Latest')}
              </h2>
              <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
                {rest.map((article: BlogArticle) => (
                  <ArticleCard key={article.id} article={article} />
                ))}
              </div>
            </section>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className='mt-12 flex items-center justify-center gap-3'>
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
      </main>
    </div>
  )
}

function BookOpenIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      width='48'
      height='48'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth='1.5'
      strokeLinecap='round'
      strokeLinejoin='round'
      className='text-muted-foreground'
    >
      <path d='M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' />
      <path d='M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' />
    </svg>
  )
}
