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
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { createBlogArticle } from '@/features/blog-hall/api'

export const Route = createFileRoute('/_authenticated/blog-hall/new/')({
  component: NewBlogArticlePage,
})

function NewBlogArticlePage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [error, setError] = useState(false)

  useEffect(() => {
    let cancelled = false

    void createBlogArticle({
      title: t('Untitled article'),
      summary: '',
      content: '',
      tags: [],
      status: 'draft',
    }).then((result) => {
      if (cancelled) return
      if (result.success && result.data) {
        void navigate({
          to: '/blog-hall/$articleId',
          params: { articleId: String(result.data.id) },
        })
      } else {
        setError(true)
      }
    }).catch(() => {
      if (!cancelled) setError(true)
    })

    return () => {
      cancelled = true
    }
  }, [navigate, t])

  if (error) {
    return (
      <div className='flex h-full flex-col items-center justify-center gap-3 text-center'>
        <p className='text-destructive text-sm'>{t('Failed to create article.')}</p>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col items-center justify-center gap-3 text-center'>
      <Loader2 className='text-muted-foreground size-8 animate-spin' />
      <p className='text-muted-foreground text-sm'>{t('Creating article...')}</p>
    </div>
  )
}
