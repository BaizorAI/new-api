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
import { ChevronRight } from 'lucide-react'
import { useEffect, useState, type ElementType, type ReactNode } from 'react'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  useSidebar,
} from '@/components/ui/sidebar'
import { useSidebarGroupState } from '@/hooks/use-sidebar-group-state'

export type SidebarCollapsibleShellProps = {
  id: string
  title: string
  icon?: ElementType
  description?: string
  isActive: boolean
  defaultOpen?: boolean
  action?: ReactNode
  expandedContent: ReactNode
  collapsedContent: ReactNode
}

/**
 * Shared wrapper for sidebar items that can be expanded (collapsible) or
 * collapsed into a dropdown, depending on the sidebar state.
 */
export function SidebarCollapsibleShell({
  id,
  title,
  icon,
  description,
  isActive,
  defaultOpen,
  action,
  expandedContent,
  collapsedContent,
}: SidebarCollapsibleShellProps) {
  const { state, isMobile } = useSidebar()
  const { getGroupOpen, setGroupOpen } = useSidebarGroupState()
  const [open, setOpen] = useState(() =>
    getGroupOpen(id, defaultOpen ?? isActive)
  )

  useEffect(() => {
    if (isActive && !open) {
      setOpen(true)
      setGroupOpen(id, true)
    }
  }, [isActive, open, id, setGroupOpen])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    setGroupOpen(id, next)
  }

  const Icon = icon
  const trigger = (
    <>
      {Icon ? <Icon className='shrink-0' aria-hidden='true' /> : null}
      <span className='min-w-0 flex-1 truncate'>{title}</span>
      <ChevronRight className='ms-auto size-4 shrink-0 transition-transform duration-200 group-data-[panel-open]/collapsible-trigger:rotate-90 group-data-[popup-open]/dropdown-trigger:rotate-90' />
    </>
  )

  // Mobile sidebar is always expanded inside a Sheet.
  const isCollapsed = state === 'collapsed' && !isMobile

  if (isCollapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            className='group/dropdown-trigger'
            render={
              <SidebarMenuButton
                title={description ?? title}
                tooltip={description ?? title}
                isActive={isActive}
              />
            }
          >
            {trigger}
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side='right'
            align='start'
            sideOffset={4}
            className='max-h-96 overflow-y-auto'
          >
            <ScrollArea className='h-full'>{collapsedContent}</ScrollArea>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    )
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={handleOpenChange}
      className='group/collapsible'
      render={<SidebarMenuItem />}
    >
      <CollapsibleTrigger
        className='group/collapsible-trigger'
        aria-expanded={open}
        render={
          <SidebarMenuButton
            title={description ?? title}
            tooltip={description ?? title}
            isActive={isActive}
          />
        }
      >
        {trigger}
      </CollapsibleTrigger>
      {action}
      <CollapsibleContent className='CollapsibleContent'>
        <SidebarMenuSub>{expandedContent}</SidebarMenuSub>
      </CollapsibleContent>
    </Collapsible>
  )
}
