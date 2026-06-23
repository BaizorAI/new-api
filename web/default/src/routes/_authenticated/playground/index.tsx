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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { Main } from '@/components/layout'
import { Playground } from '@/features/playground'
import { DEFAULT_CONFIG } from '@/features/playground/constants'
import {
  createDefaultConversation,
  createPlaygroundConversation,
  deriveConversationTitle,
  getPlaygroundBaseScope,
  PLAYGROUND_SESSIONS_CHANGED_EVENT,
  loadActiveConversationId,
  loadPlaygroundConversations,
  saveActiveConversationId,
  savePlaygroundConversations,
  SESSION_TOUCH_INTERVAL_MS,
  type PlaygroundConversation,
} from '@/features/playground/sessions'
import type { Message } from '@/features/playground/types'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/playground/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: PlaygroundPage,
})

function PlaygroundPage() {
  const userId = useAuthStore((s) => s.auth.user?.id)
  const baseScope = getPlaygroundBaseScope(userId)
  const [conversations, setConversations] = useState<PlaygroundConversation[]>(
    () => loadPlaygroundConversations(baseScope)
  )
  const [activeConversationId, setActiveConversationId] = useState(() =>
    loadActiveConversationId(baseScope, conversations)
  )

  const reloadConversations = useCallback(() => {
    const next = loadPlaygroundConversations(baseScope)
    setConversations(next)
    setActiveConversationId(loadActiveConversationId(baseScope, next))
  }, [baseScope])

  useEffect(() => {
    window.addEventListener(
      PLAYGROUND_SESSIONS_CHANGED_EVENT,
      reloadConversations
    )
    window.addEventListener('storage', reloadConversations)
    return () => {
      window.removeEventListener(
        PLAYGROUND_SESSIONS_CHANGED_EVENT,
        reloadConversations
      )
      window.removeEventListener('storage', reloadConversations)
    }
  }, [reloadConversations])

  const activeConversation = useMemo(
    () =>
      conversations.find((c) => c.id === activeConversationId) ??
      conversations[0] ??
      createDefaultConversation(baseScope),
    [activeConversationId, baseScope, conversations]
  )

  const defaultConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      model: 'deepseek-v4-pro',
    }),
    []
  )

  const updateActiveConversationFromMessages = useCallback(
    (messages: Message[]) => {
      setConversations((prev) => {
        const now = Date.now()
        let changed = false
        const next = prev.map((c) => {
          if (c.id !== activeConversation.id) return c

          const title = deriveConversationTitle(messages) ?? c.title
          if (
            c.title === title &&
            now - c.updatedAt < SESSION_TOUCH_INTERVAL_MS
          ) {
            return c
          }

          changed = true
          return {
            ...c,
            title,
            updatedAt: now,
          }
        })

        if (!changed) return prev
        savePlaygroundConversations(baseScope, next)
        return next
      })
    },
    [activeConversation.id, baseScope]
  )

  const createSession = useCallback(() => {
    const next = createPlaygroundConversation(baseScope)
    const nextConversations = [next, ...conversations]
    savePlaygroundConversations(baseScope, nextConversations)
    saveActiveConversationId(baseScope, next.id)
    setConversations(nextConversations)
    setActiveConversationId(next.id)
  }, [baseScope, conversations])

  const exportActiveSession = useCallback(
    (messages: Message[]) => {
      downloadJson(
        {
          exportedAt: new Date().toISOString(),
          conversation: activeConversation,
          messages,
        },
        `${activeConversation.title || activeConversation.id}.json`
      )
    },
    [activeConversation]
  )

  return (
    <Main className='p-0'>
      <Playground
        key={activeConversation.storageScope}
        defaultConfig={defaultConfig}
        modelCapability='chat'
        onMessagesChange={updateActiveConversationFromMessages}
        onNewSession={createSession}
        onSaveSession={exportActiveSession}
        storageScope={activeConversation.storageScope}
      />
    </Main>
  )
}

function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeDownloadFilename(filename)
  anchor.click()
  URL.revokeObjectURL(url)
}

function sanitizeDownloadFilename(filename: string): string {
  const filenameWithoutPathChars = filename
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, '_')
  const safeName = [...filenameWithoutPathChars]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
  return safeName || 'playground-conversation.json'
}
