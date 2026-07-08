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

import { IconHermes } from '@/assets/brand-icons'
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
  clearConversationStorage,
  createHermesConversation,
  HERMES_SESSIONS_CHANGED_EVENT,
  getHermesBaseScope,
  loadActiveConversationId,
  loadHermesConversations,
  saveActiveConversationId,
  saveHermesConversations,
  sortSessions,
  notifyHermesSessionDeleted,
  type HermesConversation,
} from '@/features/hermes-playground/sessions'
import {
  createPlaygroundStorageKeys,
  loadMessages,
} from '@/features/playground/lib'
import { deleteUserHermesConversation } from '@/features/hermes-playground/api'

import {
  useSessionList,
  type SessionListAdapter,
} from '../lib/session-list-core'
import { normalizeHref } from '../lib/url-utils'
import type { NavHermesSessions } from '../types'
import {
  SessionListGroupsCollapsed,
  SessionListGroupsExpanded,
  SessionRenameDialog,
} from './session-list'
import { SidebarCollapsibleShell } from './sidebar-collapsible-shell'

const HERMES_SESSION_LIST_ADAPTER: SessionListAdapter<HermesConversation> = {
  baseUrl: '/hermes-playground',
  getBaseScope: getHermesBaseScope,
  create: createHermesConversation,
  load: loadHermesConversations,
  save: saveHermesConversations,
  loadActiveId: loadActiveConversationId,
  saveActiveId: saveActiveConversationId,
  sort: sortSessions,
  clearStorage: clearConversationStorage,
  changedEvent: HERMES_SESSIONS_CHANGED_EVENT,
  newSessionLabelKey: 'New session',
  renameDialogTitleKey: 'Rename session',
  inputLabelKey: 'Session name',
  getCopyId: (session) => session.hermesSessionId,
  exportFilenameFallback: 'hermes-session.json',
  buildExportPayload: (session) => {
    const storageKeys = createPlaygroundStorageKeys(session.storageScope)
    const messages = loadMessages(storageKeys) ?? []
    return {
      exportedAt: new Date().toISOString(),
      session,
      messages,
    }
  },
  serverDelete: (sessionId) => {
    notifyHermesSessionDeleted(sessionId)
    return deleteUserHermesConversation(sessionId).then(() => undefined)
  },
}

export function HermesSessionsItem({ item }: { item: NavHermesSessions }) {
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
  } = useSessionList(HERMES_SESSION_LIST_ADAPTER)

  const isHermesActive = normalizeHref(href).startsWith('/hermes-playground')

  const handleCreateSession = () => {
    createSession()
    setOpenMobile(false)
  }

  const expandedTopActions = (
    <SidebarMenuSubItem>
      <SidebarMenuSubButton onClick={handleCreateSession}>
        <Plus className='size-3.5' aria-hidden='true' />
        <span>{t('New session')}</span>
      </SidebarMenuSubButton>
    </SidebarMenuSubItem>
  )

  const collapsedTopActions = (
    <>
      <DropdownMenuItem onClick={handleCreateSession}>
        <Plus className='size-4' aria-hidden='true' />
        {t('New session')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
    </>
  )

  return (
    <>
      <SidebarCollapsibleShell
        id={`hermes-sessions-${item.title}`}
        title={item.title}
        icon={item.icon ?? IconHermes}
        description={item.description}
        isActive={isHermesActive}
        defaultOpen={isHermesActive}
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
            {expandedTopActions}
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
            {collapsedTopActions}
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
        titleKey={HERMES_SESSION_LIST_ADAPTER.renameDialogTitleKey}
        inputLabelKey={HERMES_SESSION_LIST_ADAPTER.inputLabelKey}
      />
    </>
  )
}
