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
import { STORAGE_KEYS } from '../constants'
import type { PlaygroundConfig, ParameterEnabled, Message } from '../types'
import { sanitizeMessagesOnLoad } from './message-utils'

export interface PlaygroundStorageKeys {
  CONFIG: string
  MESSAGES: string
  PARAMETER_ENABLED: string
}

export function createPlaygroundStorageKeys(
  scope?: string
): PlaygroundStorageKeys {
  if (!scope?.trim()) {
    return STORAGE_KEYS
  }

  const safeScope = scope.trim().replaceAll(/[^a-zA-Z0-9_-]/g, '_')
  return {
    CONFIG: `playground_${safeScope}_config`,
    MESSAGES: `playground_${safeScope}_messages`,
    PARAMETER_ENABLED: `playground_${safeScope}_parameter_enabled`,
  }
}

/**
 * Load playground config from localStorage
 */
export function loadConfig(
  keys: PlaygroundStorageKeys = STORAGE_KEYS
): Partial<PlaygroundConfig> {
  try {
    const saved = localStorage.getItem(keys.CONFIG)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load config:', error)
  }
  return {}
}

/**
 * Save playground config to localStorage
 */
export function saveConfig(
  config: Partial<PlaygroundConfig>,
  keys: PlaygroundStorageKeys = STORAGE_KEYS
): void {
  try {
    localStorage.setItem(keys.CONFIG, JSON.stringify(config))
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save config:', error)
  }
}

/**
 * Load parameter enabled state from localStorage
 */
export function loadParameterEnabled(
  keys: PlaygroundStorageKeys = STORAGE_KEYS
): Partial<ParameterEnabled> {
  try {
    const saved = localStorage.getItem(keys.PARAMETER_ENABLED)
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load parameter enabled:', error)
  }
  return {}
}

/**
 * Save parameter enabled state to localStorage
 */
export function saveParameterEnabled(
  parameterEnabled: Partial<ParameterEnabled>,
  keys: PlaygroundStorageKeys = STORAGE_KEYS
): void {
  try {
    localStorage.setItem(
      keys.PARAMETER_ENABLED,
      JSON.stringify(parameterEnabled)
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save parameter enabled:', error)
  }
}

/**
 * Load messages from localStorage
 */
export function loadMessages(
  keys: PlaygroundStorageKeys = STORAGE_KEYS
): Message[] | null {
  try {
    const saved = localStorage.getItem(keys.MESSAGES)
    if (saved) {
      const parsed: unknown = JSON.parse(saved)
      if (!Array.isArray(parsed)) {
        return null
      }
      const sanitized = sanitizeMessagesOnLoad(parsed as Message[])
      // Persist sanitized result to avoid re-sanitizing on subsequent loads
      if (sanitized !== parsed) {
        saveMessages(sanitized, keys)
      }
      return sanitized
    }
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to load messages:', error)
  }
  return null
}

function stripMessageAttachmentDataUrls(messages: Message[]): Message[] {
  return messages.map((message) => {
    if (!message.attachments?.length) return message

    return {
      ...message,
      attachments: message.attachments.map((attachment) =>
        attachment.url?.startsWith('data:')
          ? { ...attachment, url: '' }
          : attachment
      ),
    }
  })
}

/**
 * Save messages to localStorage
 */
export function saveMessages(
  messages: Message[],
  keys: PlaygroundStorageKeys = STORAGE_KEYS
): void {
  try {
    localStorage.setItem(
      keys.MESSAGES,
      JSON.stringify(stripMessageAttachmentDataUrls(messages))
    )
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to save messages:', error)
  }
}

/**
 * Clear all playground data
 */
export function clearPlaygroundData(
  keys: PlaygroundStorageKeys = STORAGE_KEYS
): void {
  try {
    localStorage.removeItem(keys.CONFIG)
    localStorage.removeItem(keys.PARAMETER_ENABLED)
    localStorage.removeItem(keys.MESSAGES)
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Failed to clear playground data:', error)
  }
}

export function getOrCreatePlaygroundSessionId(scope: string): string {
  const safeScope = scope.trim().replaceAll(/[^a-zA-Z0-9_-]/g, '_')
  const key = `playground_${safeScope}_session_id`

  try {
    const saved = localStorage.getItem(key)
    if (saved) return saved

    const sessionId =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`

    localStorage.setItem(key, sessionId)
    return sessionId
  } catch {
    return `session-${Date.now()}`
  }
}
