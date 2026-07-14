import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { sendImageGeneration, saveImageHistory } from '../api'
import { ERROR_MESSAGES } from '../constants'
import type { ImagePlaygroundConfig } from '../types'

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
  onSuccess: () => void
}

/**
 * Hook for handling image generation requests.
 * Saves results to server-side history and calls onSuccess to trigger refetch.
 */
export function useImageHandler({
  config,
  onSuccess,
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
          // Save each generated image to server-side history
          await Promise.all(
            response.data.map((d) =>
              saveImageHistory({
                prompt: trimmed,
                model: config.model,
                size: config.size,
                quality: config.quality,
                image_url: d.url ?? '',
                revised_prompt: d.revised_prompt,
              })
            )
          )
          onSuccess()
        }
      } catch (err: unknown) {
        const message = extractImageError(err)
        setError(message)
        toast.error(message)
      } finally {
        setIsGenerating(false)
      }
    },
    [config, onSuccess]
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    generate,
    isGenerating,
    error,
    clearError,
  }
}
