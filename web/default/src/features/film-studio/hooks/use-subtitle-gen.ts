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

interface SubtitleGenState {
  isGenerating: boolean
  progress: number // 0-100
  resultSrt: string | null
}

/**
 * Hook for generating SRT subtitle files using Whisper ASR.
 *
 * Primary path: downloads video from shot.video_url, sends to
 * /v1/audio/transcriptions (Whisper relay endpoint) with response_format=srt.
 *
 * Fallback: generates subtitle entries from shot descriptions when video
 * download fails (e.g. CORS restrictions on cross-origin video URLs).
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
      options?: { language?: string }
    ): Promise<string | null> => {
      const shotsToProcess = shots.filter(
        (s) => s.video_url?.trim() || s.description?.trim()
      )
      if (shotsToProcess.length === 0) {
        toast.warning(t('No shots with video or descriptions found.'))
        return null
      }

      abortRef.current = false
      setState({ isGenerating: true, progress: 0, resultSrt: null })

      try {
        const srtLines: string[] = []
        let cumulativeSeconds = 0
        let subtitleIndex = 1
        let usedWhisper = false

        for (let i = 0; i < shotsToProcess.length; i++) {
          if (abortRef.current) break
          const shot = shotsToProcess[i]
          const duration = shot.duration || 5
          const startTime = formatSrtTime(cumulativeSeconds)
          const endTime = formatSrtTime(cumulativeSeconds + duration)

          let subtitleText = ''

          // Try Whisper ASR if video URL is available
          if (shot.video_url?.trim()) {
            try {
              const srt = await transcribeVideo(shot.video_url, options?.language)
              if (srt) {
                // Parse SRT response and offset times
                const entries = parseSrtEntries(srt, cumulativeSeconds)
                for (const entry of entries) {
                  srtLines.push(String(subtitleIndex))
                  srtLines.push(`${entry.start} --> ${entry.end}`)
                  srtLines.push(entry.text)
                  srtLines.push('')
                  subtitleIndex++
                }
                usedWhisper = true
                cumulativeSeconds += duration
                setState((prev) => ({
                  ...prev,
                  progress: Math.round(((i + 1) / shotsToProcess.length) * 100),
                }))
                continue
              }
            } catch {
              // Whisper failed, fall through to fallback
            }
          }

          // Fallback: generate from shot description
          subtitleText =
            shot.description && shot.description.length > 80
              ? shot.description.slice(0, 80) + '...'
              : shot.description || `Shot ${shot.scene_number}-${shot.shot_number}`

          srtLines.push(String(subtitleIndex))
          srtLines.push(`${startTime} --> ${endTime}`)
          srtLines.push(
            `[S${shot.scene_number}-${shot.shot_number}] ${subtitleText}`
          )
          srtLines.push('')
          subtitleIndex++
          cumulativeSeconds += duration

          setState((prev) => ({
            ...prev,
            progress: Math.round(((i + 1) / shotsToProcess.length) * 100),
          }))
        }

        const srt = srtLines.join('\n')
        setState({ isGenerating: false, progress: 100, resultSrt: srt })
        toast.success(
          usedWhisper
            ? t('Subtitles generated with Whisper ASR for {{count}} shots.', {
                count: shotsToProcess.length,
              })
            : t('Subtitles generated from descriptions for {{count}} shots.', {
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

// ============================================================================
// Whisper ASR integration
// ============================================================================

/**
 * Download a video from its URL and send it to the Whisper transcription endpoint.
 * Returns SRT-formatted text, or null on failure.
 */
async function transcribeVideo(
  videoUrl: string,
  language?: string
): Promise<string | null> {
  // Fetch the video as a blob
  const videoResponse = await fetch(videoUrl)
  if (!videoResponse.ok) {
    throw new Error(`Failed to fetch video: ${videoResponse.status}`)
  }
  const videoBlob = await videoResponse.blob()

  // Build FormData for Whisper API
  const formData = new FormData()
  formData.append('file', videoBlob, 'video.mp4')
  formData.append('model', 'whisper-1')
  formData.append('response_format', 'srt')
  if (language) {
    formData.append('language', language)
  }

  // POST to the relay endpoint
  const response = await api.post('/v1/audio/transcriptions', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 120000, // 2 min timeout for transcription
  })

  return typeof response.data === 'string' ? response.data : null
}

// ============================================================================
// SRT parsing helpers
// ============================================================================

interface SrtEntry {
  start: string
  end: string
  text: string
}

/**
 * Parse raw SRT response and offset all timestamps by the given seconds.
 */
function parseSrtEntries(srt: string, offsetSeconds: number): SrtEntry[] {
  const entries: SrtEntry[] = []
  const blocks = srt.trim().split(/\n\n+/)

  for (const block of blocks) {
    const lines = block.trim().split('\n')
    if (lines.length < 3) continue

    // Line 1: index (skip)
    // Line 2: 00:00:01,000 --> 00:00:04,000
    const timeMatch = lines[1].match(
      /(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/
    )
    if (!timeMatch) continue

    entries.push({
      start: offsetSrtTime(timeMatch[1], offsetSeconds),
      end: offsetSrtTime(timeMatch[2], offsetSeconds),
      text: lines.slice(2).join('\n'),
    })
  }

  return entries
}

/**
 * Add offset seconds to an SRT timestamp (HH:MM:SS,mmm).
 */
function offsetSrtTime(timestamp: string, offsetSeconds: number): string {
  const [h, m, s] = timestamp.split(':')
  const [sec, ms] = s.split(',')
  const totalMs =
    parseInt(h) * 3600000 +
    parseInt(m) * 60000 +
    parseInt(sec) * 1000 +
    parseInt(ms) +
    offsetSeconds * 1000

  const h2 = Math.floor(totalMs / 3600000)
  const m2 = Math.floor((totalMs % 3600000) / 60000)
  const s2 = Math.floor((totalMs % 60000) / 1000)
  const ms2 = totalMs % 1000
  return `${String(h2).padStart(2, '0')}:${String(m2).padStart(2, '0')}:${String(s2).padStart(2, '0')},${String(ms2).padStart(3, '0')}`
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
