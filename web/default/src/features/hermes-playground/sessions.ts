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
  getOrCreatePlaygroundSessionId,
  loadMessages,
} from '@/features/playground/lib'
import type { Message } from '@/features/playground/types'

export interface HermesConversation {
  id: string
  title: string
  titleEdited?: boolean
  storageScope: string
  hermesSessionId: string
  createdAt: number
  updatedAt: number
  pinned?: boolean
  archived?: boolean
}

export const HERMES_SESSIONS_CHANGED_EVENT = 'hermes-sessions-changed'
export const HERMES_SESSION_DELETED_EVENT = 'hermes-session-deleted'
export const HERMES_CAPABILITIES_OPEN_EVENT = 'hermes-capabilities-open'
export const HERMES_RESULTS_OPEN_EVENT = 'hermes-results-open'
export const HERMES_MESSAGE_PLATFORMS_OPEN_EVENT =
  'hermes-message-platforms-open'
export const HERMES_SKILL_DIALOG_OPEN_EVENT = 'hermes-skill-dialog-open'
export const HERMES_SKILLS_CHANGED_EVENT = 'hermes-skills-changed'
export const SESSION_TOUCH_INTERVAL_MS = 5000

const HERMES_CAPABILITIES_OPEN_REQUEST_KEY = 'hermes_capabilities_open_request'
const HERMES_RESULTS_OPEN_REQUEST_KEY = 'hermes_results_open_request'
const HERMES_MESSAGE_PLATFORMS_OPEN_REQUEST_KEY =
  'hermes_message_platforms_open_request'

export function getHermesBaseScope(
  userId?: number | string | null,
  prefix = 'hermes'
): string {
  return `${safeStorageScope(prefix)}_user_${userId ?? 'anonymous'}`
}

export function safeStorageScope(scope: string): string {
  return scope.trim().replaceAll(/[^a-zA-Z0-9_-]/g, '_')
}

export function conversationsStorageKey(baseScope: string): string {
  return `hermes_${safeStorageScope(baseScope)}_conversations_v1`
}

export function activeConversationStorageKey(baseScope: string): string {
  return `hermes_${safeStorageScope(baseScope)}_active_conversation_v1`
}

export function createHermesConversation(
  baseScope: string
): HermesConversation {
  const id = createId()
  const storageScope = `${baseScope}_session_${id}`
  const now = Date.now()
  return {
    id,
    title: '',
    storageScope,
    hermesSessionId: getOrCreatePlaygroundSessionId(storageScope),
    createdAt: now,
    updatedAt: now,
  }
}

export function createDefaultConversation(
  baseScope: string
): HermesConversation {
  const storageKeys = createPlaygroundStorageKeys(baseScope)
  const messages = loadMessages(storageKeys) ?? []
  const now = Date.now()
  return {
    id: 'default',
    title: deriveConversationTitle(messages) ?? '',
    storageScope: baseScope,
    hermesSessionId: getOrCreatePlaygroundSessionId(baseScope),
    createdAt: now,
    updatedAt: now,
  }
}

export function peekHermesConversations(
  baseScope: string
): HermesConversation[] {
  try {
    const saved = localStorage.getItem(conversationsStorageKey(baseScope))
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        return parsed.filter(isHermesConversation)
      }
    }
  } catch {}
  return []
}

export function loadHermesConversations(
  baseScope: string
): HermesConversation[] {
  try {
    const saved = localStorage.getItem(conversationsStorageKey(baseScope))
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (Array.isArray(parsed)) {
        const sessions = parsed.filter(isHermesConversation)
        if (sessions.length > 0) return sessions
      }
    }
  } catch {
    // Ignore corrupt local session metadata and rebuild the default entry.
  }

  const initial = [createDefaultConversation(baseScope)]
  saveHermesConversations(baseScope, initial)
  return initial
}

export function saveHermesConversations(
  baseScope: string,
  sessions: HermesConversation[]
): void {
  try {
    localStorage.setItem(
      conversationsStorageKey(baseScope),
      JSON.stringify(sessions)
    )
    notifyHermesSessionsChanged()
  } catch {
    // Local session metadata is non-critical; chat messages are saved separately.
  }
}

export function loadActiveConversationId(
  baseScope: string,
  sessions: HermesConversation[]
): string {
  try {
    const saved = localStorage.getItem(activeConversationStorageKey(baseScope))
    if (saved && sessions.some((session) => session.id === saved)) {
      return saved
    }
  } catch {
    // Fall through to the newest available session.
  }
  return sessions[0].id
}

export function saveActiveConversationId(
  baseScope: string,
  sessionId: string
): void {
  try {
    localStorage.setItem(activeConversationStorageKey(baseScope), sessionId)
    notifyHermesSessionsChanged()
  } catch {
    // Active session can fall back to the first session on next load.
  }
}

export function sortSessions(
  sessions: HermesConversation[]
): HermesConversation[] {
  return [...sessions].sort((a, b) => b.updatedAt - a.updatedAt)
}

export function clearConversationStorage(session: HermesConversation): void {
  try {
    const storageKeys = createPlaygroundStorageKeys(session.storageScope)
    localStorage.removeItem(storageKeys.CONFIG)
    localStorage.removeItem(storageKeys.MESSAGES)
    localStorage.removeItem(storageKeys.PARAMETER_ENABLED)
    localStorage.removeItem(
      `playground_${safeStorageScope(session.storageScope)}_session_id`
    )
  } catch {
    // Storage cleanup is best effort. Metadata deletion still proceeds.
  }
}

