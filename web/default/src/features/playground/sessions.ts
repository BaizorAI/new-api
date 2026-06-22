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
import {
  createPlaygroundStorageKeys,
  loadMessages,
} from '@/features/playground/lib'
import type { Message } from '@/features/playground/types'

export interface PlaygroundConversation {
  id: string
  title: string
  storageScope: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
  archived?: boolean
}

export const PLAYGROUND_SESSIONS_CHANGED_EVENT = 'playground-sessions-changed'
export const SESSION_TOUCH_INTERVAL_MS = 5000

export function getPlaygroundBaseScope(userId?: number | string | null): string {
  return `pg_user_${userId ?? 'anonymous'}`
}

export function safeStorageScope(scope: string): string {
  return scope.trim().replaceAll(/[^a-zA-Z0-9_-]/g, '_')
}

export function conversationsStorageKey(baseScope: string): string {
  return `playground_${safeStorageScope(baseScope)}_conversations_v1`
}

export function activeConversationStorageKey(baseScope: string): string {
  return `playground_${safeStorageScope(baseScope)}_active_conversation_v1`
}

export function createPlaygroundConversation(
  baseScope: string
): PlaygroundConversation {
  const id = createId()
  const storageScope = `${baseScope}_conv_${id}`
  const now = Date.now()
  return {
    id,
    title: '',
    storageScope,
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultConversation(
  baseScope: string
): PlaygroundConversation {
  const storageKeys = createPlaygroundStorageKeys(baseScope)
  const messages = loadMessages(storageKeys) ?? []
  const now = Date.now()
  return {
    id: 'default',
    title: deriveConversationTitle(messages) ?? '',
    storageScope: baseScope,
    createdAt: now,
    updatedAt: now,
  }
}

export function loadPlaygroundConversations(
  baseScope: string
): PlaygroundConversation[] {
  try {
    const saved = localStorage.getItem(conversationsStorageKey(baseScope))
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        const conversations = parsed.filter(isPlaygroundConversation)
        if (conversations.length > 0) return conversations
      }
    }
  } catch {
    // Ignore corrupt local session metadata and rebuild the default entry.
  }

  const initial = [createDefaultConversation(baseScope)]
  savePlaygroundConversations(baseScope, initial)
  return initial
}

export function savePlaygroundConversations(
  baseScope: string,
  conversations: PlaygroundConversation[]
): void {
  try {
    localStorage.setItem(
      conversationsStorageKey(baseScope),
      JSON.stringify(conversations)
    )
    notifyPlaygroundSessionsChanged()
  } catch {
    // Local session metadata is non-critical; chat messages are saved separately.
  }
}

export function loadActiveConversationId(
  baseScope: string,
  conversations: PlaygroundConversation[]
): string {
  try {
    const saved = localStorage.getItem(activeConversationStorageKey(baseScope))
    if (saved && conversations.some((c) => c.id === saved)) {
      return saved
    }
  } catch {
    // Fall through to the newest available conversation.
  }
  return conversations[0].id
}

export function saveActiveConversationId(
  baseScope: string,
  conversationId: string
): void {
  try {
    localStorage.setItem(activeConversationStorageKey(baseScope), conversationId)
    notifyPlaygroundSessionsChanged()
  } catch {
    // Active conversation can fall back to the first conversation on next load.
  }
}

export function sortConversations(
  conversations: PlaygroundConversation[]
): PlaygroundConversation[] {
  return [...conversations].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function clearConversationStorage(
  conversation: PlaygroundConversation
): void {
  try {
    const storageKeys = createPlaygroundStorageKeys(conversation.storageScope)
    localStorage.removeItem(storageKeys.CONFIG)
    localStorage.removeItem(storageKeys.MESSAGES)
    localStorage.removeItem(storageKeys.PARAMETER_ENABLED)
  } catch {
    // Storage cleanup is best effort. Metadata deletion still proceeds.
  }
}

export function deriveConversationTitle(messages: Message[]): string | null {
  const firstUserMessage = messages.find((message) => message.from === 'user')
  const content = firstUserMessage?.versions[0]?.content
    ?.replaceAll(/\s+/g, ' ')
    .trim()
  if (!content) return null
  return content.length > 36 ? `${content.slice(0, 36)}...` : content
}

export function formatSessionTime(timestamp: number, justNow: string): string {
  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return justNow

  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(timestamp))
}

export function notifyPlaygroundSessionsChanged(): void {
  queueMicrotask(() => {
    window.dispatchEvent(new Event(PLAYGROUND_SESSIONS_CHANGED_EVENT))
  })
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isPlaygroundConversation(
  value: unknown
): value is PlaygroundConversation {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<PlaygroundConversation>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.storageScope === 'string' &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number'
  )
}
