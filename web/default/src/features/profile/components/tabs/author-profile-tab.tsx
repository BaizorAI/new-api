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
import { PenLine } from 'lucide-react'
import { useEffect, useState } from 'react'
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

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

export function AuthorProfileTab() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
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
      } else {
        toast.error(result.message || t('Failed to update author profile'))
      }
    } catch {
      toast.error(t('Failed to update author profile'))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className='space-y-5'>
      <div className='flex items-center gap-2 text-sm font-medium text-muted-foreground'>
        <PenLine className='h-4 w-4' />
        {t('Edit your public author profile')}
      </div>

      {isLoading ? (
        <div className='space-y-3'>
          <div className='bg-muted h-10 rounded' />
          <div className='bg-muted h-10 rounded' />
          <div className='bg-muted h-24 rounded' />
        </div>
      ) : (
        <>
          <div className='space-y-2'>
            <Label htmlFor='author-display-name'>{t('Display Name')}</Label>
            <Input
              id='author-display-name'
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t('How readers will see you')}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='author-slug'>{t('Slug')}</Label>
            <Input
              id='author-slug'
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={t('your-name')}
            />
            <p className='text-muted-foreground text-xs'>
              {t('Lowercase letters, numbers, and hyphens only')}
            </p>
          </div>

          <div className='space-y-2'>
            <Label htmlFor='author-avatar'>{t('Avatar URL')}</Label>
            <Input
              id='author-avatar'
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder={t('https://example.com/avatar.png')}
            />
          </div>

          <div className='space-y-2'>
            <Label htmlFor='author-bio'>{t('Bio')}</Label>
            <Textarea
              id='author-bio'
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={t('A short introduction about you')}
              rows={4}
            />
          </div>

          <div className='flex items-center justify-between rounded-lg border p-3'>
            <div>
              <Label htmlFor='author-public' className='font-medium'>
                {t('Public profile')}
              </Label>
              <p className='text-muted-foreground text-xs'>
                {t('Make your author page visible to readers')}
              </p>
            </div>
            <Switch
              id='author-public'
              checked={isPublic}
              onCheckedChange={setIsPublic}
            />
          </div>

          <Button onClick={() => void handleSave()} disabled={isSaving}>
            {isSaving ? t('Saving...') : t('Save')}
          </Button>
        </>
      )}
    </div>
  )
}
