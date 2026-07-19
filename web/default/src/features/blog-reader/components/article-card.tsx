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
import { Link } from '@tanstack/react-router'
import { Clock } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { formatTimestampToDate } from '@/lib/format'
import { estimateReadingTime } from '@/lib/reading-utils'
import { cn } from '@/lib/utils'

import { BlogTag } from './blog-tag'

import type { BlogArticle, BlogAuthor } from '@/features/blog-hall/types'

interface ArticleCardProps {
  article: BlogArticle
  variant?: 'vertical' | 'horizontal' | 'featured'
  showReadMore?: boolean
  className?: string
}

export function ArticleCard({
  article,
  variant = 'vertical',
  showReadMore = true,
  className,
}: ArticleCardProps) {
  const { t } = useTranslation()
  const readingTime = estimateReadingTime(article.content || '')

  const isHorizontal = variant === 'horizontal' || variant === 'featured'
  const isFeatured = variant === 'featured'

  return (
    <Link
      to='/blog/$guid'
      params={{ guid: article.guid }}
      className={cn('group block', className)}
    >
      <article
        className={cn(
          'bg-card border-border overflow-hidden rounded-2xl border transition-all duration-200',
          'hover:-translate-y-0.5 hover:shadow-lg hover:border-primary/20',
          isHorizontal && 'flex flex-col md:flex-row'
        )}
      >
        {article.cover_image && (
          <div
            className={cn(
              'overflow-hidden bg-muted',
              isHorizontal
                ? isFeatured
                  ? 'md:w-1/2 aspect-[4/3] md:aspect-auto'
                  : 'md:w-2/5 aspect-[16/10] md:aspect-auto'
                : 'aspect-[16/10] w-full'
            )}
          >
            <img
              src={article.cover_image}
              alt={article.title}
              className='h-full w-full object-cover transition-transform duration-500 group-hover:scale-105'
              loading='lazy'
            />
          </div>
        )}

        <div className={cn('flex flex-col p-5', isHorizontal && 'flex-1 md:p-6')}>
          <div className='mb-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground'>
            <time dateTime={String(article.published_at || article.created_time)}>
              {formatTimestampToDate(article.published_at || article.created_time)}
            </time>
            <span aria-hidden='true'>·</span>
            <span className='inline-flex items-center gap-1'>
              <Clock className='size-3' />
              {t('{{count}} min read', { count: readingTime })}
            </span>
          </div>

          <h2
            className={cn(
              'font-serif font-bold tracking-tight text-card-foreground transition-colors group-hover:text-primary',
              isFeatured ? 'text-2xl md:text-3xl' : 'text-lg md:text-xl'
            )}
          >
            {article.title}
          </h2>

          {article.summary && (
            <p
              className={cn(
                'text-muted-foreground mt-2 line-clamp-2',
                isFeatured ? 'text-base' : 'text-sm'
              )}
            >
              {article.summary}
            </p>
          )}

          {article.tags.length > 0 && (
            <div className='mt-auto flex flex-wrap gap-1.5 pt-4'>
              {article.tags.slice(0, 4).map((tag) => (
                <BlogTag key={tag} tag={tag} />
              ))}
            </div>
          )}

          <div className='mt-4 flex items-center justify-between'>
            {article.author ? (
              <AuthorInline author={article.author} />
            ) : (
              <span />
            )}
            {showReadMore && (
              <span className='text-sm font-medium text-primary/70 opacity-0 transition-opacity group-hover:opacity-100'>
                {t('Read article')} →
              </span>
            )}
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
      className='size-6 rounded-full object-cover ring-1 ring-border'
    />
  ) : (
    <span className='flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary ring-1 ring-border'>
      {initial}
    </span>
  )

  if (author.slug) {
    return (
      <Link
        to='/blog/authors/$authorSlug'
        params={{ authorSlug: author.slug }}
        onClick={(e) => e.stopPropagation()}
        className='inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground'
      >
        {avatar}
        <span>{author.display_name}</span>
      </Link>
    )
  }

  return (
    <span className='inline-flex items-center gap-2 text-sm text-muted-foreground'>
      {avatar}
      <span>{author.display_name}</span>
    </span>
  )
}
