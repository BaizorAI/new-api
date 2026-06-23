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
import { useState, useCallback, useMemo } from 'react'

import { DEFAULT_CONFIG, DEFAULT_PARAMETER_ENABLED } from '../constants'
import {
  loadConfig,
  saveConfig,
  loadParameterEnabled,
  saveParameterEnabled,
  loadMessages,
  saveMessages,
  createPlaygroundStorageKeys,
} from '../lib'
import type {
  Message,
  PlaygroundConfig,
  ParameterEnabled,
  ModelOption,
  GroupOption,
} from '../types'

interface UsePlaygroundStateOptions {
  storageScope?: string
  defaultConfig?: PlaygroundConfig
}

/**
 * Main state management hook for playground
 */
export function usePlaygroundState(options: UsePlaygroundStateOptions = {}) {
  const storageKeys = useMemo(
    () => createPlaygroundStorageKeys(options.storageScope),
    [options.storageScope]
  )
  const defaultConfig = options.defaultConfig ?? DEFAULT_CONFIG

  // Load initial state from localStorage
  const [config, setConfig] = useState<PlaygroundConfig>(() => {
    const savedConfig = loadConfig(storageKeys)
    return { ...defaultConfig, ...savedConfig }
  })

  const [parameterEnabled, setParameterEnabled] = useState<ParameterEnabled>(
    () => {
      const saved = loadParameterEnabled(storageKeys)
      return { ...DEFAULT_PARAMETER_ENABLED, ...saved }
    }
  )

  const [messages, setMessages] = useState<Message[]>(() => {
    return loadMessages(storageKeys) || []
  })

  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  // Update config with automatic save
  const updateConfig = useCallback(
    <K extends keyof PlaygroundConfig>(key: K, value: PlaygroundConfig[K]) => {
      setConfig((prev) => {
        const updated = { ...prev, [key]: value }
        saveConfig(updated, storageKeys)
        return updated
      })
    },
    [storageKeys]
  )

  // Update parameter enabled with automatic save
  const updateParameterEnabled = useCallback(
    (key: keyof ParameterEnabled, value: boolean) => {
      setParameterEnabled((prev) => {
        const updated = { ...prev, [key]: value }
        saveParameterEnabled(updated, storageKeys)
        return updated
      })
    },
    [storageKeys]
  )

  // Update messages with automatic save
  const updateMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setMessages((prev) => {
        const newMessages =
          typeof updater === 'function' ? updater(prev) : updater
        saveMessages(newMessages, storageKeys)
        return newMessages
      })
    },
    [storageKeys]
  )

  // Clear all messages
  const clearMessages = useCallback(() => {
    updateMessages([])
  }, [updateMessages])

  // Reset config to defaults
  const resetConfig = useCallback(() => {
    setConfig(defaultConfig)
    setParameterEnabled(DEFAULT_PARAMETER_ENABLED)
    saveConfig(defaultConfig, storageKeys)
    saveParameterEnabled(DEFAULT_PARAMETER_ENABLED, storageKeys)
  }, [defaultConfig, storageKeys])

  return {
    // State
    config,
    parameterEnabled,
    messages,
    models,
    groups,

    // Setters
    setModels,
    setGroups,

    // Actions
    updateConfig,
    updateParameterEnabled,
    updateMessages,
    clearMessages,
    resetConfig,
  }
}
