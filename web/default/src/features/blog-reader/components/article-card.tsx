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
import { useTranslation } from 'react-i18next'

import { formatTimestampToDate } from '@/lib/format'

import { BlogTag } from './blog-tag'

import type { BlogArticle, BlogAuthor } from '@/features/blog-hall/types'

interface ArticleCardProps {
  article: BlogArticle
  showReadMore?: boolean
}

export function ArticleCard({ article, showReadMore = true }: ArticleCardProps) {
  const { t } = useTranslation()
  return (
    <Link
      to='/blog/$guid'
      params={{ guid: article.guid }}
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
              <span className='text-primary/70 text-sm font-medium'>
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
