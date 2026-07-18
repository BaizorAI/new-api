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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  type ReadingFontSize,
  type ReadingLineHeight,
  type ReadingPreferences,
} from '@/features/blog-reader/hooks/use-reading-preferences'

interface ReadingPreferencesPanelProps {
  preferences: ReadingPreferences
  onChange: (next: Partial<ReadingPreferences>) => void
  className?: string
}

const FONT_SIZES: ReadingFontSize[] = ['sm', 'base', 'lg', 'xl']
const LINE_HEIGHTS: ReadingLineHeight[] = ['snug', 'relaxed', 'loose']

export function ReadingPreferencesPanel({
  preferences,
  onChange,
  className,
}: ReadingPreferencesPanelProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('space-y-4', className)}>
      <div>
        <h4 className='mb-2 text-sm font-medium'>{t('Font size')}</h4>
        <div className='flex flex-wrap gap-1.5'>
          {FONT_SIZES.map((size) => (
            <Button
              key={size}
              type='button'
              variant={preferences.fontSize === size ? 'default' : 'outline'}
              size='xs'
              onClick={() => onChange({ fontSize: size })}
              aria-pressed={preferences.fontSize === size}
            >
              {size === 'sm' && t('Small')}
              {size === 'base' && t('Default')}
              {size === 'lg' && t('Large')}
              {size === 'xl' && t('Extra large')}
            </Button>
          ))}
        </div>
      </div>

      <div>
        <h4 className='mb-2 text-sm font-medium'>{t('Line height')}</h4>
        <div className='flex flex-wrap gap-1.5'>
          {LINE_HEIGHTS.map((height) => (
            <Button
              key={height}
              type='button'
              variant={
                preferences.lineHeight === height ? 'default' : 'outline'
              }
              size='xs'
              onClick={() => onChange({ lineHeight: height })}
              aria-pressed={preferences.lineHeight === height}
            >
              {height === 'snug' && t('Compact')}
              {height === 'relaxed' && t('Relaxed')}
              {height === 'loose' && t('Loose')}
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}
