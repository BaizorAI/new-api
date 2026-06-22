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
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import { useAuthStore } from '@/stores/auth-store'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { Main } from '@/components/layout'
import { Playground } from '@/features/playground'
import { DEFAULT_CONFIG } from '@/features/playground/constants'
import {
  createDefaultConversation,
  deriveConversationTitle,
  getHermesBaseScope,
  HERMES_SESSIONS_CHANGED_EVENT,
  loadActiveConversationId,
  loadHermesConversations,
  saveHermesConversations,
  SESSION_TOUCH_INTERVAL_MS,
  type HermesConversation,
} from '@/features/hermes-playground/sessions'
import type { Message, ModelOption } from '@/features/playground/types'

export const Route = createFileRoute('/_authenticated/hermes-playground/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'hermes_playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: HermesPlaygroundPage,
})

function HermesPlaygroundPage() {
  const { t } = useTranslation()
  const userId = useAuthStore((s) => s.auth.user?.id)
  const baseScope = getHermesBaseScope(userId)
  const [sessions, setSessions] = useState<HermesConversation[]>(() =>
    loadHermesConversations(baseScope)
  )
  const [activeSessionId, setActiveSessionId] = useState(() =>
    loadActiveConversationId(baseScope, sessions)
  )

  const reloadSessions = useCallback(() => {
    const nextSessions = loadHermesConversations(baseScope)
    setSessions(nextSessions)
    setActiveSessionId(loadActiveConversationId(baseScope, nextSessions))
  }, [baseScope])

  useEffect(() => {
    window.addEventListener(HERMES_SESSIONS_CHANGED_EVENT, reloadSessions)
    window.addEventListener('storage', reloadSessions)
    return () => {
      window.removeEventListener(HERMES_SESSIONS_CHANGED_EVENT, reloadSessions)
      window.removeEventListener('storage', reloadSessions)
    }
  }, [reloadSessions])

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ??
      sessions[0] ??
      createDefaultConversation(baseScope),
    [activeSessionId, baseScope, sessions]
  )

  const defaultConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      model: 'hermes-agent',
      systemPrompt: 'Use Chinese by default unless the user asks otherwise.',
    }),
    []
  )

  const modelFilter = useCallback((model: ModelOption) => {
    return /hermes/i.test(`${model.label} ${model.value}`)
  }, [])

  const requestHeaders = useMemo(
    () => ({
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': activeSession.hermesSessionId,
    }),
    [activeSession.hermesSessionId]
  )

  const updateActiveSessionFromMessages = useCallback(
    (messages: Message[]) => {
      setSessions((prev) => {
        const now = Date.now()
        let changed = false
        const next = prev.map((session) => {
          if (session.id !== activeSession.id) return session

          const title = deriveConversationTitle(messages) ?? session.title
          if (
            session.title === title &&
            now - session.updatedAt < SESSION_TOUCH_INTERVAL_MS
          ) {
            return session
          }

          changed = true
          return {
            ...session,
            title,
            updatedAt: now,
          }
        })

        if (!changed) return prev
        saveHermesConversations(baseScope, next)
        return next
      })
    },
    [activeSession.id, baseScope]
  )

  return (
    <Main className='p-0'>
      <Playground
        key={activeSession.storageScope}
        defaultConfig={defaultConfig}
        enableSlashCommands
        emptyModelsMessage={t('No Hermes models available')}
        modelFilter={modelFilter}
        onMessagesChange={updateActiveSessionFromMessages}
        queryKeyPrefix='hermes-playground'
        requestHeaders={requestHeaders}
        storageScope={activeSession.storageScope}
      />
    </Main>
  )
}
