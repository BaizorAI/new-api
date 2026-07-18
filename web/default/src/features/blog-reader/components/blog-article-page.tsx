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
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { buttonVariants } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { formatTimestampToDate } from '@/lib/format'

import { getPublishedArticle } from '../api'

import type { BlogAuthor } from '@/features/blog-hall/types'

export function BlogArticlePage() {
  const { t } = useTranslation()
  const { articleId } = useParams({ from: '/blog/$articleId/' })
  const id = Number(articleId)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['blog-public-article', id],
    queryFn: () => getPublishedArticle(id),
    enabled: !!id,
  })

  const article = data?.data

  return (
    <div className='min-h-screen bg-background'>
      <div className='mx-auto max-w-3xl px-4 py-12'>
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

        {isLoading && (
          <div className='space-y-4'>
            <div className='bg-muted animate-pulse h-10 w-3/4 rounded' />
            <div className='bg-muted animate-pulse h-4 w-1/3 rounded' />
            <div className='bg-muted animate-pulse mt-8 h-64 rounded' />
          </div>
        )}

        {isError && (
          <p className='text-destructive text-center'>
            {t('Article not found or not yet published.')}
          </p>
        )}

        {article && (
          <article>
            {/* Cover image */}
            {article.cover_image && (
              <img
                src={article.cover_image}
                alt={article.title}
                className='mb-6 w-full rounded-lg object-cover'
                style={{ maxHeight: '400px' }}
              />
            )}

            {/* Title */}
            <h1 className='mb-4 text-3xl font-bold leading-tight'>
              {article.title}
            </h1>

            {/* Author byline */}
            {article.author && (
              <div className='mb-6'>
                <AuthorByline author={article.author} />
              </div>
            )}

            {/* Metadata */}
            <div className='text-muted-foreground mb-2 flex flex-wrap items-center gap-3 text-sm'>
              <time className='font-mono'>
                {formatTimestampToDate(
                  article.published_at || article.created_time
                )}
              </time>
            </div>

            {/* Tags */}
            {article.tags.length > 0 && (
              <div className='mb-6 flex flex-wrap gap-1.5'>
                {article.tags.map((tag) => (
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

            {/* Summary */}
            {article.summary && (
              <p className='text-muted-foreground border-l-primary/40 mb-6 border-l-2 pl-4 text-base italic'>
                {article.summary}
              </p>
            )}

            {/* Content */}
            <Markdown className='prose-base prose-neutral'>
              {article.content || ''}
            </Markdown>

            {/* Author card */}
            {article.author && (
              <div className='mt-12'>
                <AuthorCard author={article.author} />
              </div>
            )}
          </article>
        )}
      </div>
    </div>
  )
}

function AuthorByline({ author }: { author: BlogAuthor }) {
  const { t } = useTranslation()
  const content = (
    <>
      <AuthorAvatar author={author} />
      <span className='font-medium'>{author.display_name}</span>
    </>
  )

  if (author.slug) {
    return (
      <Link
        to='/blog/authors/$authorSlug'
        params={{ authorSlug: author.slug }}
        className='inline-flex items-center gap-2 text-sm hover:underline'
      >
        {content}
      </Link>
    )
  }

  return (
    <span className='inline-flex items-center gap-2 text-sm' title={t('Author')}>
      {content}
    </span>
  )
}

function AuthorCard({ author }: { author: BlogAuthor }) {
  const { t } = useTranslation()
  return (
    <div className='bg-card border-border rounded-lg border p-6'>
      <div className='flex items-start gap-4'>
        <AuthorAvatar author={author} className='size-16 text-lg' />
        <div className='flex-1'>
          <h3 className='text-lg font-semibold'>{author.display_name}</h3>
          {author.bio && (
            <p className='text-muted-foreground mt-1 text-sm'>{author.bio}</p>
          )}
          {author.slug && (
            <Link
              to='/blog/authors/$authorSlug'
              params={{ authorSlug: author.slug }}
              className={buttonVariants({ variant: 'link', size: 'sm' }) + ' px-0'}
            >
              {t('View profile')} →
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}

function AuthorAvatar({
  author,
  className = 'size-8 text-xs',
}: {
  author: BlogAuthor
  className?: string
}) {
  const initial = author.display_name.charAt(0).toUpperCase()
  if (author.avatar) {
    return (
      <img
        src={author.avatar}
        alt={author.display_name}
        className={`rounded-full object-cover ${className}`}
      />
    )
  }
  return (
    <span
      className={`bg-primary/10 text-primary flex items-center justify-center rounded-full font-medium ${className}`}
      aria-hidden='true'
    >
      {initial}
    </span>
  )
}
