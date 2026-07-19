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
import { BookOpen, Search, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

interface BlogHeaderProps {
  className?: string
}

export function BlogHeader({ className }: BlogHeaderProps) {
  const { t } = useTranslation()

  return (
    <header
      className={cn(
        'sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md',
        className
      )}
    >
      <div className='mx-auto flex h-14 max-w-6xl items-center justify-between px-4'>
        <Link to='/blog' className='flex items-center gap-2'>
          <BookOpen className='size-5 text-primary' />
          <span className='font-serif text-lg font-bold tracking-tight'>
            {t('Blog Hall')}
          </span>
        </Link>

        <nav className='flex items-center gap-1'>
          <HeaderLink to='/blog'>{t('Articles')}</HeaderLink>
          <HeaderLink to='/blog/authors'>
            <Users className='mr-1 size-3.5' />
            {t('Authors')}
          </HeaderLink>
          <HeaderLink to='/blog/search'>
            <Search className='mr-1 size-3.5' />
            {t('Search')}
          </HeaderLink>
        </nav>
      </div>
    </header>
  )
}

function HeaderLink({
  to,
  children,
}: {
  to: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      className={cn(
        'inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
        'hover:bg-muted hover:text-foreground'
      )}
    >
      {children}
    </Link>
  )
}
