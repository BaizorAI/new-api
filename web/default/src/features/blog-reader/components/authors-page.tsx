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
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import { getBlogAuthors } from '../author-api'

import type { BlogAuthorDetail } from '../author-types'

const PAGE_SIZE = 24

export function AuthorsPage() {
  const { t } = useTranslation()
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['blog-authors', page],
    queryFn: () => getBlogAuthors({ p: page, page_size: PAGE_SIZE }),
  })

  const authors = data?.data?.items ?? []
  const total = data?.data?.total ?? 0
  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div className='min-h-screen bg-background'>
      <section className='border-b bg-gradient-to-br from-background via-background to-muted/50 pt-12 pb-10 md:pt-16 md:pb-12'>
        <div className='mx-auto max-w-6xl px-4'>
          <div className='flex items-center gap-3'>
            <span className='bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl'>
              <Users className='size-6' />
            </span>
            <div>
              <h1 className='font-serif text-3xl font-bold tracking-tight md:text-4xl'>
                {t('Authors')}
              </h1>
              <p className='text-muted-foreground mt-1 text-sm'>
                {t('People behind the articles')}
              </p>
            </div>
          </div>
        </div>
      </section>

      <main className='mx-auto max-w-6xl px-4 py-12'>
        {isLoading ? (
          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className='bg-muted animate-pulse h-40 rounded-2xl' />
            ))}
          </div>
        ) : authors.length === 0 ? (
          <div className='flex flex-col items-center justify-center py-24 text-center gap-3'>
            <Users className='text-muted-foreground h-10 w-10' />
            <p className='text-muted-foreground'>{t('No authors yet.')}</p>
          </div>
        ) : (
          <>
            <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'>
              {authors.map((author) => (
                <AuthorCard key={author.id} author={author} />
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

function AuthorCard({ author }: { author: BlogAuthorDetail }) {
  const { t } = useTranslation()
  const initial = author.display_name.charAt(0).toUpperCase()
  return (
    <Link
      to='/blog/authors/$authorSlug'
      params={{ authorSlug: author.slug }}
      className='block'
    >
      <div className='group bg-card border-border hover:border-primary/30 h-full overflow-hidden rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg'>
        <div className='flex flex-col items-center text-center'>
          {author.avatar ? (
            <img
              src={author.avatar}
              alt={author.display_name}
              className='size-20 rounded-full object-cover ring-4 ring-background'
            />
          ) : (
            <span className='bg-primary/10 text-primary flex size-20 items-center justify-center rounded-full text-2xl font-medium ring-4 ring-background'>
              {initial}
            </span>
          )}
          <h2 className='mt-4 text-lg font-semibold transition-colors group-hover:text-primary'>
            {author.display_name}
          </h2>
          {author.bio ? (
            <p className='text-muted-foreground mt-1 line-clamp-2 text-sm'>
              {author.bio}
            </p>
          ) : (
            <p className='text-muted-foreground/50 mt-1 text-sm italic'>
              {t('A short introduction about you')}
            </p>
          )}
          <p className='text-muted-foreground mt-4 text-xs'>
            {t('{count} articles', { count: author.article_count })}
          </p>
        </div>
      </div>
    </Link>
  )
}
