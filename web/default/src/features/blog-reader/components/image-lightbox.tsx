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
import { X } from 'lucide-react'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

interface ImageLightboxProps {
  src: string
  open: boolean
  onClose: () => void
}

export function ImageLightbox({ src, open, onClose }: ImageLightboxProps) {
  const { t } = useTranslation()

  useEffect(() => {
    if (!open) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [open, onClose])

  if (!open) {
    return null
  }

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4',
        'animate-in fade-in-0 duration-200'
      )}
      onClick={onClose}
      role='dialog'
      aria-modal='true'
      aria-label={t('Image preview')}
    >
      <button
        type='button'
        onClick={onClose}
        className='absolute top-4 right-4 inline-flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70'
        aria-label={t('Close image preview')}
      >
        <X className='h-5 w-5' />
      </button>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions */}
      <img
        src={src}
        alt=''
        className={cn(
          'max-h-full max-w-full object-contain',
          'animate-in zoom-in-95 duration-200'
        )}
        onClick={(event) => event.stopPropagation()}
      />
    </div>
  )
}
