import { useCallback, useState } from 'react'
import { nanoid } from 'nanoid'
import { toast } from 'sonner'

import { sendImageGeneration } from '../api'
import { ERROR_MESSAGES } from '../constants'
import type {
  ImagePlaygroundConfig,
  GeneratedImage,
} from '../types'

type ImageErrorData = {
  message?: string
  error?: {
    message?: string
    code?: unknown
  }
}

function extractImageError(error: unknown): string {
  const err = error as {
    response?: { data?: ImageErrorData }
    message?: string
  }
  const data = err?.response?.data
  return (
    data?.error?.message?.trim() ||
    data?.message?.trim() ||
    err?.message ||
    ERROR_MESSAGES.API_REQUEST_ERROR
  )
}

interface UseImageHandlerOptions {
  config: ImagePlaygroundConfig
  onImagesUpdate: (updater: (prev: GeneratedImage[]) => GeneratedImage[]) => void
}

/**
 * Hook for handling image generation requests
 * (mirrors playground's useChatHandler)
 */
export function useImageHandler({
  config,
  onImagesUpdate,
}: UseImageHandlerOptions) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim()
      if (!trimmed) {
        toast.error(ERROR_MESSAGES.PROMPT_REQUIRED)
        return
      }

      setIsGenerating(true)
      setError(null)

      try {
        const response = await sendImageGeneration({
          model: config.model,
          group: config.group,
          prompt: trimmed,
          size: config.size,
          quality: config.quality,
          n: 1,
        })

        if (response.data && response.data.length > 0) {
          const newImages: GeneratedImage[] = response.data.map((d) => ({
            id: nanoid(),
            url: d.url,
            b64_json: d.b64_json,
            revised_prompt: d.revised_prompt,
            model: config.model,
            prompt: trimmed,
            size: config.size,
            quality: config.quality,
            timestamp: Date.now(),
          }))
          onImagesUpdate((prev) => [...newImages, ...prev])
        }
      } catch (err: unknown) {
        const message = extractImageError(err)
        setError(message)
        toast.error(message)
      } finally {
        setIsGenerating(false)
      }
    },
    [config, onImagesUpdate]
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    generate,
    isGenerating,
    error,
    clearError,
  }
}
