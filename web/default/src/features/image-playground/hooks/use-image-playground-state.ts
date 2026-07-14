import { useState, useCallback, useMemo } from 'react'

import { DEFAULT_CONFIG, STORAGE_KEYS } from '../constants'
import type {
  ImagePlaygroundConfig,
  ImageModelOption,
  GroupOption,
} from '../types'

function loadConfig(): Partial<ImagePlaygroundConfig> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONFIG)
    return raw ? (JSON.parse(raw) as Partial<ImagePlaygroundConfig>) : null
  } catch {
    return null
  }
}

function saveConfig(config: ImagePlaygroundConfig): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CONFIG, JSON.stringify(config))
  } catch {
    // ignore
  }
}

interface UseImagePlaygroundStateOptions {
  defaultConfig?: Partial<ImagePlaygroundConfig>
}

/**
 * Main state management hook for image playground
 * (mirrors playground's usePlaygroundState)
 */
export function useImagePlaygroundState(
  options: UseImagePlaygroundStateOptions = {}
) {
  const mergedDefault: ImagePlaygroundConfig = {
    ...DEFAULT_CONFIG,
    ...options.defaultConfig,
  }

  const [config, setConfig] = useState<ImagePlaygroundConfig>(() => {
    const saved = loadConfig()
    return { ...mergedDefault, ...saved }
  })

  const [models, setModels] = useState<ImageModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])

  const updateConfig = useCallback(
    <K extends keyof ImagePlaygroundConfig>(
      key: K,
      value: ImagePlaygroundConfig[K]
    ) => {
      setConfig((prev) => {
        const updated = { ...prev, [key]: value }
        saveConfig(updated)
        return updated
      })
    },
    []
  )

  const resetConfig = useCallback(() => {
    setConfig(mergedDefault)
    saveConfig(mergedDefault)
  }, [mergedDefault])

  return useMemo(
    () => ({
      config,
      models,
      groups,
      setModels,
      setGroups,
      updateConfig,
      resetConfig,
    }),
    [config, models, groups, setModels, setGroups, updateConfig, resetConfig]
  )
}
