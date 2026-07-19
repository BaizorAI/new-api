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
import { ArrowLeft, Calendar, Clock, Type } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { buttonVariants } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { formatTimestampToDate } from '@/lib/format'
import { usePageMeta } from '@/lib/page-meta'
import {
  countWordsAndChars,
  estimateReadingTime,
  extractMarkdownHeadings,
} from '@/lib/reading-utils'

import { getPublishedArticle, getPublishedArticles } from '../api'
import { ArticleToc } from './article-toc'
import { BlogReaderPanel } from './blog-reader-panel'
import { BlogTag } from './blog-tag'
import { ReadingPreferencesPanel } from './reading-preferences'
import { ReadingProgressBar } from './reading-progress-bar'
import { RelatedArticles } from './related-articles'
import { useActiveHeading } from '../hooks/use-active-heading'
import {
  type ReadingPreferences,
  useReadingPreferences,
} from '../hooks/use-reading-preferences'

import type { BlogArticle, BlogAuthor } from '@/features/blog-hall/types'

export function BlogArticlePage() {
  const { t } = useTranslation()
  const { guid } = useParams({ from: '/blog/$guid/' })

  const { data, isLoading, isError } = useQuery({
    queryKey: ['blog-public-article', guid],
    queryFn: () => getPublishedArticle(guid),
    enabled: !!guid,
  })

  const article = data?.data

  const { preferences, setPreferences } = useReadingPreferences()

  const headings = useMemo(
    () => extractMarkdownHeadings(article?.content || ''),
    [article?.content]
  )
  const activeId = useActiveHeading(headings.map((heading) => heading.id))
  const readingTime = useMemo(
    () => estimateReadingTime(article?.content || ''),
    [article?.content]
  )
  const wordCount = useMemo(
    () => countWordsAndChars(article?.content || '').words,
    [article?.content]
  )

  const lineHeightClasses: Record<
    ReadingPreferences['lineHeight'],
    string
  > = {
    snug: 'prose-p:leading-snug prose-headings:leading-tight',
    relaxed: 'prose-p:leading-relaxed prose-headings:leading-snug',
    loose: 'prose-p:leading-loose prose-headings:leading-relaxed',
  }

  const pageTitle = article
    ? `${article.title} | ${article.author?.display_name || t('Blog')}`
    : t('Blog')
  const pageDescription = article?.summary || article?.content.slice(0, 160)
  const canonicalUrl = article
    ? `${window.location.origin}/blog/${article.guid}`
    : undefined
  const jsonLd = article
    ? {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: article.title,
        description: pageDescription,
        author: article.author
          ? {
              '@type': 'Person',
              name: article.author.display_name,
              url: article.author.slug
                ? `${window.location.origin}/blog/authors/${article.author.slug}`
                : undefined,
            }
          : undefined,
        datePublished: article.published_at
          ? new Date(article.published_at * 1000).toISOString()
          : undefined,
        dateModified: article.updated_time
          ? new Date(article.updated_time * 1000).toISOString()
          : undefined,
        image: article.cover_image || undefined,
        keywords: article.tags.join(', ') || undefined,
        mainEntityOfPage: {
          '@type': 'WebPage',
          '@id': canonicalUrl,
        },
      }
    : undefined
  usePageMeta({
    title: pageTitle,
    description: pageDescription,
    image: article?.cover_image,
    type: 'article',
    canonicalUrl,
    jsonLd,
  })

  return (
    <div className='min-h-screen bg-background'>
      <ReadingProgressBar />

      <div className='mx-auto max-w-6xl px-4 py-8 lg:py-12'>
        <div className='mb-8'>
          <Link
            to='/blog'
            className={buttonVariants({ variant: 'ghost', size: 'sm' })}
          >
            <ArrowLeft className='mr-1.5 h-4 w-4' />
            {t('All Articles')}
          </Link>
        </div>

        {isLoading && (
          <div className='mx-auto max-w-3xl space-y-4'>
            <div className='bg-muted animate-pulse mx-auto h-8 w-3/4 rounded' />
            <div className='bg-muted animate-pulse mx-auto h-4 w-1/3 rounded' />
            <div className='bg-muted animate-pulse mt-8 h-64 rounded' />
          </div>
        )}

        {isError && (
          <p className='text-destructive text-center'>
            {t('Article not found or not yet published.')}
          </p>
        )}

        {article && (
          <div className='grid grid-cols-1 gap-10 lg:grid-cols-12'>
            {/* Main article */}
            <article className='lg:col-span-8'>
              <div className='mx-auto max-w-3xl'>
                {/* Cover image */}
                {article.cover_image && (
                  <div className='mb-8 overflow-hidden rounded-2xl'>
                    <img
                      src={article.cover_image}
                      alt={article.title}
                      className='aspect-[21/9] w-full object-cover'
                    />
                  </div>
                )}

                {/* Title */}
                <h1 className='font-serif text-4xl font-bold tracking-tight md:text-5xl'>
                  {article.title}
                </h1>

                {/* Summary */}
                {article.summary && (
                  <p className='text-muted-foreground mt-4 text-lg leading-relaxed md:text-xl'>
                    {article.summary}
                  </p>
                )}

                {/* Byline */}
                <div className='mt-6 flex flex-wrap items-center gap-4 border-y py-4 text-sm text-muted-foreground'>
                  {article.author && <AuthorByline author={article.author} />}
                  <div className='flex flex-wrap items-center gap-3'>
                    <span className='inline-flex items-center gap-1.5'>
                      <Calendar className='size-3.5' />
                      <time>
                        {formatTimestampToDate(
                          article.published_at || article.created_time
                        )}
                      </time>
                    </span>
                    {article.content && (
                      <>
                        <span aria-hidden='true'>·</span>
                        <span className='inline-flex items-center gap-1.5'>
                          <Clock className='size-3.5' />
                          {t('{{count}} min read', { count: readingTime })}
                        </span>
                        <span aria-hidden='true'>·</span>
                        <span className='inline-flex items-center gap-1.5'>
                          <Type className='size-3.5' />
                          {t('{{count}} words', { count: wordCount })}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Tags */}
                {article.tags.length > 0 && (
                  <div className='mt-4 flex flex-wrap gap-2'>
                    {article.tags.map((tag) => (
                      <BlogTag key={tag} tag={tag} />
                    ))}
                  </div>
                )}

                {/* Content */}
                <div className='mt-10'>
                  <Markdown
                    className={`prose-neutral ${lineHeightClasses[preferences.lineHeight]}`}
                    headingIds
                    imageZoom
                    codeCopy
                    proseSize={preferences.fontSize}
                  >
                    {article.content || ''}
                  </Markdown>
                </div>

                {/* Author card */}
                {article.author && (
                  <div className='mt-14'>
                    <AuthorCard author={article.author} />
                  </div>
                )}

                {/* Related reading */}
                <div className='mt-14'>
                  <RelatedArticles
                    articleId={article.id}
                    currentGuid={article.guid}
                  />
                </div>

                {/* More articles by this author */}
                <div className='mt-14'>
                  <MoreArticlesByAuthor
                    authorId={article.author_id}
                    currentGuid={article.guid}
                  />
                </div>
              </div>
            </article>

            {/* Sidebar */}
            <aside className='lg:col-span-4'>
              {article && (
                <div className='space-y-6 lg:sticky lg:top-24'>
                  <ReadingPreferencesPanel
                    preferences={preferences}
                    onChange={setPreferences}
                  />
                  <ArticleToc headings={headings} activeId={activeId} />
                  <BlogReaderPanel article={article} />
                </div>
              )}
            </aside>
          </div>
        )}
      </div>
    </div>
  )
}

function AuthorByline({ author }: { author: BlogAuthor }) {
  const { t } = useTranslation()
  const content = (
    <>
      <AuthorAvatar author={author} className='size-8' />
      <span className='font-medium text-foreground'>{author.display_name}</span>
    </>
  )

  if (author.slug) {
    return (
      <Link
        to='/blog/authors/$authorSlug'
        params={{ authorSlug: author.slug }}
        className='inline-flex items-center gap-2 hover:underline'
      >
        {content}
      </Link>
    )
  }

  return (
    <span className='inline-flex items-center gap-2' title={t('Author')}>
      {content}
    </span>
  )
}

function AuthorCard({ author }: { author: BlogAuthor }) {
  const { t } = useTranslation()
  return (
    <div className='bg-card border-border rounded-2xl border p-6'>
      <div className='flex items-start gap-4'>
        <AuthorAvatar author={author} className='size-16 text-lg' />
        <div className='flex-1'>
          <h3 className='font-serif text-lg font-semibold'>
            {author.display_name}
          </h3>
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
        className={`rounded-full object-cover ring-1 ring-border ${className}`}
      />
    )
  }
  return (
    <span
      className={`bg-primary/10 text-primary flex items-center justify-center rounded-full font-medium ring-1 ring-border ${className}`}
      aria-hidden='true'
    >
      {initial}
    </span>
  )
}

function MoreArticlesByAuthor({
  authorId,
  currentGuid,
}: {
  authorId: number
  currentGuid: string
}) {
  const { t } = useTranslation()
  const { data } = useQuery({
    queryKey: ['blog-public', 'author', authorId],
    queryFn: () =>
      getPublishedArticles({ author_id: authorId, p: 1, page_size: 4 }),
    enabled: authorId > 0,
  })

  const articles =
    data?.data?.items?.filter((a: BlogArticle) => a.guid !== currentGuid) ?? []
  if (articles.length === 0) return null

  return (
    <div>
      <h2 className='mb-4 font-serif text-xl font-semibold'>
        {t('More from this author')}
      </h2>
      <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
        {articles.slice(0, 2).map((article: BlogArticle) => (
          <MoreArticleCard key={article.guid} article={article} />
        ))}
      </div>
    </div>
  )
}

function MoreArticleCard({ article }: { article: BlogArticle }) {
  return (
    <Link
      to='/blog/$guid'
      params={{ guid: article.guid }}
      className='group block'
    >
      <article className='bg-card border-border hover:border-primary/20 h-full rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md'>
        <h3 className='font-serif text-card-foreground group-hover:text-primary text-lg font-semibold leading-snug transition-colors'>
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
