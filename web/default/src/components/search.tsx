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
import { Search as SearchIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useSearch } from '@/context/search-provider'
import { cn } from '@/lib/utils'

type SearchProps = React.ComponentProps<typeof Button> & {
  placeholder?: string
}

export function Search({ className, placeholder, ...props }: SearchProps) {
  const { t } = useTranslation()
  const { setOpen } = useSearch()
  const resolvedPlaceholder = placeholder ?? t('Search...')

  return (
    <Button
      type='button'
      variant='outline'
      className={cn(
        'text-muted-foreground relative h-8 w-full justify-start rounded-md bg-transparent px-3 text-sm font-normal shadow-none sm:w-44 lg:w-64',
        className
      )}
      onClick={() => setOpen(true)}
      {...props}
    >
      <SearchIcon className='size-4 text-muted-foreground' />
      <span className='ms-2 truncate'>{resolvedPlaceholder}</span>
      <kbd className='bg-muted pointer-events-none absolute end-[0.3rem] top-[0.3rem] hidden h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none sm:flex'>
        <span className='text-xs'>Ctrl</span>
        {t('K')}
      </kbd>
    </Button>
  )
}
