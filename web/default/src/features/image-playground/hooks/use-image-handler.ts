import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import { submitImageGeneration } from '../api'
import { ERROR_MESSAGES } from '../constants'
import type { ImagePlaygroundConfig } from '../types'

interface UseImageHandlerOptions {
  config: ImagePlaygroundConfig
  onSuccess: () => void
}

/**
 * Hook for submitting image generation requests.
 * The backend handles generation asynchronously — this hook returns
 * as soon as the pending record is created.
 */
export function useImageHandler({
  config,
  onSuccess,
}: UseImageHandlerOptions) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(
    async (prompt: string) => {
      const trimmed = prompt.trim()
      if (!trimmed) {
        toast.error(ERROR_MESSAGES.PROMPT_REQUIRED)
        return
      }

      setIsSubmitting(true)
      setError(null)

      try {
        await submitImageGeneration({
          prompt: trimmed,
          model: config.model,
          size: config.size,
          quality: config.quality,
          group: config.group,
        })
        onSuccess()
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response
            ?.data?.message ||
          (err as Error)?.message ||
          ERROR_MESSAGES.API_REQUEST_ERROR
        setError(message)
        toast.error(message)
      } finally {
        setIsSubmitting(false)
      }
    },
    [config, onSuccess]
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    generate,
    isSubmitting,
    error,
    clearError,
  }
}
