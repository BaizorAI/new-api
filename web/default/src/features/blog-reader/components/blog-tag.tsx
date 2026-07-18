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
}

export function BlogTag({ tag, className, stopPropagation = true }: BlogTagProps) {
  const encoded = encodeURIComponent(tag)
  return (
    <Link
      to='/blog/tags/$tag'
      params={{ tag: encoded }}
      onClick={stopPropagation ? (e) => e.stopPropagation() : undefined}
      className={cn(
        'inline-flex w-fit max-w-full min-w-0 shrink items-center rounded-4xl px-2 py-0.5 text-xs font-medium tracking-normal whitespace-nowrap',
        'bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors',
        className
      )}
      title={tag}
    >
      <span className='min-w-0 truncate leading-normal'>{tag}</span>
    </Link>
  )
}
