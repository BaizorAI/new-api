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

import { Button, buttonVariants } from '@/components/ui/button'
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

  return (
    <div className='min-h-screen bg-background'>
      <div className='mx-auto max-w-4xl px-4 py-12'>
        {/* Header */}
        <div className='mb-6 flex items-center justify-between gap-3'>
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

        {/* Search */}
        <div className='mb-6'>
          <BlogSearchForm />
        </div>

        {/* Tag cloud */}
        {tags.length > 0 && (
          <div className='mb-8'>
            <h2 className='mb-2 text-sm font-semibold'>{t('Topics')}</h2>
            <div className='flex flex-wrap gap-2'>
              {tags.map(({ tag }) => (
                <BlogTag key={tag} tag={tag} />
              ))}
            </div>
          </div>
        )}

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


