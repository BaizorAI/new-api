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

interface BlogAuthorProfilePanelProps {
  variant?: 'sidebar' | 'page'
}

export function BlogAuthorProfilePanel({
  variant = 'sidebar',
}: BlogAuthorProfilePanelProps) {
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
  const [isPublic, setIsPublic] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || '')
      setSlug(profile.slug || '')
      setAvatar(profile.avatar || '')
      setBio(profile.bio || '')
      setIsPublic(profile.is_public ?? true)
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

  const isPage = variant === 'page'
  const inputIdPrefix = isPage ? 'page' : 'sidebar'

  if (isLoading) {
    if (isPage) {
      return (
        <div className='mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6'>
          <div className='bg-muted h-6 w-48 rounded' />
          <div className='bg-muted h-4 w-64 rounded' />
          <div className='bg-muted mx-auto h-24 w-24 rounded-full' />
          <div className='bg-muted h-10 rounded' />
          <div className='bg-muted h-10 rounded' />
          <div className='bg-muted h-24 rounded' />
        </div>
      )
    }
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
    <div
      className={
        isPage
          ? 'mx-auto w-full max-w-2xl space-y-6 p-4 sm:p-6'
          : 'border-b p-3 space-y-3'
      }
    >
      {isPage ? (
        <div className='flex items-center gap-4'>
          <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10'>
            <User className='h-6 w-6 text-primary' aria-hidden='true' />
          </div>
          <div>
            <h1 className='text-xl font-semibold'>{t('Author Profile')}</h1>
            <p className='text-muted-foreground text-sm'>
              {t('Edit your public author profile')}
            </p>
          </div>
        </div>
      ) : (
        <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
          <User className='h-4 w-4' aria-hidden='true' />
          {t('Edit author profile')}
        </div>
      )}

      {/* Avatar upload */}
      <div className='flex justify-center'>
        <button
          type='button'
          onClick={handleAvatarClick}
          disabled={isUploading}
          className={`relative flex items-center justify-center overflow-hidden rounded-full border bg-muted transition-colors hover:bg-muted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            isPage ? 'h-24 w-24' : 'h-16 w-16'
          }`}
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
            <User
              className={`text-muted-foreground ${isPage ? 'h-12 w-12' : 'h-8 w-8'}`}
              aria-hidden='true'
            />
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
      <div className={isPage ? 'space-y-2' : 'space-y-1.5'}>
        <Label
          htmlFor={`${inputIdPrefix}-author-display-name`}
          className={isPage ? 'text-sm' : 'text-xs'}
        >
          {t('Display Name')}
        </Label>
        <Input
          id={`${inputIdPrefix}-author-display-name`}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t('How readers will see you')}
          className={isPage ? 'h-10 text-sm' : 'h-8 text-xs'}
        />
      </div>

      {/* Slug */}
      <div className={isPage ? 'space-y-2' : 'space-y-1.5'}>
        <Label
          htmlFor={`${inputIdPrefix}-author-slug`}
          className={isPage ? 'text-sm' : 'text-xs'}
        >
          {t('Slug')}
        </Label>
        <Input
          id={`${inputIdPrefix}-author-slug`}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder={t('your-name')}
          className={isPage ? 'h-10 text-sm' : 'h-8 text-xs'}
        />
        <p className={`text-muted-foreground ${isPage ? 'text-xs' : 'text-[11px]'}`}>
          {t('Lowercase letters, numbers, and hyphens only')}
        </p>
      </div>

      {/* Bio */}
      <div className={isPage ? 'space-y-2' : 'space-y-1.5'}>
        <Label
          htmlFor={`${inputIdPrefix}-author-bio`}
          className={isPage ? 'text-sm' : 'text-xs'}
        >
          {t('Bio')}
        </Label>
        <Textarea
          id={`${inputIdPrefix}-author-bio`}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder={t('A short introduction about you')}
          rows={isPage ? 4 : 2}
          className={`resize-none ${isPage ? 'text-sm' : 'text-xs'}`}
        />
      </div>

      {/* Public switch */}
      <div
        className={`flex items-center justify-between rounded-lg border ${
          isPage ? 'p-3' : 'p-2'
        }`}
      >
        <div>
          <Label
            htmlFor={`${inputIdPrefix}-author-public`}
            className={`font-medium ${isPage ? 'text-sm' : 'text-xs'}`}
          >
            {t('Public profile')}
          </Label>
          <p className={`text-muted-foreground ${isPage ? 'text-xs' : 'text-[11px]'}`}>
            {t('Make your author page visible to readers')}
          </p>
        </div>
        <Switch
          id={`${inputIdPrefix}-author-public`}
          checked={isPublic}
          onCheckedChange={setIsPublic}
        />
      </div>

      <Button
        size={isPage ? 'default' : 'sm'}
        className={isPage ? '' : 'w-full'}
        onClick={() => void handleSave()}
        disabled={isSaving || isUploading}
      >
        {isSaving ? t('Saving...') : t('Save')}
      </Button>
    </div>
  )
}