export function deriveConversationTitle(messages: Message[]): string | null {
  const firstUserMessage = messages.find((message) => message.from === 'user')
  const content = firstUserMessage?.versions?.[0]?.content
    ?.replaceAll(/\s+/g, ' ')
    .trim()
  if (!content) return null
  return content.length > 36 ? `${content.slice(0, 36)}...` : content
}

export function formatSessionTime(timestamp: number, justNow: string): string {
  if (!Number.isFinite(timestamp)) return justNow

  const diffMs = Date.now() - timestamp
  if (diffMs < 60_000) return justNow

  const date = new Date(timestamp)
  if (!Number.isFinite(date.getTime())) return justNow

  return new Intl.DateTimeFormat(undefined, {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function notifyHermesSessionsChanged(): void {
  queueMicrotask(() => {
    window.dispatchEvent(new Event(HERMES_SESSIONS_CHANGED_EVENT))
  })
}

export function notifyHermesSessionDeleted(sessionId: string): void {
  queueMicrotask(() => {
    window.dispatchEvent(
      new CustomEvent(HERMES_SESSION_DELETED_EVENT, { detail: sessionId })
    )
  })
}

export function notifyHermesSkillsChanged(): void {
  queueMicrotask(() => {
    window.dispatchEvent(new Event(HERMES_SKILLS_CHANGED_EVENT))
  })
}

export function requestOpenHermesCapabilities(): void {
  try {
    sessionStorage.setItem(
      HERMES_CAPABILITIES_OPEN_REQUEST_KEY,
      String(Date.now())
    )
  } catch {
    // The route listener below still handles same-page requests.
  }

  window.dispatchEvent(new Event(HERMES_CAPABILITIES_OPEN_EVENT))
}

export function consumeHermesCapabilitiesOpenRequest(): boolean {
  try {
    const value = sessionStorage.getItem(HERMES_CAPABILITIES_OPEN_REQUEST_KEY)
    if (!value) return false
    sessionStorage.removeItem(HERMES_CAPABILITIES_OPEN_REQUEST_KEY)
    return true
  } catch {
    return false
  }
}

export function requestOpenHermesResults(): void {
  try {
    sessionStorage.setItem(HERMES_RESULTS_OPEN_REQUEST_KEY, String(Date.now()))
  } catch {
    // The route listener below still handles same-page requests.
  }

  window.dispatchEvent(new Event(HERMES_RESULTS_OPEN_EVENT))
}

export function consumeHermesResultsOpenRequest(): boolean {
  try {
    const value = sessionStorage.getItem(HERMES_RESULTS_OPEN_REQUEST_KEY)
    if (!value) return false
    sessionStorage.removeItem(HERMES_RESULTS_OPEN_REQUEST_KEY)
    return true
  } catch {
    return false
  }
}
export function requestOpenHermesMessagePlatforms(): void {
  try {
    sessionStorage.setItem(
      HERMES_MESSAGE_PLATFORMS_OPEN_REQUEST_KEY,
      String(Date.now())
    )
  } catch {
    // The route listener below still handles same-page requests.
  }

  window.dispatchEvent(new Event(HERMES_MESSAGE_PLATFORMS_OPEN_EVENT))
}

export function consumeHermesMessagePlatformsOpenRequest(): boolean {
  try {
    const value = sessionStorage.getItem(
      HERMES_MESSAGE_PLATFORMS_OPEN_REQUEST_KEY
    )
    if (!value) return false
    sessionStorage.removeItem(HERMES_MESSAGE_PLATFORMS_OPEN_REQUEST_KEY)
    return true
  } catch {
    return false
  }
}

const HERMES_SKILL_DIALOG_OPEN_REQUEST_KEY = 'hermes_skill_dialog_open_request'

export function requestOpenHermesSkillDialog(teamId?: number): void {
  try {
    sessionStorage.setItem(
      HERMES_SKILL_DIALOG_OPEN_REQUEST_KEY,
      String(teamId ?? '')
    )
  } catch {
    // Fall through to event dispatch.
  }
  window.dispatchEvent(
    new CustomEvent<{ teamId?: number }>(HERMES_SKILL_DIALOG_OPEN_EVENT, {
      detail: teamId ? { teamId } : {},
    })
  )
}

export function consumeHermesSkillDialogOpenRequest(): number | undefined {
  try {
    const value = sessionStorage.getItem(HERMES_SKILL_DIALOG_OPEN_REQUEST_KEY)
    if (value === null) return undefined
    sessionStorage.removeItem(HERMES_SKILL_DIALOG_OPEN_REQUEST_KEY)
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  } catch {
    return undefined
  }
}

function createId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function isHermesConversation(value: unknown): value is HermesConversation {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<HermesConversation>
  return (
    typeof item.id === 'string' &&
    typeof item.title === 'string' &&
    typeof item.storageScope === 'string' &&
    typeof item.hermesSessionId === 'string' &&
    typeof item.createdAt === 'number' &&
    typeof item.updatedAt === 'number'
  )
}
