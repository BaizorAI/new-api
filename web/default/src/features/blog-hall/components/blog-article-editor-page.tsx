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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from '@tanstack/react-router'
import { Eye, EyeOff } from 'lucide-react'
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Markdown } from '@/components/ui/markdown'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'

import { getBlogArticle, updateBlogArticle } from '../api'
import { BLOG_ARTICLE_STATUS_VALUES } from '../constants'
import type { BlogArticle } from '../types'

// ============================================================================
// Form schema (mirrors the drawer schema)
// ============================================================================

const formSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  summary: z.string().max(500).default(''),
  content: z.string().default(''),
  tags: z.string().default(''),
  status: z.enum(BLOG_ARTICLE_STATUS_VALUES).default('draft'),
})

type FormValues = z.infer<typeof formSchema>

const DEFAULT_VALUES: FormValues = {
  title: '',
  summary: '',
  content: '',
  tags: '',
  status: 'draft',
}

function articleToFormValues(a: BlogArticle): FormValues {
  return {
    title: a.title,
    summary: a.summary,
    content: a.content,
    tags: a.tags.join(', '),
    status: a.status,
  }
}

// ============================================================================
// Component
// ============================================================================

export function BlogArticleEditorPage() {
  const { t } = useTranslation()
  const { articleId } = useParams({ from: '/_authenticated/blog-hall/$articleId/' })
  const id = Number(articleId)
  const queryClient = useQueryClient()
  const [showPreview, setShowPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['blog-article', id],
    queryFn: () => getBlogArticle(id),
    enabled: !!id,
  })

  const article = data?.data

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (article) {
      form.reset(articleToFormValues(article))
    }
  }, [article, form])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(async (values) => {
      setIsSubmitting(true)
      try {
        const tags = values.tags
          ? values.tags
              .split(',')
              .map((tag) => tag.trim())
              .filter(Boolean)
          : []
        const result = await updateBlogArticle(id, { ...values, tags })
        if (result.success) {
          toast.success(t('Article updated.'))
          void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
          void queryClient.invalidateQueries({ queryKey: ['blog-article', id] })
        }
      } finally {
        setIsSubmitting(false)
      }
    })(event)
  }

  if (isLoading) {
    return (
      <div className='flex h-full items-center justify-center'>
        <div className='bg-muted h-8 w-48 animate-pulse rounded' />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        id='blog-editor-form'
        onSubmit={handleSubmit}
        className='flex h-full flex-col overflow-hidden'
      >
        {/* ── Toolbar ─────────────────────────────────────────────────── */}
        <div className='border-border flex shrink-0 items-center gap-3 border-b px-6 py-3'>
          <FormField
            control={form.control}
            name='status'
            render={({ field }) => (
              <Select onValueChange={field.onChange} value={field.value}>
                <SelectTrigger className='w-36'>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent alignItemWithTrigger={false}>
                  <SelectGroup>
                    <SelectItem value='draft'>{t('Draft')}</SelectItem>
                    <SelectItem value='published'>{t('Published')}</SelectItem>
                    <SelectItem value='archived'>{t('Archived')}</SelectItem>
                  </SelectGroup>
                </SelectContent>
              </Select>
            )}
          />
          <div className='flex-1' />
          <Button type='submit' size='sm' disabled={isSubmitting}>
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className='flex-1 overflow-y-auto'>
          <div className='mx-auto max-w-3xl space-y-6 px-8 py-8'>
            {/* Title */}
            <FormField
              control={form.control}
              name='title'
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input
                      {...field}
                      className='border-none px-0 text-2xl font-bold shadow-none focus-visible:ring-0'
                      placeholder={t('Article title...')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Separator />

            {/* Content */}
            <FormField
              control={form.control}
              name='content'
              render={({ field }) => (
                <FormItem>
                  <div className='flex items-center justify-between'>
                    <FormLabel className='text-muted-foreground'>
                      {t('Article Content')}
                    </FormLabel>
                    <Button
                      type='button'
                      variant='ghost'
                      size='sm'
                      className='h-auto gap-1.5 py-0 text-xs'
                      onClick={() => setShowPreview((v) => !v)}
                    >
                      {showPreview ? (
                        <EyeOff className='size-3.5' aria-hidden='true' />
                      ) : (
                        <Eye className='size-3.5' aria-hidden='true' />
                      )}
                      {showPreview ? t('Edit') : t('Preview')}
                    </Button>
                  </div>
                  {showPreview ? (
                    <div className='border-border min-h-64 rounded-md border p-4'>
                      {field.value ? (
                        <Markdown>{field.value}</Markdown>
                      ) : (
                        <span className='text-muted-foreground italic'>
                          {t('Nothing to preview yet.')}
                        </span>
                      )}
                    </div>
                  ) : (
                    <FormControl>
                      <Textarea
                        {...field}
                        className='min-h-96 resize-none font-mono text-sm'
                        placeholder={t(
                          'Write your article content here (Markdown supported)'
                        )}
                      />
                    </FormControl>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Summary */}
            <FormField
              control={form.control}
              name='summary'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Summary')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('Brief description of the article')}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Optional. Up to 500 characters.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <FormField
              control={form.control}
              name='tags'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Tags')}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t('Tags (comma-separated)')}
                    />
                  </FormControl>
                  <FormDescription>
                    {t('Separate tags with commas, e.g. AI, tutorial, tips')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Status hint */}
            <FormDescription>
              {t('Publishing requires admin or Author team membership.')}
            </FormDescription>
          </div>
        </div>
      </form>
    </Form>
  )
}
