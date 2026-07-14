import { useState, useCallback, useMemo } from 'react'

import { DEFAULT_CONFIG, MAX_STORED_IMAGES, STORAGE_KEYS } from '../constants'
import type {
  ImagePlaygroundConfig,
  ImageModelOption,
  GroupOption,
  GeneratedImage,
} from '../types'

// ── Config persistence ──────────────────────────────────────────

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

// ── History persistence ─────────────────────────────────────────

function stripB64(images: GeneratedImage[]): GeneratedImage[] {
  return images.map((img) =>
    img.b64_json ? { ...img, b64_json: undefined } : img
  )
}

function loadHistory(): GeneratedImage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return (parsed as GeneratedImage[]).slice(0, MAX_STORED_IMAGES)
  } catch {
    return []
  }
}

function saveHistory(images: GeneratedImage[]): void {
  try {
    const trimmed = stripB64(images).slice(0, MAX_STORED_IMAGES)
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(trimmed))
  } catch {
    // ignore — quota exceeded, etc.
  }
}

// ── Hook ────────────────────────────────────────────────────────

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

  // ── Images with auto-save (same pattern as playground's updateMessages) ──
  const [images, setImages] = useState<GeneratedImage[]>(loadHistory)

  const updateImages = useCallback(
    (updater: GeneratedImage[] | ((prev: GeneratedImage[]) => GeneratedImage[])) => {
      setImages((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        saveHistory(next)
        return next
      })
    },
    []
  )

  const clearHistory = useCallback(() => {
    setImages([])
    try {
      localStorage.removeItem(STORAGE_KEYS.HISTORY)
    } catch {
      // ignore
    }
  }, [])

  // ── Config ──
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
      images,
      setModels,
      setGroups,
      updateConfig,
      resetConfig,
      updateImages,
      clearHistory,
    }),
    [config, models, groups, images, setModels, setGroups, updateConfig, resetConfig, updateImages, clearHistory]
  )
}
