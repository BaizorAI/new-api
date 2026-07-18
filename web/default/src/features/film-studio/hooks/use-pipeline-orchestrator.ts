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

export type PipelineStageStatus =
  | 'queued'
  | 'running'
  | 'checkpoint'
  | 'done'
  | 'skipped'

export interface PipelineStageState {
  key: string
  label: string
  icon: string
  status: PipelineStageStatus
}

export interface PipelineState {
  stages: PipelineStageState[]
  isRunning: boolean
  currentStage: string | null
  /**
   * null = not started;
   * 'running' = executing;
   * 'checkpoint' = waiting for user confirmation;
   * 'done' = complete;
   * 'error' = failed
   */
  status: 'idle' | 'running' | 'checkpoint' | 'done' | 'error'
  error: string | null
}

const PIPELINE_STAGES_MAP: { key: string; label: string; icon: string }[] = [
  { key: 'script', label: 'Script', icon: '📝' },
  { key: 'characters', label: 'Characters', icon: '👤' },
  { key: 'storyboard', label: 'Storyboard', icon: '🎬' },
  { key: 'image_gen', label: 'Images', icon: '🖼️' },
  { key: 'video_gen', label: 'Videos', icon: '🎥' },
  { key: 'post', label: 'Post', icon: '✂️' },
  { key: 'review', label: 'Review', icon: '✅' },
]

const CHECKPOINT_STAGES = new Set(['script', 'characters', 'storyboard'])

function buildInitialStages(skipKeys: string[]): PipelineStageState[] {
  const skipSet = new Set(skipKeys)
  return PIPELINE_STAGES_MAP.map((s) => ({
    ...s,
    status: (skipSet.has(s.key) ? 'skipped' : 'queued') as PipelineStageStatus,
  }))
}

const FULL_PIPELINE_PROMPT = `You are the full-pipeline orchestrator for a film production. Execute ALL 7 stages automatically and report progress after each stage.

**Stage 1 — Script Analysis:**
Analyze the project brief and generate a complete screenplay. Output with \`\`\`script ... \`\`\` code block.

**Stage 2 — Character Design:**
Extract all characters and output a JSON array:
\`\`\`json
[{"name": "...", "description": "...", "visual_prompt": "..."}]
\`\`\`

**Stage 3 — Storyboard Planning:**
Break the script into shots. Output a JSON array:
\`\`\`json
[{"scene_number": 1, "shot_number": 1, "description": "...", "camera_angle": "Close-up", "camera_move": "Static", "duration": 5, "image_prompt": "...", "video_prompt": "..."}]
\`\`\`

**Stage 4 — Image Generation Guidance:**
For each shot, describe the ideal keyframe. Confirm which shots should get "cinematic", "photorealistic", or "illustration" style.

**Stage 5 — Video Generation Guidance:**
For each shot, describe the motion and camera behaviour.

**Stage 6 — Post-Production Plan:**
Output assembly plan as JSON with timeline, transitions, audio cues, and color grading.

**Stage 7 — Quality Review:**
Review all outputs and give a quality score. End with "✅ Final quality score: X/10".

IMPORTANT:
- After EACH stage, mark progress with "[STAGE N/7 DONE]" and a brief summary.
- After stages 1, 2, and 3, add "[CHECKPOINT]" and ask user to confirm before continuing.
- After stage 7, add "[PIPELINE COMPLETE]".
- If a stage has no data to process, mark it "[STAGE N/7 SKIPPED]".`

