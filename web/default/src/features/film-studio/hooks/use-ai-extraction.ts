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
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { sendChatCompletion } from '@/features/playground/api'
import { getOrCreatePlaygroundSessionId } from '@/features/playground/lib/storage'
import { useAuthStore } from '@/stores/auth-store'

import {
  createStudioCharacter,
  createStudioShots,
} from '../api'
import { STUDIO_QUERY_KEYS } from '../constants'
import type { StudioCharacterFormData, StudioShotFormData } from '../types'

const EXTRACTION_MODEL = 'huayu-v2'

// ============================================================================
// Shared Hermes headers
// ============================================================================

function useHermesHeaders(projectId: number, stageKey: string) {
  const hermesSessionId = useMemo(() => {
    const userId = useAuthStore.getState().auth.user?.id ?? 'anon'
    return getOrCreatePlaygroundSessionId(
      `film_studio_extract_p${projectId}_${stageKey}_u${userId}`
    )
  }, [projectId, stageKey])

  return useMemo<Record<string, string>>(
    () => ({
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': hermesSessionId,
      'X-Baizor-Hermes-Workspace': 'skill_film_studio',
      'X-Baizor-Hermes-Skill-Activate': 'film_studio',
    }),
    [hermesSessionId]
  )
}

// ============================================================================
// JSON parsing helper
// ============================================================================

function extractJson(text: string): unknown {
  // Try to find a JSON array or object in the response
  const jsonMatch = text.match(/\[[\s\S]*\]|\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('No JSON found in response')
  return JSON.parse(jsonMatch[0])
}

// ============================================================================
// useExtractCharacters
// ============================================================================

const CHARACTER_SYSTEM_PROMPT = `You are a screenplay analysis assistant. Extract all named characters from the given screenplay/script text.

Output a JSON array of characters. Each character object must have:
- "name": string (the character's name)
- "description": string (1-2 sentence description of the character based on what's in the script)
- "visual_prompt": string (a visual description for AI image generation, e.g. appearance, clothing, age)

Output ONLY the JSON array, no other text. Example:
[{"name": "Alice", "description": "A brave detective in 1920s Chicago.", "visual_prompt": "Young woman, 30s, short dark hair, wearing a trench coat and fedora hat, determined expression"}]`

export function useExtractCharacters(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const headers = useHermesHeaders(projectId, 'characters')
  const [isExtracting, setIsExtracting] = useState(false)

  const extractCharacters = useCallback(
    async (scriptText: string, existingNames: string[] = []) => {
      if (isExtracting) return
      setIsExtracting(true)

      const existing = new Set(existingNames.map((n) => n.trim().toLowerCase()))

      try {
        const response = await sendChatCompletion(
          {
            model: EXTRACTION_MODEL,
            messages: [
              { role: 'system', content: CHARACTER_SYSTEM_PROMPT },
              { role: 'user', content: scriptText },
            ],
            stream: false,
            temperature: 0.3,
          },
          headers
        )

        const content = response.choices?.[0]?.message?.content
        if (!content) throw new Error('Empty response')

        const parsed = extractJson(content) as Array<{
          name: string
          description?: string
          visual_prompt?: string
        }>

        if (!Array.isArray(parsed) || parsed.length === 0) {
          toast.info(t('No characters found in the script.'))
          return
        }

        // Deduplicate: skip characters whose name already exists
        let created = 0
        let skipped = 0
        for (const char of parsed) {
          if (!char.name?.trim()) continue
          if (existing.has(char.name.trim().toLowerCase())) {
            skipped++
            continue
          }
          const data: StudioCharacterFormData = {
            name: char.name.trim(),
            description: (char.description ?? '').trim(),
            visual_prompt: (char.visual_prompt ?? '').trim(),
          }
          try {
            await createStudioCharacter(projectId, data)
            created++
          } catch {
            // Skip individual failures
          }
        }

        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)],
        })

        if (created > 0) {
          const msg = skipped > 0
            ? t('Extracted {{count}} characters, skipped {{skipped}} duplicates.', { count: created, skipped })
            : t('Extracted {{count}} characters from script.', { count: created })
          toast.success(msg)
        } else if (skipped > 0) {
          toast.info(t('All {{count}} characters already exist.', { count: skipped }))
        } else {
          toast.info(t('No characters found in the script.'))
        }
      } catch (err) {
        toast.error(
          t('Failed to extract characters.') +
            (err instanceof Error ? ` ${err.message}` : '')
        )
      } finally {
        setIsExtracting(false)
      }
    },
    [isExtracting, headers, projectId, queryClient, t]
  )

  return { extractCharacters, isExtracting }
}

// ============================================================================
// useExtractShots
// ============================================================================

const SHOTS_SYSTEM_PROMPT = `You are a screenplay analysis assistant. Break down the given screenplay/script text into a shot list for storyboarding.

Output a JSON array of shots. Each shot object must have:
- "scene_number": number (the scene this shot belongs to, starting from 1)
- "shot_number": number (sequential shot number within the scene, starting from 1)
- "description": string (what happens in this shot)
- "camera_angle": string (e.g. "Wide", "Close-up", "Medium", "Over-the-shoulder", "Bird's eye")
- "camera_move": string (e.g. "Static", "Pan left", "Dolly in", "Tracking", "Crane up")
- "duration": number (estimated duration in seconds, between 2 and 30)
- "image_prompt": string (a visual description for generating a key frame image of this shot)

Output ONLY the JSON array, no other text.`

export function useExtractShots(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const headers = useHermesHeaders(projectId, 'storyboard')
  const [isExtracting, setIsExtracting] = useState(false)

  const extractShots = useCallback(
    async (scriptText: string) => {
      if (isExtracting) return
      setIsExtracting(true)

      try {
        const response = await sendChatCompletion(
          {
            model: EXTRACTION_MODEL,
            messages: [
              { role: 'system', content: SHOTS_SYSTEM_PROMPT },
              { role: 'user', content: scriptText },
            ],
            stream: false,
            temperature: 0.3,
          },
          headers
        )

        const content = response.choices?.[0]?.message?.content
        if (!content) throw new Error('Empty response')

        const parsed = extractJson(content) as Array<{
          scene_number?: number
          shot_number?: number
          description?: string
          camera_angle?: string
          camera_move?: string
          duration?: number
          image_prompt?: string
        }>

        if (!Array.isArray(parsed) || parsed.length === 0) {
          toast.info(t('No shots found in the script.'))
          return
        }

        // Build valid shot data
        const shotDataList: StudioShotFormData[] = parsed
          .filter((s) => s.description?.trim())
          .map((s, idx) => ({
            scene_number: s.scene_number ?? 1,
            shot_number: s.shot_number ?? idx + 1,
            description: (s.description ?? '').trim(),
            camera_angle: (s.camera_angle ?? '').trim(),
            camera_move: (s.camera_move ?? '').trim(),
            duration: s.duration ?? 5,
            image_prompt: (s.image_prompt ?? '').trim(),
          }))

        if (shotDataList.length === 0) {
          toast.info(t('No shots found in the script.'))
          return
        }

        // Bulk-create shots
        await createStudioShots(projectId, shotDataList)

        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.shots(projectId)],
        })

        toast.success(
          t('Extracted {{count}} shots from script.', {
            count: shotDataList.length,
          })
        )
      } catch (err) {
        toast.error(
          t('Failed to extract shots.') +
            (err instanceof Error ? ` ${err.message}` : '')
        )
      } finally {
        setIsExtracting(false)
      }
    },
    [isExtracting, headers, projectId, queryClient, t]
  )

  return { extractShots, isExtracting }
}
