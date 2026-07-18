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

import { sendChatCompletion } from '@/features/playground/api'
import type { StudioShot } from '../types'

export interface AssemblyTimelineEntry {
  clip_ref: string
  start_time: number
  end_time: number
  transition_in: string
  transition_out: string
  audio: {
    ambient: string
    music: string
    sfx: string[]
  }
  color_grade: string
  subtitles: Array<{ start: number; end: number; text: string }>
}

export interface AssemblyPlan {
  timeline: AssemblyTimelineEntry[]
  music_cues: Array<{
    name: string
    mood: string
    tempo: string
    instruments: string
    start_time: number
    end_time: number
    notes: string
  }>
  color_grading: {
    overall_lut: string
    scene_overrides: Record<string, string>
  }
  delivery_specs: {
    resolution: string
    framerate: number
    format: string
    audio_format: string
  }
}

interface AssemblyGenState {
  isGenerating: boolean
  plan: AssemblyPlan | null
}

/**
 * Hook for AI-powered video assembly planning.
 *
 * Calls the Hermes post-production agent to generate a comprehensive
 * assembly plan including transitions, audio design, and color grading
 * for the given shots.
 */
export function useAiAssembly() {
  const { t } = useTranslation()
  const [state, setState] = useState<AssemblyGenState>({
    isGenerating: false,
    plan: null,
  })
  const abortRef = useRef(false)

  const generateAssemblyPlan = useCallback(
    async (shots: StudioShot[]): Promise<AssemblyPlan | null> => {
      const shotsWithData = shots.filter(
        (s) => s.description?.trim()
      )
      if (shotsWithData.length === 0) {
        toast.warning(t('No shots found for assembly planning.'))
        return null
      }

      abortRef.current = false
      setState({ isGenerating: true, plan: null })

      const shotContext = shotsWithData
        .map(
          (s) =>
            `S${s.scene_number}-${s.shot_number}: ${s.description} (${s.duration || 5}s, ${s.camera_angle || 'medium'}, ${s.camera_move || 'static'})`
        )
        .join('\n')

      const assemblyPrompt = `You are a post-production coordinator AI. Given the following shot list, create a comprehensive assembly plan.

Shots:
${shotContext}

Output a JSON object with:
- "timeline": array of {clip_ref, start_time, end_time, transition_in, transition_out, audio: {ambient, music, sfx[]}, color_grade, subtitles[]}
- "music_cues": array of {name, mood, tempo, instruments, start_time, end_time, notes}
- "color_grading": {overall_lut, scene_overrides}
- "delivery_specs": {resolution, framerate, format, audio_format}

Rules:
1. Default transitions to "cut" — use fancy transitions sparingly
2. Ambient audio should be continuous within scenes
3. Color grading should be consistent within scenes
4. Subtitle timing: min 1.5s display, max 7s
5. Leave 0.5s breathing room at transitions
6. Build cumulative start/end times from shot durations

Output ONLY valid JSON, no other text.`

      try {
        const result = await sendChatCompletion(
          {
            model: 'huayu-v2',
            messages: [
              {
                role: 'system',
                content:
                  'You are a professional post-production coordinator AI for film. Output ONLY valid JSON.',
              },
              { role: 'user', content: assemblyPrompt },
            ],
            stream: false,
            temperature: 0.3,
          },
          {
            'X-Baizor-Playground': 'hermes',
            'X-Baizor-Hermes-Skill-Activate': '/magicalbrush',
          }
        )

        const content = result?.choices?.[0]?.message?.content?.trim()
        if (!content) throw new Error('Empty AI response')

        // Extract JSON from response
        const jsonMatch = content.match(/\{[\s\S]*\}/)
        if (!jsonMatch) throw new Error('No JSON found in response')

        const plan: AssemblyPlan = JSON.parse(jsonMatch[0])
        setState({ isGenerating: false, plan })
        toast.success(t('Assembly plan generated.'))
        return plan
      } catch (err) {
        setState({ isGenerating: false, plan: null })
        toast.error(
          t('Assembly planning failed.') +
            (err instanceof Error ? ` ${err.message}` : '')
        )
        return null
      }
    },
    [t]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
    setState({ isGenerating: false, plan: null })
  }, [])

  return { ...state, generateAssemblyPlan, cancel }
}
