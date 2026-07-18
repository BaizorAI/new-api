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
import { useNavigate } from '@tanstack/react-router'
import { Search } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface BlogSearchFormProps {
  initialQuery?: string
  className?: string
}

export function BlogSearchForm({ initialQuery = '', className }: BlogSearchFormProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [query, setQuery] = useState(initialQuery)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    if (!trimmed) return
    void navigate({
      to: '/blog/search',
      search: { q: trimmed },
    })
  }

  return (
    <form onSubmit={handleSubmit} className={`flex gap-2 ${className ?? ''}`}>
      <div className='relative flex-1'>
        <Search className='text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
        <Input
          type='search'
          placeholder={t('Search articles')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className='pl-9'
        />
      </div>
      <Button type='submit'>{t('Search')}</Button>
    </form>
  )
}
