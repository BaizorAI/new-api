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
import { ImageIcon, Send } from 'lucide-react'
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'

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

import { useBlogWorkspace } from './blog-workspace-provider'

import type { BlogArticleStatus } from '../types'

export function BlogWorkspaceToolbar() {
  const { t } = useTranslation()
  const {
    title,
    setTitle,
    coverImage,
    setCoverImage,
    status,
    setStatus,
    save,
    isSaving,
    isDirty,
  } = useBlogWorkspace()

  const isPublished = status === 'published'

  const handlePublishToggle = useCallback(() => {
    const nextStatus: BlogArticleStatus = isPublished ? 'draft' : 'published'
    setStatus(nextStatus)
    // Save immediately with the new status
    setTimeout(() => void save(), 0)
  }, [isPublished, setStatus, save])

  return (
    <div className='border-border flex shrink-0 items-center gap-3 border-b px-4 py-2'>
      <Select
        onValueChange={(value) => {
          if (value) setStatus(value as BlogArticleStatus)
        }}
        value={status}
      >
        <SelectTrigger className='w-32' aria-label={t('Status')}>
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

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className='flex-1 border-none px-0 font-semibold shadow-none focus-visible:ring-0'
        placeholder={t('Article title...')}
      />

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

      <Button
        size='sm'
        variant='outline'
        disabled={isSaving || !isDirty}
        onClick={() => void save()}
      >
        {isSaving ? t('Saving...') : t('Save')}
      </Button>

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
