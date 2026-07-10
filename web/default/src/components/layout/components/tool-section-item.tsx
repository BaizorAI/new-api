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
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useLocation } from '@tanstack/react-router'
import {
  CheckCircle2Icon,
  ChevronRightIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { listHermesToolsets } from '@/features/hermes-playground/api'
import type { HermesToolset } from '@/features/hermes-playground/api'
import type { NavHermesToolSection } from '../types'
import { checkIsActive } from '../lib/url-utils'
import { SIDEBAR_NODE_COLORS } from '../constants'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'
import { cn } from '@/lib/utils'

function ToolsetSubItem({
  toolset,
  href,
  onClose,
  index,
}: {
  toolset: HermesToolset
  href: string
  onClose: () => void
  index: number
}) {
  const { t } = useTranslation()

  const toolsetUrl =
    `/toolset-detail?toolset=${encodeURIComponent(toolset.name)}` as const
  const isActive = checkIsActive(href, { url: toolsetUrl })
  const colorClass = SIDEBAR_NODE_COLORS[index % SIDEBAR_NODE_COLORS.length]

  return (
    <SidebarCollapsibleShell
      action={
        <SidebarMenuAction
          showOnHover
          render={
            <Link
              to={toolsetUrl}
              onClick={onClose}
              aria-current={isActive ? 'page' : undefined}
            />
          }
        >
          <SlidersHorizontalIcon className='size-3.5' />
        </SidebarMenuAction>
      }
      collapsedContent={
        <>
          <DropdownMenuLabel>{toolset.label || toolset.name}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {toolset.tools.map((toolName) => {
            const toolUrl =
              `/toolset-detail?toolset=${encodeURIComponent(toolset.name)}&tool=${encodeURIComponent(toolName)}` as const
            const toolActive = checkIsActive(href, { url: toolUrl })
            return (
              <DropdownMenuItem
                key={toolName}
                render={
                  <Link
                    className={toolActive ? 'bg-secondary' : ''}
                    onClick={onClose}
                    to={toolUrl}
                  />
                }
              >
                <span className='max-w-52 text-wrap'>{toolName}</span>
              </DropdownMenuItem>
            )
          })}
        </>
      }
      defaultOpen={isActive}
      expandedContent={
        <div className='ml-3 border-l'>
          {toolset.tools.length === 0 ? (
            <div className='text-muted-foreground px-3 py-1.5 text-xs'>
              {t('No tools listed')}
            </div>
          ) : (
            <div className='space-y-0.5 py-0.5 pl-1'>
              {toolset.tools.map((toolName, toolIdx) => {
                const toolUrl =
                  `/toolset-detail?toolset=${encodeURIComponent(toolset.name)}&tool=${encodeURIComponent(toolName)}` as const
                const toolActive = checkIsActive(href, { url: toolUrl })
                return (
                  <SidebarMenuSubItem key={toolName}>
                    <SidebarMenuSubButton
                      isActive={toolActive}
                      render={
                        <Link
                          to={toolUrl}
                          onClick={onClose}
                          aria-current={toolActive ? 'page' : undefined}
                        />
                      }
                      title={toolName}
                    >
                      <WrenchIcon
                        className={cn(
                          'size-3 shrink-0',
                          SIDEBAR_NODE_COLORS[
                            toolIdx % SIDEBAR_NODE_COLORS.length
                          ]
                        )}
                        aria-hidden='true'
                      />
                      <span className='min-w-0 flex-1 truncate text-xs'>
                        {toolName}
                      </span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                )
              })}
            </div>
          )}
        </div>
      }
      icon={WrenchIcon}
      id={`toolset-${toolset.name}`}
      isActive={isActive}
      title={
        <div className='flex min-w-0 flex-1 items-center gap-1.5'>
          <span className='min-w-0 flex-1 truncate'>
            {toolset.label || toolset.name}
          </span>
          <StatusDot active={toolset.enabled} activeText={t('Enabled')} />
          <StatusDot active={toolset.configured} activeText={t('Configured')} />
        </div>
      }
    >
      {null}
    </SidebarCollapsibleShell>
  )
}

function StatusDot({
  active,
  activeText,
}: {
  active: boolean
  activeText: string
}) {
  const Icon = active ? CheckCircle2Icon : XCircleIcon

  return (
    <Badge
      className='shrink-0 gap-0.5 px-1 py-0 text-[10px] leading-none'
      title={active ? activeText : ''}
      variant={active ? 'secondary' : 'outline'}
    >
      <Icon className='size-2.5' />
    </Badge>
  )
}

/**
 * Dynamic toolsets sidebar item.
 *
 * Fetches the list of Hermes toolsets and renders each as a collapsible
 * group with its individual tools nested underneath. Each tool links to
 * the /toolset-detail route for inspection.
 */
export function ToolSectionItem({ item }: { item: NavHermesToolSection }) {
  const href = useLocation({ select: (l) => l.href })
  const { setOpenMobile } = useSidebar()
  const { t } = useTranslation()

  const { data: toolsets = [] } = useQuery({
    queryKey: ['hermes-tool-section-sidebar'],
    queryFn: listHermesToolsets,
    staleTime: 5 * 60 * 1000,
  })

  const hasAnyActive = useMemo(
    () =>
      toolsets.some((toolset) =>
        checkIsActive(href, {
          url: `/toolset-detail?toolset=${encodeURIComponent(toolset.name)}`,
        })
      ),
    [href, toolsets]
  )

  if (toolsets.length === 0) {
    return (
      <SidebarCollapsibleShell
        collapsedContent={
          <>
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled>
              {t('No toolsets available')}
            </DropdownMenuItem>
          </>
        }
        defaultOpen={false}
        description={item.description}
        expandedContent={
          <div className='text-muted-foreground px-2 py-2 text-xs'>
            {t('No toolsets available')}
          </div>
        }
        icon={item.icon}
        id='tool-section'
        isActive={false}
        title={item.title}
      >
        {null}
      </SidebarCollapsibleShell>
    )
  }

  return (
    <SidebarCollapsibleShell
      collapsedContent={
        <>
          <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {toolsets.map((toolset) => {
            const toolsetUrl =
              `/toolset-detail?toolset=${encodeURIComponent(toolset.name)}` as const
            const subActive = checkIsActive(href, { url: toolsetUrl })
            return (
              <DropdownMenuItem
                key={toolset.name}
                render={
                  <Link
                    className={subActive ? 'bg-secondary' : ''}
                    onClick={() => setOpenMobile(false)}
                    to={toolsetUrl}
                  />
                }
              >
                <div className='flex flex-col gap-0.5'>
                  <span className='max-w-52 text-wrap'>
                    {toolset.label || toolset.name}
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {t('{{count}} tools', { count: toolset.tools.length })}
                  </span>
                </div>
              </DropdownMenuItem>
            )
          })}
        </>
      }
      defaultOpen
      description={item.description}
      expandedContent={
        <>
          {toolsets.map((toolset, idx) => (
            <div key={toolset.name} className='space-y-0.5'>
              <ToolsetSubItem
                href={href}
                index={idx}
                onClose={() => setOpenMobile(false)}
                toolset={toolset}
              />
            </div>
          ))}
        </>
      }
      icon={item.icon}
      id='tool-section'
      isActive={hasAnyActive}
      title={item.title}
    >
      {null}
    </SidebarCollapsibleShell>
  )
}
