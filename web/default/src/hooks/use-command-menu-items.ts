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
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { useChatPresets } from '@/features/chat/hooks/use-chat-presets'
import {
  getHermesBaseScope,
  loadHermesConversations,
  sortSessions,
} from '@/features/hermes-playground/sessions'
import {
  getPlaygroundBaseScope,
  loadPlaygroundConversations,
  sortConversations,
} from '@/features/playground/sessions'
import { listTeams } from '@/features/teams/api'
import { useAuthStore } from '@/stores/auth-store'

import { useSidebarConfig } from './use-sidebar-config'
import { useSidebarData } from './use-sidebar-data'

export type CommandMenuItem = {
  id: string
  label: string
  value: string
  onSelect: () => void
}

export type CommandMenuGroup = {
  heading: string
  items: CommandMenuItem[]
}

const MAX_RECENT_SESSIONS = 10

/**
 * Build searchable Command Palette groups from the current root sidebar view.
 *
 * - Static links and collapsible sub-items are always indexed.
 * - Dynamic sections (Hermes/Playground sessions, Chat Presets, Teams) are
 *   indexed when their sidebar item is visible.
 */
export function useCommandMenuItems(open: boolean): CommandMenuGroup[] {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const rawGroups = useSidebarData().navGroups
  const navGroups = useSidebarConfig(rawGroups)
  const userId = useAuthStore((s) => s.auth.user?.id)
  const { chatPresets } = useChatPresets()
  const { data: teamsResponse } = useQuery({
    queryKey: ['sidebar', 'team-workspaces'],
    queryFn: listTeams,
    enabled: open,
  })

  return useMemo(() => {
    const groups: CommandMenuGroup[] = []

    for (const group of navGroups) {
      const staticItems: CommandMenuItem[] = []
      const dynamicItems: CommandMenuItem[] = []

      for (const item of group.items) {
        if ('url' in item && item.url) {
          staticItems.push({
            id: `static-${group.title}-${item.title}`,
            label: item.title,
            value: item.title,
            onSelect: () => navigate({ to: item.url }),
          })
          continue
        }

        if ('items' in item && item.items) {
          for (const sub of item.items) {
            staticItems.push({
              id: `static-${group.title}-${item.title}-${sub.title}`,
              label: `${item.title} › ${sub.title}`,
              value: `${item.title} ${sub.title}`,
              onSelect: () => navigate({ to: sub.url }),
            })
          }
          continue
        }

        // Dynamic sections
        if (item.type === 'hermes-sessions') {
          dynamicItems.push({
            id: 'hermes-new',
            label: t('New Hermes Session'),
            value: t('New Hermes Session'),
            onSelect: () => navigate({ to: '/hermes-playground' }),
          })

          const scope = getHermesBaseScope(userId)
          const sessions = sortSessions(loadHermesConversations(scope)).slice(
            0,
            MAX_RECENT_SESSIONS
          )
          for (const session of sessions) {
            dynamicItems.push({
              id: `hermes-${session.id}`,
              label: session.title || t('New session'),
              value: `Hermes ${session.title || session.id}`,
              onSelect: () => navigate({ to: '/hermes-playground' }),
            })
          }
          continue
        }

        if (item.type === 'playground-sessions') {
          dynamicItems.push({
            id: 'playground-new',
            label: t('New Playground Session'),
            value: t('New Playground Session'),
            onSelect: () => navigate({ to: '/playground' }),
          })

          const scope = getPlaygroundBaseScope(userId)
          const conversations = sortConversations(
            loadPlaygroundConversations(scope)
          ).slice(0, MAX_RECENT_SESSIONS)
          for (const conversation of conversations) {
            dynamicItems.push({
              id: `playground-${conversation.id}`,
              label: conversation.title || t('New session'),
              value: `Playground ${conversation.title || conversation.id}`,
              onSelect: () => navigate({ to: '/playground' }),
            })
          }
          continue
        }

        if (item.type === 'chat-presets') {
          for (const preset of chatPresets) {
            if (preset.type === 'fluent') continue
            dynamicItems.push({
              id: `chat-preset-${preset.id}`,
              label: preset.name,
              value: `Chat ${preset.name}`,
              onSelect: () => {
                if (preset.type === 'web') {
                  navigate({
                    to: '/chat/$chatId',
                    params: { chatId: preset.id },
                  })
                } else {
                  navigate({
                    to: '/chat/$chatId',
                    params: { chatId: preset.id },
                  })
                }
              },
            })
          }
          continue
        }

        if (item.type === 'team-workspaces') {
          dynamicItems.push({
            id: 'team-workspace',
            label: t('Workspaces'),
            value: t('Workspaces'),
            onSelect: () => navigate({ to: '/team-workspace' }),
          })

          const teams = teamsResponse?.success ? (teamsResponse.data ?? []) : []
          for (const team of teams) {
            dynamicItems.push({
              id: `team-${team.id}`,
              label: team.name,
              value: `Team ${team.name}`,
              onSelect: () =>
                navigate({
                  to: '/team-workspace',
                  search: { team_id: team.id },
                }),
            })
          }
          continue
        }
      }

      if (staticItems.length > 0) {
        groups.push({ heading: group.title, items: staticItems })
      }
      if (dynamicItems.length > 0) {
        groups.push({
          heading: t('Recent'),
          items: dynamicItems,
        })
      }
    }

    return groups
  }, [chatPresets, navGroups, navigate, t, teamsResponse, userId])
}
