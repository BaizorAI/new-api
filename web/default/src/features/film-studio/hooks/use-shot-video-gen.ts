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
  getVideoHistory,
  submitVideoGeneration,
} from '@/features/video-playground/api'
import { VIDEO_STATUS } from '@/features/video-playground/types'

import { updateStudioShot } from '../api'
import { STUDIO_QUERY_KEYS } from '../constants'
import type { StudioShot } from '../types'

const POLL_INTERVAL = 10_000 // 10s — video gen is slower than image gen
const MAX_POLLS = 360 // 1 hour max

interface UseShotVideoGenOptions {
  projectId: number
  styleDna?: string
  model?: string
}

export function useShotVideoGen({
  projectId,
  styleDna = '',
  model = 'huayu-drama-4',
}: UseShotVideoGenOptions) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [generatingIds, setGeneratingIds] = useState<Set<number>>(
    () => new Set()
  )
  const pollTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(
    new Map()
  )

  const generateVideo = useCallback(
    async (shot: StudioShot) => {
      if (generatingIds.has(shot.id)) return

      const prompt = (
        shot.video_prompt || shot.image_prompt || shot.description
      ).trim()
      if (!prompt) {
        toast.error(t('No video prompt available for this shot.'))
        return
      }

      const fullPrompt = styleDna ? `${prompt}. Style: ${styleDna}` : prompt

      setGeneratingIds((prev) => new Set(prev).add(shot.id))

      try {
        // I2V if shot has an image, otherwise T2V
        const pending = await submitVideoGeneration({
          prompt: fullPrompt,
          model,
          size: '512x768',
          negative_prompt: '',
          num_frames: 97,
          fps: 24,
          guidance_scale: 3.6,
          seed: 0,
          group: 'default',
          ...(shot.image_url
            ? { image_url: shot.image_url, image_strength: 0.85 }
            : {}),
        })

        // Write task id to shot
        try {
          await updateStudioShot(projectId, shot.id, {
            video_task_id: String(pending.id),
            status: 1, // GENERATING
          })
        } catch {
          // Non-fatal — polling will still work
        }

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
            toast.error(t('Video generation timed out.'))
            return
          }

          try {
            const history = await getVideoHistory(1, 10)
            const record = history.items.find((h) => h.id === pending.id)

            if (!record || record.status === VIDEO_STATUS.PENDING) {
              // Still generating, poll again
              pollTimers.current.set(
                shot.id,
                setTimeout(() => void poll(), POLL_INTERVAL)
              )
              return
            }

            if (record.status === VIDEO_STATUS.COMPLETED && record.video_url) {
              // Write video_url back to the shot
              await updateStudioShot(projectId, shot.id, {
                video_url: record.video_url,
                status: 2, // COMPLETED
              })
              void queryClient.invalidateQueries({
                queryKey: [...STUDIO_QUERY_KEYS.shots(projectId)],
              })
              toast.success(t('Video generated.'))
            } else {
              // Failed
              try {
                await updateStudioShot(projectId, shot.id, { status: 3 })
              } catch {
                // Non-fatal
              }
              toast.error(
                record.error_message || t('Video generation failed.')
              )
            }
          } catch {
            toast.error(t('Video generation failed.'))
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
        toast.error(t('Video generation failed.'))
      }
    },
    [generatingIds, styleDna, model, projectId, queryClient, t]
  )

  return { generateVideo, generatingIds }
}
