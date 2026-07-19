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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Camera, Loader2, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  getSelfAuthorProfile,
  updateSelfAuthorProfile,
} from '@/features/blog-reader/author-api'

import { uploadBlogImage } from '../api'

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function BlogAuthorProfilePanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['self-author-profile'],
    queryFn: getSelfAuthorProfile,
  })
  const profile = data?.data

  const [displayName, setDisplayName] = useState('')
  const [slug, setSlug] = useState('')
  const [avatar, setAvatar] = useState('')
  const [bio, setBio] = useState('')
  const [isPublic, setIsPublic] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setSlug(profile.slug || '')
      setAvatar(profile.avatar || '')
      setBio(profile.bio || '')
      setIsPublic(profile.is_public ?? false)
    }
  }, [profile])

  const handleAvatarClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const result = await uploadBlogImage(file)
      if (result.url) {
        setAvatar(result.url)
        toast.success(t('Image uploaded and inserted.'))
      }
    } catch {
      toast.error(t('Image upload failed.'))
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleSave = async () => {
    const trimmedSlug = slug.trim()
    if (!trimmedSlug) {
      toast.error(t('Slug cannot be empty'))
      return
    }
    if (!SLUG_PATTERN.test(trimmedSlug)) {
      toast.error(t('Slug can only contain lowercase letters, numbers, and hyphens'))
      return
    }

    setIsSaving(true)
    try {
      const result = await updateSelfAuthorProfile({
        display_name: displayName.trim(),
        slug: trimmedSlug,
        avatar: avatar.trim(),
        bio: bio.trim(),
        is_public: isPublic,
      })
      if (result.success && result.data) {
        toast.success(t('Author profile updated'))
        void queryClient.invalidateQueries({ queryKey: ['self-author-profile'] })
        void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
      } else {
        toast.error(result.message || t('Failed to update author profile'))
      }
    } catch {
      toast.error(t('Failed to update author profile'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return (
      <div className='border-b p-3 space-y-3'>
        <div className='bg-muted h-4 w-1/2 rounded' />
        <div className='bg-muted mx-auto h-16 w-16 rounded-full' />
        <div className='bg-muted h-9 rounded' />
        <div className='bg-muted h-9 rounded' />
        <div className='bg-muted h-16 rounded' />
      </div>
    )
  }

  return (
    <div className='border-b p-3 space-y-3'>
      <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
        <User className='h-4 w-4' aria-hidden='true' />
        {t('Edit author profile')}
      </div>

      {/* Avatar upload */}
      <div className='flex justify-center'>
        <button
          type='button'
          onClick={handleAvatarClick}
          disabled={isUploading}
          className='relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border bg-muted transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
          aria-label={t('Upload image')}
          title={t('Upload image')}
        >
          {avatar ? (
            <img
              src={avatar}
              alt=''
              className='h-full w-full object-cover'
              onError={(e) => {
                ;(e.target as HTMLImageElement).style.display = 'none'
              }}
            />
          ) : (
            <User className='text-muted-foreground h-8 w-8' aria-hidden='true' />
          )}
          <span className='absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity hover:opacity-100'>
            {isUploading ? (
              <Loader2 className='h-5 w-5 animate-spin text-white' aria-hidden='true' />
            ) : (
              <Camera className='h-5 w-5 text-white' aria-hidden='true' />
            )}
          </span>
          <input
            ref={fileInputRef}
            type='file'
            accept='image/*'
            className='hidden'
            onChange={(e) => { void handleFileChange(e) }}
          />
        </button>
      </div>

      {/* Display name */}
      <div className='space-y-1.5'>
        <Label htmlFor='sidebar-author-display-name' className='text-xs'>
          {t('Display Name')}
        </Label>
        <Input
          id='sidebar-author-display-name'
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('How readers will see you')}
          className='h-8 text-xs'
        />
      </div>

      {/* Slug */}
      <div className='space-y-1.5'>
        <Label htmlFor='sidebar-author-slug' className='text-xs'>
          {t('Slug')}
        </Label>
        <Input
          id='sidebar-author-slug'
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder={t('your-name')}
          className='h-8 text-xs'
        />
        <p className='text-muted-foreground text-[11px]'>
          {t('Lowercase letters, numbers, and hyphens only')}
        </p>
      </div>

      {/* Bio */}
      <div className='space-y-1.5'>
        <Label htmlFor='sidebar-author-bio' className='text-xs'>
          {t('Bio')}
        </Label>
        <Textarea
          id='sidebar-author-bio'
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('A short introduction about you')}
          rows={2}
          className='resize-none text-xs'
        />
      </div>

      {/* Public switch */}
      <div className='flex items-center justify-between rounded-lg border p-2'>
        <div>
          <Label htmlFor='sidebar-author-public' className='text-xs font-medium'>
            {t('Public profile')}
          </Label>
          <p className='text-muted-foreground text-[11px]'>
            {t('Make your author page visible to readers')}
          </p>
        </div>
        <Switch
          id='sidebar-author-public'
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
      </div>

      <Button
        size='sm'
        className='w-full'
        onClick={() => void handleSave()}
        disabled={isSaving || isUploading}
      >
        {isSaving ? t('Saving...') : t('Save')}
      </Button>
    </div>
  )
}