export function usePipelineOrchestrator() {
  const { t } = useTranslation()
  const [state, setState] = useState<PipelineState>({
    stages: buildInitialStages([]),
    isRunning: false,
    currentStage: null,
    status: 'idle',
    error: null,
  })
  const abortRef = useRef(false)
  const stageRef = useRef<PipelineStageState[]>([])

  const startPipeline = useCallback(
    async (projectBrief: string, projectName: string, genre: string, styleDna: string) => {
      abortRef.current = false
      const initial = buildInitialStages([])
      stageRef.current = initial
      setState({
        stages: initial,
        isRunning: true,
        currentStage: PIPELINE_STAGES_MAP[0].key,
        status: 'running',
        error: null,
      })

      const userMessage = `Project: ${projectName}\nGenre: ${genre}\nStyle: ${styleDna || 'not specified'}\n\nBrief:\n${projectBrief}`

      try {
        const result = await sendChatCompletion(
          {
            model: 'huayu-v2',
            messages: [
              { role: 'system', content: FULL_PIPELINE_PROMPT },
              { role: 'user', content: userMessage },
            ],
            stream: false,
            temperature: 0.4,
          },
          {
            'X-Baizor-Playground': 'hermes',
            'X-Baizor-Hermes-Skill-Activate': '/magicalbrush',
          }
        )

        const content = result?.choices?.[0]?.message?.content ?? ''
        if (!content) throw new Error('Empty response from pipeline agent')

        // Parse stage progress from response
        const stages = [...stageRef.current]
        let currentStage: string | null = null
        let doneCount = 0
        let isCheckpoint = false

        for (const [i, s] of PIPELINE_STAGES_MAP.entries()) {
          const stageMarker = `[STAGE ${i + 1}/7 DONE]`
          const skipMarker = `[STAGE ${i + 1}/7 SKIPPED]`
          if (content.includes(stageMarker)) {
            stages[i].status = 'done'
            doneCount++
          } else if (content.includes(skipMarker)) {
            stages[i].status = 'skipped'
          } else if (!currentStage && stages[i].status !== 'done' && stages[i].status !== 'skipped') {
            stages[i].status = i < 3 && content.includes('[CHECKPOINT]') ? 'checkpoint' : 'running'
            currentStage = stages[i].key
            isCheckpoint = stages[i].status === 'checkpoint'
            break
          }
        }

        // If no stage markers found, estimate from content
        if (doneCount === 0) {
          // Mark at least script as done since we have a response
          stages[0].status = 'done'
          if (CHECKPOINT_STAGES.has(PIPELINE_STAGES_MAP[0].key)) {
            stages[1].status = 'checkpoint'
            currentStage = stages[1].key
            isCheckpoint = true
          } else {
            stages[1].status = 'running'
            currentStage = stages[1].key
          }
        }

        stageRef.current = stages

        const isComplete = content.includes('[PIPELINE COMPLETE]') || stages.every(s => s.status === 'done' || s.status === 'skipped')

        setState({
          stages,
          isRunning: !isComplete,
          currentStage,
          status: isComplete ? 'done' : isCheckpoint ? 'checkpoint' : 'running',
          error: null,
        })

        return { content, stages, isCheckpoint, isComplete }
      } catch (err) {
        setState(p => ({
          ...p,
          isRunning: false,
          status: 'error',
          error: err instanceof Error ? err.message : t('Pipeline execution failed.'),
        }))
        toast.error(t('AI pipeline execution failed.'))
        return null
      }
    },
    [t],
  )

  const confirmCheckpoint = useCallback(() => {
    const stages = [...stageRef.current]
    const currentIdx = stages.findIndex(s => s.status === 'checkpoint')
    if (currentIdx >= 0) {
      stages[currentIdx].status = 'done'
    }
    // Move to next stage
    let nextIdx = currentIdx + 1
    while (nextIdx < stages.length && stages[nextIdx].status === 'skipped') nextIdx++
    if (nextIdx < stages.length) {
      stages[nextIdx].status = 'running'
    }
    stageRef.current = stages
    setState(p => ({
      ...p,
      stages,
      currentStage: nextIdx < stages.length ? stages[nextIdx].key : null,
      status: 'running',
    }))
  }, [])

  const skipCheckpoint = useCallback(() => {
    const stages = [...stageRef.current]
    const currentIdx = stages.findIndex(s => s.status === 'checkpoint')
    if (currentIdx >= 0) {
      stages[currentIdx].status = 'skipped'
    }
    let nextIdx = currentIdx + 1
    while (nextIdx < stages.length && stages[nextIdx].status === 'skipped') nextIdx++
    if (nextIdx < stages.length) {
      stages[nextIdx].status = 'running'
    }
    stageRef.current = stages
    const isComplete = nextIdx >= stages.length
    setState(p => ({
      ...p,
      stages,
      currentStage: nextIdx < stages.length ? stages[nextIdx].key : null,
      status: isComplete ? 'done' : 'running',
    }))
  }, [])

  const markComplete = useCallback(() => {
    setState(p => ({
      ...p,
      isRunning: false,
      status: 'done',
      stages: stageRef.current.map(s => ({ ...s, status: s.status === 'queued' || s.status === 'running' ? 'skipped' : s.status })),
    }))
  }, [])

  const cancel = useCallback(() => {
    abortRef.current = true
    setState(p => ({
      ...p,
      isRunning: false,
      status: 'idle',
    }))
  }, [])

  return { ...state, startPipeline, confirmCheckpoint, skipCheckpoint, markComplete, cancel }
}
