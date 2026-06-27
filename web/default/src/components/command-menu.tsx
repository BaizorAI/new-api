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
import { ArrowRight, Laptop, Moon, Sun } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command'
import { useSearch } from '@/context/search-provider'
import { useTheme } from '@/context/theme-provider'
import { useCommandMenuItems } from '@/hooks/use-command-menu-items'

import { ScrollArea } from './ui/scroll-area'

export function CommandMenu() {
  const { t } = useTranslation()
  const { setTheme } = useTheme()
  const { open, setOpen } = useSearch()
  const groups = useCommandMenuItems(open)

  const runCommand = React.useCallback(
    (command: () => unknown) => {
      setOpen(false)
      command()
    },
    [setOpen]
  )

  return (
    <CommandDialog modal open={open} onOpenChange={setOpen}>
      <Command>
        <CommandInput placeholder={t('Type a command or search...')} />
        <CommandList>
          <ScrollArea className='h-72 pe-1'>
            <CommandEmpty>{t('No results found.')}</CommandEmpty>
            {groups.map((group) => (
              <CommandGroup key={group.heading} heading={group.heading}>
                {group.items.map((item) => (
                  <CommandItem
                    key={item.id}
                    value={item.value}
                    onSelect={() => {
                      runCommand(item.onSelect)
                    }}
                  >
                    <div className='flex size-4 items-center justify-center'>
                      <ArrowRight className='text-muted-foreground/80 size-2' />
                    </div>
                    {item.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            <CommandSeparator />
            <CommandGroup heading='Theme'>
              <CommandItem onSelect={() => runCommand(() => setTheme('light'))}>
                <Sun /> <span>{t('Light')}</span>
              </CommandItem>
              <CommandItem onSelect={() => runCommand(() => setTheme('dark'))}>
                <Moon className='scale-90' />
                <span>{t('Dark')}</span>
              </CommandItem>
              <CommandItem
                onSelect={() => runCommand(() => setTheme('system'))}
              >
                <Laptop />
                <span>{t('System')}</span>
              </CommandItem>
            </CommandGroup>
          </ScrollArea>
        </CommandList>
      </Command>
    </CommandDialog>
  )
}
