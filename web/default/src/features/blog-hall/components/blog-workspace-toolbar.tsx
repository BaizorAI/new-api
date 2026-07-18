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
import { ImageIcon, Loader2, PanelLeftClose, PanelLeftOpen, Send, Sparkles } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { updateBlogArticle } from '../api'
import { useBlogWorkspace } from './blog-workspace-provider'

import type { BlogArticleStatus } from '../types'

export function BlogWorkspaceToolbar({
  showArticleList,
  onToggleArticleList,
}: {
  showArticleList?: boolean
  onToggleArticleList?: () => void
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    article,
    coverImage,
    setCoverImage,
    status,
    setStatus,
    title,
    summary,
    content,
    tags,
    save,
    isSaving,
    isDirty,
    isAnalyzing,
    requestAnalyze,
  } = useBlogWorkspace()

  const [isPublishing, setIsPublishing] = useState(false)

  const isPublished = status === 'published'

  // Publish/unpublish — must bypass the save() closure because React state
  // updates are async and save() would capture the old status value.
  const handlePublishToggle = useCallback(async () => {
    if (!article || isPublishing) return
    const nextStatus: BlogArticleStatus = isPublished ? 'draft' : 'published'
    setIsPublishing(true)
    try {
      const parsedTags = tags
        ? tags.split(',').map((t) => t.trim()).filter(Boolean)
        : []
      const result = await updateBlogArticle(article.id, {
        title,
        summary,
        content,
        cover_image: coverImage,
        tags: parsedTags,
        status: nextStatus,
      })
      if (result.success) {
        setStatus(nextStatus)
        toast.success(
          nextStatus === 'published' ? t('Article published.') : t('Article unpublished.')
        )
        void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
        void queryClient.invalidateQueries({ queryKey: ['blog-article', article.id] })
      }
    } catch {
      toast.error(t('Failed to update article.'))
    } finally {
      setIsPublishing(false)
    }
  }, [article, isPublished, isPublishing, title, summary, content, coverImage, tags, setStatus, t, queryClient])

  return (
    <div className='border-border flex shrink-0 items-center gap-3 border-b px-4 py-2'>
      {/* Article list toggle */}
      {onToggleArticleList && (
        <Button
          size='sm'
          variant='ghost'
          onClick={onToggleArticleList}
          title={showArticleList ? t('Hide articles') : t('Show articles')}
        >
          {showArticleList ? (
            <PanelLeftClose className='mr-1.5 size-4' />
          ) : (
            <PanelLeftOpen className='mr-1.5 size-4' />
          )}
          {t('Articles')}
        </Button>
      )}

      {/* Status selector */}
      <Select
        onValueChange={(value) => {
          if (value) setStatus(value as BlogArticleStatus)
        }}
        value={status}
      >
        <SelectTrigger className='w-28' aria-label={t('Status')}>
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

      {/* Spacer — push following items to the right */}
      <div className='flex-1' />

      {/* Cover image */}
      <Popover>
        <PopoverTrigger
          className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
            coverImage
              ? 'border-primary/50 text-primary bg-primary/5'
              : 'border-border text-muted-foreground hover:text-foreground hover:bg-muted/50'
          }`}
          aria-label={t('Cover image')}
        >
          <ImageIcon className='size-4' />
        </PopoverTrigger>
        <PopoverContent align='end' className='w-80'>
          <PopoverHeader>
            <PopoverTitle>{t('Cover image')}</PopoverTitle>
          </PopoverHeader>
          <Input
            value={coverImage}
            onChange={(e) => setCoverImage(e.target.value)}
            placeholder={t('Enter image URL...')}
            className='text-xs'
          />
          {coverImage && (
            <img
              src={coverImage}
              alt={t('Cover preview')}
              className='mt-1 max-h-32 w-full rounded-md object-cover'
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          )}
        </PopoverContent>
      </Popover>

      {/* AI Analyze */}
      <Button
        size='sm'
        variant='outline'
        disabled={isAnalyzing || !content.trim()}
        onClick={requestAnalyze}
        title={t('AI analyzes article quality and publishing readiness.')}
      >
        {isAnalyzing ? (
          <Loader2 className='mr-1 size-3.5 animate-spin' />
        ) : (
          <Sparkles className='mr-1 size-3.5 text-amber-500' />
        )}
        {isAnalyzing ? t('Analyzing...') : t('AI Analyze')}
      </Button>

      {/* Save */}
      <Button
        size='sm'
        variant='outline'
        disabled={isSaving || !isDirty}
        onClick={() => void save()}
      >
        {isSaving ? t('Saving...') : t('Save')}
      </Button>

      {/* Publish */}
      <Button
        size='sm'
        variant={isPublished ? 'outline' : 'default'}
        disabled={isSaving}
        onClick={handlePublishToggle}
      >
        <Send className='size-3.5' aria-hidden='true' />
        {isPublished ? t('Unpublish') : t('Publish')}
      </Button>
    </div>
  )
}
