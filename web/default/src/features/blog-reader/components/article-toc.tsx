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

import { cn } from '@/lib/utils'

export interface TocHeading {
  level: number
  text: string
  id: string
}

interface ArticleTocProps {
  headings: TocHeading[]
  activeId?: string | null
  className?: string
}

export function ArticleToc({
  headings,
  activeId,
  className,
}: ArticleTocProps) {
  const { t } = useTranslation()

  if (headings.length === 0) {
    return null
  }

  return (
    <nav
      className={cn('text-sm', className)}
      aria-label={t('Table of contents')}
    >
      <h3 className='mb-2 font-semibold'>{t('Table of contents')}</h3>
      <ul className='space-y-1 border-l pl-2'>
        {headings.map((heading) => (
          <li
            key={heading.id}
            style={{ paddingLeft: `${Math.max(0, heading.level - 2) * 0.75}rem` }}
          >
            <a
              href={`#${heading.id}`}
              onClick={(event) => {
                event.preventDefault()
                const element = document.getElementById(heading.id)
                if (element) {
                  element.scrollIntoView({ behavior: 'smooth', block: 'start' })
                  window.history.replaceState(null, '', `#${heading.id}`)
                }
              }}
              className={cn(
                'block py-0.5 text-muted-foreground transition-colors hover:text-foreground',
                activeId === heading.id &&
                  'border-l-2 border-primary pl-2 -ml-[calc(0.5rem+2px)] text-foreground'
              )}
            >
              {heading.text}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
