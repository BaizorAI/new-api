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
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  getImageHistory,
  submitImageGeneration,
} from '@/features/image-playground/api'
import { IMAGE_STATUS } from '@/features/image-playground/types'

import { updateStudioShot } from '../api'
import { STUDIO_QUERY_KEYS } from '../constants'
import type { StudioShot } from '../types'

const POLL_INTERVAL = 3000
const MAX_POLLS = 60 // 3 minutes max

interface UseShotImageGenOptions {
  projectId: number
  styleDna?: string
  model?: string
  /** Characters for injecting visual consistency into prompts. */
  characters?: { id: number; visual_prompt?: string }[]
}

export function useShotImageGen({
  projectId,
  styleDna = '',
  model = 'huayu-drama-4',
  characters = [],
}: UseShotImageGenOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [generatingIds, setGeneratingIds] = useState<Set<number>>(
    () => new Set()
  )
  // Use a ref mirror of generatingIds to avoid stale closure in batch calls
  const generatingRef = useRef<Set<number>>(new Set())
  const pollTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  )
  const unmountedRef = useRef(false)

  // Cleanup all poll timers on unmount
  useEffect(() => {
    unmountedRef.current = false
    return () => {
      unmountedRef.current = true
      for (const timer of pollTimers.current.values()) {
        clearTimeout(timer)
      }
      pollTimers.current.clear()
    }
  }, [])

  const addGenerating = useCallback((id: number) => {
    generatingRef.current.add(id)
    setGeneratingIds((prev) => new Set(prev).add(id))
  }, [])

  const removeGenerating = useCallback((id: number) => {
    generatingRef.current.delete(id)
    if (!unmountedRef.current) {
      setGeneratingIds((prev) => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }, [])

  const generateImage = useCallback(
    async (shot: StudioShot) => {
      if (generatingRef.current.has(shot.id)) return

      const prompt = (shot.image_prompt || shot.description).trim()
      if (!prompt) {
        toast.error(t('No prompt available for this shot.'))
        return
      }

      // Build character consistency suffix from associated characters
      const characterConstraints = buildCharacterConstraint(shot.character_ids, characters)

      let fullPrompt = styleDna
        ? `${prompt}. Style: ${styleDna}`
        : prompt
      if (characterConstraints) {
        fullPrompt += characterConstraints
      }

      addGenerating(shot.id)

      try {
        const pending = await submitImageGeneration({
          prompt: fullPrompt,
          model,
          size: '1024x1024',
          quality: 'standard',
          group: 'default',
        })

        // Start polling for completion
        let polls = 0
        const poll = async () => {
          if (unmountedRef.current) return
          polls++
          if (polls > MAX_POLLS) {
            removeGenerating(shot.id)
            pollTimers.current.delete(shot.id)
            toast.error(t('Image generation timed out.'))
            return
          }

          try {
            const history = await getImageHistory(1, 10)
            if (unmountedRef.current) return
            const record = history.items.find((h) => h.id === pending.id)

            if (!record || record.status === IMAGE_STATUS.PENDING) {
              // Still generating, poll again
              pollTimers.current.set(
                shot.id,
                setTimeout(() => void poll(), POLL_INTERVAL)
              )
              return
            }

            if (record.status === IMAGE_STATUS.COMPLETED && record.image_url) {
              // Write image_url back to the shot
              await updateStudioShot(projectId, shot.id, {
                image_url: record.image_url,
              })
              if (!unmountedRef.current) {
                void queryClient.invalidateQueries({
                  queryKey: [...STUDIO_QUERY_KEYS.shots(projectId)],
                })
                toast.success(t('Image generated.'))
              }
            } else {
              if (!unmountedRef.current) {
                toast.error(
                  record.error_message || t('Image generation failed.')
                )
              }
            }
          } catch {
            if (!unmountedRef.current) {
              toast.error(t('Image generation failed.'))
            }
          }

          // Done (success or failure) — remove from generating set
          removeGenerating(shot.id)
          pollTimers.current.delete(shot.id)
        }

        // Start first poll after interval
        pollTimers.current.set(
          shot.id,
          setTimeout(() => void poll(), POLL_INTERVAL)
        )
      } catch {
        removeGenerating(shot.id)
        toast.error(t('Image generation failed.'))
      }
    },
    [styleDna, model, projectId, queryClient, t, addGenerating, removeGenerating]
  )

  return { generateImage, generatingIds }
}

/**
 * Build a character consistency constraint string from the shot's
 * associated character IDs. Appends key visual traits to the prompt
 * so generated images maintain cross-shot character identity.
 */
function buildCharacterConstraint(
  characterIds: string | undefined,
  characters: { id: number; visual_prompt?: string }[],
): string {
  if (!characterIds || characters.length === 0) return ''
  const ids = new Set(characterIds.split(',').filter(Boolean).map(Number))
  const linked = characters.filter((c) => ids.has(c.id) && c.visual_prompt?.trim())
  if (linked.length === 0) return ''
  const traits = linked.map((c) => c.visual_prompt!.trim()).join('; ')
  return `. Character consistency requirement: ${traits}`
}
