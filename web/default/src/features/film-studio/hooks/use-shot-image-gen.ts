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
import { useCallback, useRef, useState } from 'react'
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
}

export function useShotImageGen({
  projectId,
  styleDna = '',
  model = 'huayu-drama-4',
}: UseShotImageGenOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [generatingIds, setGeneratingIds] = useState<Set<number>>(
    () => new Set()
  )
  const pollTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  const generateImage = useCallback(
    async (shot: StudioShot) => {
      if (generatingIds.has(shot.id)) return

      const prompt = (shot.image_prompt || shot.description).trim()
      if (!prompt) {
        toast.error(t('No prompt available for this shot.'))
        return
      }

      const fullPrompt = styleDna
        ? `${prompt}. Style: ${styleDna}`
        : prompt

      setGeneratingIds((prev) => new Set(prev).add(shot.id))

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
          polls++
          if (polls > MAX_POLLS) {
            setGeneratingIds((prev) => {
              const next = new Set(prev)
              next.delete(shot.id)
              return next
            })
            pollTimers.current.delete(shot.id)
            toast.error(t('Image generation timed out.'))
            return
          }

          try {
            const history = await getImageHistory(1, 10)
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
              void queryClient.invalidateQueries({
                queryKey: [...STUDIO_QUERY_KEYS.shots(projectId)],
              })
              toast.success(t('Image generated.'))
            } else {
              toast.error(
                record.error_message || t('Image generation failed.')
              )
            }
          } catch {
            toast.error(t('Image generation failed.'))
          }

          // Done (success or failure) — remove from generating set
          setGeneratingIds((prev) => {
            const next = new Set(prev)
            next.delete(shot.id)
            return next
          })
          pollTimers.current.delete(shot.id)
        }

        // Start first poll after interval
        pollTimers.current.set(
          shot.id,
          setTimeout(() => void poll(), POLL_INTERVAL)
        )
      } catch {
        setGeneratingIds((prev) => {
          const next = new Set(prev)
          next.delete(shot.id)
          return next
        })
        toast.error(t('Image generation failed.'))
      }
    },
    [generatingIds, styleDna, model, projectId, queryClient, t]
  )

  return { generateImage, generatingIds }
}
