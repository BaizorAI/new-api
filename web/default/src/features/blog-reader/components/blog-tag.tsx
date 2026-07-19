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

import { cn } from '@/lib/utils'

interface BlogTagProps {
  tag: string
  className?: string
  stopPropagation?: boolean
  variant?: 'default' | 'pill' | 'filled'
}

function tagHue(tag: string): number {
  let hash = 0
  for (let i = 0; i < tag.length; i++) {
    hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  }
  return Math.abs(hash) % 360
}

export function BlogTag({
  tag,
  className,
  stopPropagation = true,
  variant = 'default',
}: BlogTagProps) {
  const hue = tagHue(tag)
  const isFilled = variant === 'filled'

  return (
    <Link
      to='/blog/tags/$tag'
      params={{ tag }}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={cn(
        'inline-flex w-fit max-w-full min-w-0 shrink items-center rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-all',
        isFilled
          ? 'text-white shadow-sm hover:opacity-90'
          : 'bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground',
        className
      )}
      style={isFilled ? { backgroundColor: `hsl(${hue} 65% 55%)` } : undefined}
      title={tag}
    >
      <span className='min-w-0 truncate leading-normal'>{tag}</span>
    </Link>
  )
}
