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
import { useLocation } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import {
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  createPlaygroundStorageKeys,
  loadMessages,
} from '@/features/playground/lib'
import {
  clearConversationStorage,
  createPlaygroundConversation,
  getPlaygroundBaseScope,
  loadActiveConversationId,
  loadPlaygroundConversations,
  PLAYGROUND_SESSIONS_CHANGED_EVENT,
  saveActiveConversationId,
  savePlaygroundConversations,
  sortConversations,
  type PlaygroundConversation,
} from '@/features/playground/sessions'

import {
  useSessionList,
  type SessionListAdapter,
} from '../lib/session-list-core'
import { normalizeHref } from '../lib/url-utils'
import type { NavPlaygroundSessions } from '../types'
import {
  SessionListGroupsCollapsed,
  SessionListGroupsExpanded,
  SessionRenameDialog,
} from './session-list'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

const PLAYGROUND_SESSION_LIST_ADAPTER: SessionListAdapter<PlaygroundConversation> =
  {
    baseUrl: '/playground',
    getBaseScope: getPlaygroundBaseScope,
    create: createPlaygroundConversation,
    load: loadPlaygroundConversations,
    save: savePlaygroundConversations,
    loadActiveId: loadActiveConversationId,
    saveActiveId: saveActiveConversationId,
    sort: sortConversations,
    clearStorage: clearConversationStorage,
    changedEvent: PLAYGROUND_SESSIONS_CHANGED_EVENT,
    newSessionLabelKey: 'New session',
    renameDialogTitleKey: 'Rename session',
    inputLabelKey: 'Session name',
    getCopyId: (conversation) => conversation.id,
    exportFilenameFallback: 'playground-conversation.json',
    buildExportPayload: (conversation) => {
      const storageKeys = createPlaygroundStorageKeys(conversation.storageScope)
      const messages = loadMessages(storageKeys) ?? []
      return {
        exportedAt: new Date().toISOString(),
        conversation,
        messages,
      }
    },
  }

export function PlaygroundSessionsItem({
  item,
}: {
  item: NavPlaygroundSessions
}) {
  const { t } = useTranslation()
  const href = useLocation({ select: (location) => location.href })
  const { setOpenMobile } = useSidebar()
  const {
    baseUrl,
    sessionGroups,
    activeSessionId,
    createSession,
    sessionActions,
    renamingSession,
    renameValue,
    setRenamingSession,
    setRenameValue,
    submitRename,
  } = useSessionList(PLAYGROUND_SESSION_LIST_ADAPTER)

  const isPlaygroundActive = normalizeHref(href).startsWith('/playground')

  const handleCreateSession = () => {
    createSession()
    setOpenMobile(false)
  }

  const newSessionButton = (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton onClick={handleCreateSession}>
        <Plus className='size-3.5' aria-hidden='true' />
        <span>{t('New session')}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )

  return (
    <>
      <SidebarCollapsibleShell
        id={`playground-sessions-${item.title}`}
        title={item.title}
        icon={item.icon ?? Plus}
        description={item.description}
        isActive={isPlaygroundActive}
        defaultOpen={isPlaygroundActive}
        action={
          <SidebarMenuAction
            showOnHover
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleCreateSession()
            }}
            aria-label={t('New session')}
            title={t('New session')}
          >
            <Plus className='size-3.5' aria-hidden='true' />
          </SidebarMenuAction>
        }
        expandedContent={
          <>
            {newSessionButton}
            <SessionListGroupsExpanded
              baseUrl={baseUrl}
              groups={sessionGroups}
              activeSessionId={activeSessionId}
              actions={sessionActions}
            />
          </>
        }
        collapsedContent={
          <>
            <DropdownMenuItem onClick={handleCreateSession}>
              <Plus className='size-4' aria-hidden='true' />
              {t('New session')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <SessionListGroupsCollapsed
              baseUrl={baseUrl}
              groups={sessionGroups}
              activeSessionId={activeSessionId}
              onSelect={(sessionId) => {
                sessionActions.select(sessionId)
                setOpenMobile(false)
              }}
            />
          </>
        }
      />
      <SessionRenameDialog
        open={Boolean(renamingSession)}
        session={renamingSession}
        value={renameValue}
        onOpenChange={(open) => {
          if (!open) setRenamingSession(null)
        }}
        onSubmit={submitRename}
        onValueChange={setRenameValue}
        titleKey={PLAYGROUND_SESSION_LIST_ADAPTER.renameDialogTitleKey}
        inputLabelKey={PLAYGROUND_SESSION_LIST_ADAPTER.inputLabelKey}
      />
    </>
  )
}
