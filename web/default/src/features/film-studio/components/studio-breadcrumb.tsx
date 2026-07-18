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
import { Link } from '@tanstack/react-router'
import { ChevronRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

type BreadcrumbItem = {
  label: string
  to?: string
}

interface StudioBreadcrumbProps {
  /** Breadcrumb trail — each entry can be a link or plain text. */
  items: BreadcrumbItem[]
  className?: string
}

/**
 * Studio breadcrumb — shows the current navigation path.
 *
 * Usage:
 *   <StudioBreadcrumb items={[
 *     { label: 'Film Studio', to: '/studio' },
 *     { label: '项目名称' },
 *     { label: '剧本创作' },
 *   ]} />
 */
export function StudioBreadcrumb({ items, className }: StudioBreadcrumbProps) {
  return (
    <nav
      className={cn(
        'border-border flex items-center gap-1 border-b px-4 py-2 text-[11px]',
        className,
      )}
      aria-label='Breadcrumb'
    >
      {items.map((item, i) => {
        const isLast = i === items.length - 1
        return (
          <span key={i} className='flex items-center gap-1'>
            {i > 0 ? (
              <ChevronRight className='text-muted-foreground size-3 shrink-0' aria-hidden='true' />
            ) : null}
            {item.to && !isLast ? (
              <Link
                to={item.to as any}
                className='text-muted-foreground hover:text-foreground truncate transition-colors'
              >
                {item.label}
              </Link>
            ) : (
              <span className={cn(isLast ? 'font-medium' : 'text-muted-foreground', 'truncate')}>
                {item.label}
              </span>
            )}
          </span>
        )
      })}
    </nav>
  )
}
