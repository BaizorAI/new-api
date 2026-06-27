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
import { Link, useLocation } from '@tanstack/react-router'
import { ExternalLink, Loader2 } from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DropdownMenuItem } from '@/components/ui/dropdown-menu'
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { fetchActiveChatKey } from '@/features/chat/hooks/use-active-chat-key'
import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import {
  chatLinkRequiresApiKey,
  resolveChatUrl,
  type ChatPreset,
} from '@/features/chat/lib/chat-links'

import { normalizeHref } from '../lib/url-utils'
import type { NavChatPresets } from '../types'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

export function ChatPresetsItem({ item }: { item: NavChatPresets }) {
  const { t } = useTranslation()
  const { chatPresets, serverAddress } = useChatPresets()
  const { setOpenMobile } = useSidebar()
  const href = useLocation({ select: (location) => location.href })
  const [loadingPresetId, setLoadingPresetId] = useState<string | null>(null)
  const loadingPresetIdRef = useRef<string | null>(null)

  const visiblePresets = useMemo(
    () => chatPresets.filter((preset) => preset.type !== 'fluent'),
    [chatPresets]
  )

  const handleOpenExternal = useCallback(
    async (preset: ChatPreset) => {
      if (preset.type === 'web') return

      const needsKey = chatLinkRequiresApiKey(preset.url)
      let activeKey: string | undefined

      if (needsKey && loadingPresetIdRef.current) {
        toast.info(t('Preparing your chat link, please try again in a moment.'))
        return
      }

      if (needsKey) {
        loadingPresetIdRef.current = preset.id
        setLoadingPresetId(preset.id)
        try {
          activeKey = await fetchActiveChatKey()
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : t(
                  'Unable to prepare chat link. Please ensure you have an enabled API key.'
                )
          toast.error(message)
          return
        } finally {
          loadingPresetIdRef.current = null
          setLoadingPresetId(null)
        }
      }

      const url = resolveChatUrl({
        template: preset.url,
        apiKey: needsKey ? activeKey : undefined,
        serverAddress,
      })

      if (!url) {
        toast.error(t('Invalid chat link. Please contact the administrator.'))
        return
      }

      if (typeof window === 'undefined') return

      window.open(url, '_blank', 'noopener')
      setOpenMobile(false)
    },
    [serverAddress, setOpenMobile, t]
  )

  const normalizedHref = normalizeHref(href)
  const isChatActive = normalizedHref.startsWith('/chat')

  if (visiblePresets.length === 0) {
    return null
  }

  return (
    <SidebarCollapsibleShell
      id={`chat-presets-${item.title}`}
      title={item.title}
      icon={item.icon}
      description={item.description}
      isActive={isChatActive}
      defaultOpen={isChatActive}
      expandedContent={
        <>
          {visiblePresets.map((preset) => (
            <ChatMenuItem
              key={preset.id}
              preset={preset}
              active={normalizedHref === `/chat/${preset.id}`}
              loading={loadingPresetId === preset.id}
              onOpen={handleOpenExternal}
              onNavigate={() => setOpenMobile(false)}
            />
          ))}
        </>
      }
      collapsedContent={
        <>
          {visiblePresets.map((preset) => (
            <DropdownPresetItem
              key={preset.id}
              preset={preset}
              loading={loadingPresetId === preset.id}
              onOpen={handleOpenExternal}
              onNavigate={() => setOpenMobile(false)}
            />
          ))}
        </>
      }
    />
  )
}

function ChatMenuItem({
  preset,
  active,
  loading,
  onOpen,
  onNavigate,
}: {
  preset: ChatPreset
  active: boolean
  loading: boolean
  onOpen: (preset: ChatPreset) => void | Promise<void>
  onNavigate: () => void
}) {
  if (preset.type === 'web') {
    return (
      <SidebarMenuSubItem>
        <SidebarMenuSubButton
          isActive={active}
          render={
            <Link
              to='/chat/$chatId'
              params={{ chatId: preset.id }}
              onClick={onNavigate}
            />
          }
        >
          <span className='min-w-0 flex-1 truncate whitespace-nowrap'>
            {preset.name}
          </span>
        </SidebarMenuSubButton>
      </SidebarMenuSubItem>
    )
  }

  return (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton
        onClick={() => {
          if (!loading) void onOpen(preset)
        }}
        aria-disabled={loading ? 'true' : undefined}
        isActive={false}
        className='justify-between'
      >
        <span className='min-w-0 flex-1 truncate whitespace-nowrap'>
          {preset.name}
        </span>
        {loading ? (
          <Loader2
            className='h-4 w-4 shrink-0 animate-spin'
            aria-hidden='true'
          />
        ) : (
          <ExternalLink className='h-4 w-4 shrink-0' aria-hidden='true' />
        )}
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )
}

function DropdownPresetItem({
  preset,
  loading,
  onOpen,
  onNavigate,
}: {
  preset: ChatPreset
  loading: boolean
  onOpen: (preset: ChatPreset) => void | Promise<void>
  onNavigate: () => void
}) {
  if (preset.type === 'web') {
    return (
      <DropdownMenuItem
        render={
          <Link
            to='/chat/$chatId'
            params={{ chatId: preset.id }}
            onClick={onNavigate}
          />
        }
      >
        {preset.name}
      </DropdownMenuItem>
    )
  }

  return (
    <DropdownMenuItem
      disabled={loading}
      onClick={() => {
        if (!loading) void onOpen(preset)
      }}
    >
      {preset.name}
      {loading ? (
        <Loader2
          className='ml-auto h-4 w-4 animate-spin opacity-70'
          aria-hidden='true'
        />
      ) : (
        <ExternalLink
          className='ml-auto h-4 w-4 opacity-70'
          aria-hidden='true'
        />
      )}
    </DropdownMenuItem>
  )
}
