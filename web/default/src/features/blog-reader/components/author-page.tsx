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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button, buttonVariants } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'

import {
  followBlogAuthor,
  getBlogAuthor,
  getBlogAuthorArticles,
  unfollowBlogAuthor,
} from '../author-api'
import { ArticleCard } from './article-card'
import { BlogTag } from './blog-tag'

import type { BlogArticle } from '@/features/blog-hall/types'

const PAGE_SIZE = 12

export function AuthorPage() {
  const { t } = useTranslation()
  const { authorSlug } = useParams({ from: '/blog/authors/$authorSlug/' })
  const slug = decodeURIComponent(authorSlug)
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()

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

  const canonicalUrl = author
    ? `${window.location.origin}/blog/authors/${author.slug}`
    : undefined
  usePageMeta({
    title: author ? `${author.display_name} | ${t('Authors')}` : t('Authors'),
    description: author?.bio,
    image: author?.avatar,
    type: 'profile',
    canonicalUrl,
    jsonLd: author
      ? {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: author.display_name,
          description: author.bio || undefined,
          image: author.avatar || undefined,
          url: canonicalUrl,
        }
      : undefined,
  })

  const followMutation = useMutation({
    mutationFn: () => followBlogAuthor(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['blog-author', slug] })
      toast.success(t('Followed'))
    },
    onError: () => toast.error(t('Failed to follow author.')),
  })

  const unfollowMutation = useMutation({
    mutationFn: () => unfollowBlogAuthor(slug),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['blog-author', slug] })
      toast.success(t('Unfollowed'))
    },
    onError: () => toast.error(t('Failed to unfollow author.')),
  })

  const latestPublishedAt = useMemo(() => {
    if (articles.length === 0) return null
    return articles.reduce((latest, a) => {
      const time = a.published_at || a.created_time
      return time > latest ? time : latest
    }, 0)
  }, [articles])

  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const article of articles) {
      for (const tag of article.tags) {
        counts.set(tag, (counts.get(tag) || 0) + 1)
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 12)
  }, [articles])

  return (
    <div className='min-h-screen bg-background'>
      <section className='border-b bg-gradient-to-br from-background via-background to-muted/50 pt-12 pb-10 md:pt-16 md:pb-12'>
        <div className='mx-auto max-w-6xl px-4'>
          <div className='mb-6'>
            <Link
              to='/blog'
              className={buttonVariants({ variant: 'ghost', size: 'sm' })}
            >
              <ArrowLeft className='mr-1 h-4 w-4' />
              {t('All Articles')}
            </Link>
          </div>

          {authorQuery.isLoading ? (
            <div className='bg-muted animate-pulse h-32 w-full rounded-2xl' />
          ) : !author ? (
            <p className='text-destructive text-center'>{t('Author not found.')}</p>
          ) : (
            <div className='flex flex-col items-start gap-5 sm:flex-row sm:items-center'>
              {author.avatar ? (
                <img
                  src={author.avatar}
                  alt={author.display_name}
                  className='size-24 rounded-full object-cover ring-4 ring-background'
                />
              ) : (
                <span className='bg-primary/10 text-primary flex size-24 items-center justify-center rounded-full text-4xl font-medium ring-4 ring-background'>
                  {initial}
                </span>
              )}
              <div className='flex-1'>
                <h1 className='font-serif text-3xl font-bold tracking-tight md:text-4xl'>
                  {author.display_name}
                </h1>
                {author.bio && (
                  <p className='text-muted-foreground mt-2 max-w-2xl whitespace-pre-line'>
                    {author.bio}
                  </p>
                )}
                <div className='text-muted-foreground mt-3 flex flex-wrap items-center gap-4 text-sm'>
                  <span className='inline-flex items-center gap-1'>
                    <BookOpen className='h-4 w-4' />
                    {t('{count} articles', { count: author.article_count })}
                  </span>
                  <span className='inline-flex items-center gap-1'>
                    <Users className='h-4 w-4' />
                    {t('{count} followers', { count: author.follower_count })}
                  </span>
                  {latestPublishedAt !== null && latestPublishedAt > 0 && (
                    <span>
                      {t('Latest')}: {formatTimestampToDate(latestPublishedAt)}
                    </span>
                  )}
                </div>
              </div>
              <div className='shrink-0'>
                {author.is_followed ? (
                  <Button
                    variant='outline'
                    disabled={unfollowMutation.isPending}
                    onClick={() => void unfollowMutation.mutate()}
                  >
                    {unfollowMutation.isPending ? t('Unfollowing...') : t('Unfollow')}
                  </Button>
                ) : (
                  <Button
                    disabled={followMutation.isPending}
                    onClick={() => void followMutation.mutate()}
                  >
                    {followMutation.isPending ? t('Following...') : t('Follow')}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      </section>

      <main className='mx-auto max-w-6xl px-4 py-12'>
        {/* Tag cloud */}
        {tagCounts.length > 0 && (
          <div className='mb-10'>
            <h2 className='mb-3 text-sm font-semibold'>{t('Topics')}</h2>
            <div className='flex flex-wrap gap-2'>
              {tagCounts.map(([tag, count]) => (
                <span
                  key={tag}
                  className='inline-flex items-center gap-1'
                >
                  <BlogTag tag={tag} />
                  <span className='text-muted-foreground/60 text-xs'>×{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Articles */}
        <h2 className='mb-4 flex items-center gap-2 font-serif text-xl font-semibold tracking-tight'>
          <BookOpen className='h-5 w-5' />
          {t('Articles')}
        </h2>

        {articlesQuery.isLoading ? (
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className='bg-muted animate-pulse h-80 rounded-2xl' />
            ))}
          </div>
        ) : articles.length === 0 ? (
          <p className='text-muted-foreground py-12 text-center'>
            {t('No published articles yet.')}
          </p>
        ) : (
          <>
            <div className='grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3'>
              {articles.map((article: BlogArticle) => (
                <ArticleCard key={article.guid} article={article} />
              ))}
            </div>

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
