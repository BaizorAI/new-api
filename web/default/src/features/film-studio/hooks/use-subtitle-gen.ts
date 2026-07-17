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

import type { StudioShot } from '../types'

interface SubtitleGenState {
  isGenerating: boolean
  progress: number // 0-100
  resultSrt: string | null
}

/**
 * Hook for generating SRT subtitle files from shot data.
 *
 * Goes through each shot and generates subtitle entries based on shot
 * descriptions and metadata. The result is a valid SRT file that can
 * be downloaded and imported into video editing software.
 *
 * TODO: Wire to the actual /v1/audio/transcriptions Whisper endpoint
 * when video files are accessible server-side. The endpoint already
 * supports `response_format: 'srt'`.
 */
export function useSubtitleGen() {
  const { t } = useTranslation()
  const [state, setState] = useState<SubtitleGenState>({
    isGenerating: false,
    progress: 0,
    resultSrt: null,
  })
  const abortRef = useRef(false)

  const generateSubtitles = useCallback(
    async (
      shots: StudioShot[],
      _options?: { language?: string }
    ): Promise<string | null> => {
      const shotsToProcess = shots.filter(
        (s) => s.description?.trim()
      )
      if (shotsToProcess.length === 0) {
        toast.warning(t('No shots with descriptions found.'))
        return null
      }

      abortRef.current = false
      setState({ isGenerating: true, progress: 0, resultSrt: null })

      try {
        const srtLines: string[] = []
        let cumulativeSeconds = 0

        for (let i = 0; i < shotsToProcess.length; i++) {
          if (abortRef.current) break
          const shot = shotsToProcess[i]
          const duration = shot.duration || 5
          const startTime = formatSrtTime(cumulativeSeconds)
          const endTime = formatSrtTime(cumulativeSeconds + duration)

          // Generate subtitle entry from shot description
          // TODO: Replace with actual Whisper ASR API call:
          //   POST /v1/audio/transcriptions with form data { file: videoBlob, model: 'whisper-1', response_format: 'srt' }
          //   Parse the SRT response and merge into the timeline
          const subtitleText =
            shot.description.length > 80
              ? shot.description.slice(0, 80) + '...'
              : shot.description

          srtLines.push(String(i + 1))
          srtLines.push(`${startTime} --> ${endTime}`)
          srtLines.push(
            `[S${shot.scene_number}-${shot.shot_number}] ${subtitleText}`
          )
          srtLines.push('')

          cumulativeSeconds += duration

          setState((prev) => ({
            ...prev,
            progress: Math.round(((i + 1) / shotsToProcess.length) * 100),
          }))
        }

        const srt = srtLines.join('\n')
        setState({ isGenerating: false, progress: 100, resultSrt: srt })
        toast.success(
          t('Subtitles generated for {{count}} shots.', {
            count: shotsToProcess.length,
          })
        )
        return srt
      } catch {
        setState({ isGenerating: false, progress: 0, resultSrt: null })
        toast.error(t('Subtitle generation failed.'))
        return null
      }
    },
    [t]
  )

  const cancel = useCallback(() => {
    abortRef.current = true
    setState({ isGenerating: false, progress: 0, resultSrt: null })
  }, [])

  const downloadSrt = useCallback(
    (srt: string, filename = 'subtitles.srt') => {
      const blob = new Blob([srt], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    },
    []
  )

  return { ...state, generateSubtitles, cancel, downloadSrt }
}

/**
 * Format seconds as SRT time: HH:MM:SS,mmm
 */
function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const ms = Math.round((seconds % 1) * 1000)
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`
}
