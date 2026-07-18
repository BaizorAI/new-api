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
import { createFileRoute, Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, buttonVariants } from '@/components/ui/button'
import { searchPublishedArticles } from '@/features/blog-reader/api'
import { ArticleCard } from '@/features/blog-reader/components/article-card'
import { usePageMeta } from '@/lib/page-meta'

import type { BlogArticle } from '@/features/blog-hall/types'

const PAGE_SIZE = 12

function BlogTagPage() {
  const { t } = useTranslation()
  const { tag } = useParams({ from: '/blog/tags/$tag/', strict: true })
  const decodedTag = decodeURIComponent(tag)
  const [page, setPage] = useState(1)

  const title = t('Tagged with "{{tag}}"', { tag: decodedTag })
  usePageMeta({
    title,
    description: t('Published articles tagged with {{tag}}', {
      tag: decodedTag,
    }),
    type: 'website',
  })

  const { data, isLoading } = useQuery({
    queryKey: ['blog-tag', decodedTag, page],
    queryFn: () =>
      searchPublishedArticles({ tag: decodedTag, p: page, page_size: PAGE_SIZE }),
    enabled: decodedTag.length > 0,
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

        <h1 className='mb-6 text-3xl font-bold'>{title}</h1>

        {isLoading ? (
          <div className='space-y-4'>
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className='bg-muted animate-pulse h-36 rounded-lg p-6'
              />
            ))}
          </div>
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

export const Route = createFileRoute('/blog/tags/$tag/')({
  component: BlogTagPage,
})
