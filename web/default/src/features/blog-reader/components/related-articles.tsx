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
import { Compass } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { getRelatedArticles } from '../api'

import type { BlogArticle } from '@/features/blog-hall/types'

interface RelatedArticlesProps {
  articleId: number
  currentGuid: string
}

export function RelatedArticles({ articleId, currentGuid }: RelatedArticlesProps) {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['blog-related', articleId],
    queryFn: () => getRelatedArticles(articleId),
    enabled: articleId > 0,
  })

  const articles =
    data?.data?.items?.filter((a: BlogArticle) => a.guid !== currentGuid) ?? []
  if (articles.length === 0) return null

  return (
    <div className='mt-16'>
      <h2 className='mb-4 flex items-center gap-2 text-xl font-semibold'>
        <Compass className='h-5 w-5' />
        {t('Related reading')}
      </h2>
      <div className='space-y-4'>
        {articles.slice(0, 4).map((article: BlogArticle) => (
          <RelatedArticleCard key={article.guid} article={article} />
        ))}
      </div>
    </div>
  )
}

function RelatedArticleCard({ article }: { article: BlogArticle }) {
  return (
    <Link
      to='/blog/$guid'
      params={{ guid: article.guid }}
      className='block'
    >
      <article className='group border-border bg-card hover:border-primary/50 rounded-lg border p-4 transition-colors'>
        <h3 className='text-card-foreground group-hover:text-primary text-lg font-semibold leading-snug transition-colors'>
          {article.title}
        </h3>
        {article.summary && (
          <p className='text-muted-foreground mt-1 line-clamp-2 text-sm'>
            {article.summary}
          </p>
        )}
      </article>
    </Link>
  )
}
