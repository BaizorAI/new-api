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
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { api } from '@/lib/api'
import type { StudioShot } from '../types'

interface DubbingGenState {
  isGenerating: boolean
  progress: number // 0-100
  /** Map of shot id → audio blob URL */
  audioUrls: Record<number, string>
}

/**
 * Hook for AI dubbing via OpenAI TTS.
 *
 * Calls POST /v1/audio/speech for each shot that has a description,
 * generating natural-sounding voiceover audio. Returns blob URLs
 * that can be played or downloaded.
 */
export function useDubbingGen() {
  const { t } = useTranslation()
  const [state, setState] = useState<DubbingGenState>({
    isGenerating: false,
    progress: 0,
    audioUrls: {},
  })
  const abortRef = useRef(false)
  const audioCache = useRef<Record<number, string>>({})

  const generateDubbing = useCallback(
    async (
      shots: StudioShot[],
      options?: { voice?: string; model?: string }
    ): Promise<Record<number, string>> => {
      const voice = options?.voice ?? 'alloy'
      const model = options?.model ?? 'tts-1'
      const shotsToProcess = shots.filter((s) => s.description?.trim())

      if (shotsToProcess.length === 0) {
        toast.warning(t('No shots with descriptions found for dubbing.'))
        return {}
      }

      abortRef.current = false
      setState({ isGenerating: true, progress: 0, audioUrls: {} })

      try {
        for (let i = 0; i < shotsToProcess.length; i++) {
          if (abortRef.current) break
          const shot = shotsToProcess[i]
          const text =
            shot.description.length > 300
              ? shot.description.slice(0, 300)
              : shot.description

          try {
            const response = await api.post(
              '/v1/audio/speech',
              {
                model,
                input: text,
                voice,
                response_format: 'mp3',
              },
              { responseType: 'blob', timeout: 60000 }
            )

            const blobUrl = URL.createObjectURL(
              new Blob([response.data], { type: 'audio/mp3' })
            )
            audioCache.current[shot.id] = blobUrl

            setState((prev) => ({
              ...prev,
              audioUrls: { ...audioCache.current },
              progress: Math.round(((i + 1) / shotsToProcess.length) * 100),
            }))
          } catch {
            // Skip individual failures, continue with remaining shots
          }
        }

        const result = { ...audioCache.current }
        setState({ isGenerating: false, progress: 100, audioUrls: result })
        const successCount = Object.keys(result).length
        if (successCount > 0) {
          toast.success(
            t('Voiceover generated for {{count}} shots.', {
              count: successCount,
            })
          )
        } else {
          toast.error(t('Voiceover generation failed for all shots.'))
        }
        return result
      } catch {
        setState({ isGenerating: false, progress: 0, audioUrls: {} })
        toast.error(t('Voiceover generation failed.'))
        return {}
      }
    },
    [t]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
    setState({ isGenerating: false, progress: 0, audioUrls: {} })
  }, [])

  return { ...state, generateDubbing, cancel }
}
