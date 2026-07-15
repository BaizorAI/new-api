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
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

import { useDeleteStudioShot } from '../hooks/use-studio-mutations'
import type { StudioShot } from '../types'

type StudioShotDeleteDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: number
  shot: StudioShot | null
}

export function StudioShotDeleteDialog({
  open,
  onOpenChange,
  projectId,
  shot,
}: StudioShotDeleteDialogProps) {
  const { t } = useTranslation()
  const [isDeleting, setIsDeleting] = useState(false)
  const deleteMutation = useDeleteStudioShot(projectId)

  const handleDelete = async () => {
    if (!shot) return
    setIsDeleting(true)
    try {
      const result = await deleteMutation.mutateAsync(shot.id)
      if (result.success) onOpenChange(false)
    } finally {
      setIsDeleting(false)
    }
  }

  const shotLabel = shot
    ? t('S{{scene}}-{{shot}}', { scene: shot.scene_number, shot: shot.shot_number })
    : ''

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Are you sure?')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('This will permanently delete the shot')}{' '}
            <span className='font-semibold'>{shotLabel}</span>.{' '}
            {t('This action cannot be undone.')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>
            {t('Cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            variant='destructive'
            disabled={isDeleting}
            onClick={(e) => {
              e.preventDefault()
              void handleDelete()
            }}
          >
            {isDeleting ? t('Deleting...') : t('Delete')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
