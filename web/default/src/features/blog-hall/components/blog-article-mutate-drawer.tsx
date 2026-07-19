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
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
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
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

import { createBlogArticle, getBlogArticle, updateBlogArticle } from '../api'
import { BLOG_ARTICLE_STATUS_VALUES, SUCCESS_MESSAGES } from '../constants'
import { type BlogArticle } from '../types'
import { useBlogHall } from './blog-hall-provider'

// ============================================================================
// Form Schema
// ============================================================================

const blogArticleFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  summary: z.string().max(500),
  content: z.string(),
  tags: z.string(),
  status: z.enum(BLOG_ARTICLE_STATUS_VALUES),
})

type BlogArticleFormValues = z.infer<typeof blogArticleFormSchema>

const DEFAULT_VALUES: BlogArticleFormValues = {
  title: '',
  summary: '',
  content: '',
  tags: '',
  status: 'draft',
}

function articleToFormValues(article: BlogArticle): BlogArticleFormValues {
  return {
    title: article.title,
    summary: article.summary,
    content: article.content,
    tags: article.tags.join(', '),
    status: article.status,
  }
}

// ============================================================================
// Component
// ============================================================================

type BlogArticleMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: BlogArticle
}

export function BlogArticleMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: BlogArticleMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const { triggerRefresh } = useBlogHall()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const form = useForm<BlogArticleFormValues>({
    resolver: zodResolver(blogArticleFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      getBlogArticle(currentRow.id).then((result) => {
        if (result.success && result.data) {
          form.reset(articleToFormValues(result.data))
        }
      })
    } else if (open && !isUpdate) {
      form.reset(DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: BlogArticleFormValues) => {
    setIsSubmitting(true)
    try {
      const tagsArray = data.tags
        ? data.tags.split(',').map((t) => t.trim()).filter(Boolean)
        : []
      const payload = {
        title: data.title,
        summary: data.summary,
        content: data.content,
        tags: tagsArray,
        status: data.status,
      }

      if (isUpdate && currentRow) {
        const result = await updateBlogArticle(currentRow.id, payload)
        if (result.success) {
          const prevStatus = currentRow.status
          const newStatus = data.status
          if (prevStatus !== newStatus && newStatus === 'published') {
            toast.success(t(SUCCESS_MESSAGES.ARTICLE_PUBLISHED))
          } else if (prevStatus !== newStatus && prevStatus === 'published') {
            toast.success(t(SUCCESS_MESSAGES.ARTICLE_UNPUBLISHED))
          } else {
            toast.success(t(SUCCESS_MESSAGES.ARTICLE_UPDATED))
          }
          onOpenChange(false)
          triggerRefresh()
        }
      } else {
        const result = await createBlogArticle(payload)
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.ARTICLE_CREATED))
          onOpenChange(false)
          triggerRefresh()
        }
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSubmit)(event)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) form.reset()
      }}
    >
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[700px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate ? t('Update Article') : t('Create Article')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Edit your article and save changes.')
              : t('Write a new article for Blog Hall.')}{' '}
            {t("Click save when you're done.")}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='blog-article-form'
            onSubmit={handleSubmit}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Title')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Enter article title')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={form.control}
                name='content'
                render={({ field }) => (
                  <FormItem>
                    <div className='flex items-center justify-between'>
                      <FormLabel>{t('Article Content')}</FormLabel>
                      <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='h-auto py-0 text-xs'
                        onClick={() => setShowPreview((v) => !v)}
                      >
                        {showPreview ? t('Edit') : t('Preview')}
                      </Button>
                    </div>
                    {showPreview ? (
                      <div className='border-border min-h-[12rem] rounded-md border p-3 text-sm'>
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
                          placeholder={t('Write your article content here (Markdown supported)')}
                          className='h-48 resize-y font-mono text-sm'
                        />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={form.control}
                name='status'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Status')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select status')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          <SelectItem value='draft'>{t('Draft')}</SelectItem>
                          <SelectItem value='published'>
                            {t('Published')}
                          </SelectItem>
                          <SelectItem value='archived'>
                            {t('Archived')}
                          </SelectItem>
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormDescription>
                      {t(
                        'Publishing requires admin or Author team membership.'
                      )}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button variant='outline' />}>
            {t('Close')}
          </SheetClose>
          <Button
            form='blog-article-form'
            type='submit'
            disabled={isSubmitting}
          >
            {isSubmitting ? t('Saving...') : t('Save changes')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
