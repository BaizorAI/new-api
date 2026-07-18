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

For commercial licensing, please contact support@quantumnous.com>
*/
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { StudioShot } from '../types'
import type { AssemblyPlan } from './use-ai-assembly'

/**
 * Hook for exporting Adobe Premiere Pro XML project files.
 *
 * Generates an FCP7-compatible XML that can be imported into
 * Premiere Pro, DaVinci Resolve, or Final Cut Pro.
 */
export function usePrExport() {
  const { t } = useTranslation()

  const exportXml = useCallback(
    (
      projectName: string,
      shots: StudioShot[],
      plan?: AssemblyPlan | null
    ) => {
      const shotsWithMedia = shots.filter((s) => s.video_url || s.image_url)
      if (shotsWithMedia.length === 0) {
        toast.warning(t('No media to export. Generate images or videos first.'))
        return
      }

      const fps = plan?.delivery_specs?.framerate ?? 24

      const xmlParts: string[] = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<!DOCTYPE xmeml>',
        '<xmeml version="5">',
        '<project>',
        `  <name>${escapeXml(projectName)}</name>`,
        '  <children>',
        '    <sequence id="sequence-1">',
        `      <name>Timeline 1</name>`,
        `      <duration>${shotsWithMedia.length * 200}</duration>`,
        '      <rate>',
        `        <timebase>${fps}</timebase>`,
        `        <ntsc>${fps === 24 || fps === 30 ? 'TRUE' : 'FALSE'}</ntsc>`,
        '      </rate>',
        '      <media>',
        '        <video>',
        '          <track>',
      ]

      let cumulativeFrames = 0

      for (let i = 0; i < shotsWithMedia.length; i++) {
        const shot = shotsWithMedia[i]
        const clipName = `S${shot.scene_number}-S${shot.shot_number}`
        const durationFrames = Math.round((shot.duration || 5) * fps)
        const srcUrl = shot.video_url || shot.image_url || ''
        const isVideo = !!shot.video_url

        const timelineEntry = plan?.timeline?.find(
          (t) => t.clip_ref === clipName
        )

        xmlParts.push(
          '            <clipitem id="shot-' + shot.id + '">',
          `              <name>${escapeXml(clipName)}</name>`,
          `              <duration>${durationFrames}</duration>`,
          '              <rate>',
          `                <timebase>${fps}</timebase>`,
          `                <ntsc>${fps === 24 || fps === 30 ? 'TRUE' : 'FALSE'}</ntsc>`,
          '              </rate>',
          `              <start>0</start>`,
          `              <end>${durationFrames}</end>`,
          '              <enabled>TRUE</enabled>',
          '              <in>0</in>',
          `              <out>${durationFrames}</out>`,
          `              <file id="file-${shot.id}">`,
          `                <name>${escapeXml(clipName)}.${isVideo ? 'mp4' : 'png'}</name>`,
          `                <pathurl>file://localhost/${encodeURI(srcUrl)}</pathurl>`,
          '                <rate>',
          `                  <timebase>${fps}</timebase>`,
          `                  <ntsc>${fps === 24 || fps === 30 ? 'TRUE' : 'FALSE'}</ntsc>`,
          '                </rate>',
          `                <duration>${durationFrames}</duration>`,
          '                <media>',
          '                  <video>',
          '                    <track>',
          `                      <clipitem id="video-${shot.id}"/>`,
          '                    </track>',
          '                  </video>',
          ...(isVideo
            ? [
                '                  <audio>',
                '                    <track>',
                `                      <clipitem id="audio-${shot.id}"/>`,
                '                    </track>',
                '                  </audio>',
              ]
            : []),
          '                </media>',
          '              </file>',
        )

        // Add transition if specified in assembly plan
        if (timelineEntry?.transition_in && timelineEntry.transition_in !== 'cut') {
          xmlParts.push(
            '              <transition>',
            '                <effect>',
            `                  <name>${escapeXml(timelineEntry.transition_in)}</name>`,
            `                  <effectid>${escapeXml(timelineEntry.transition_in)}</effectid>`,
            '                  <effecttype>transition</effecttype>',
            '                  <mediatype>video</mediatype>',
            '                  <parameter authoringApp="PremierePro">',
            '                    <parameterid>alignment</parameterid>',
            '                    <name>Alignment</name>',
            '                    <valuemin>0</valuemin>',
            '                    <valuemax>3</valuemax>',
            '                    <value>1</value>',
            '                  </parameter>',
            '                  <parameter authoringApp="PremierePro">',
            '                    <parameterid>start</parameterid>',
            '                    <name>Start</name>',
            '                    <valuemin>0</valuemin>',
            '                    <valuemax>100</valuemax>',
            '                    <value>0</value>',
            '                  </parameter>',
            '                  <parameter authoringApp="PremierePro">',
            '                    <parameterid>end</parameterid>',
            '                    <name>End</name>',
            '                    <valuemin>0</valuemin>',
            '                    <valuemax>100</valuemax>',
            '                    <value>100</value>',
            '                  </parameter>',
            '                </effect>',
            '              </transition>',
          )
        }

        xmlParts.push('            </clipitem>')
        cumulativeFrames += durationFrames
      }

      xmlParts.push(
        '          </track>',
        '        </video>',
        '        <audio>',
        '          <track>',
        '            <enabled>TRUE</enabled>',
        '          </track>',
        '        </audio>',
        '      </media>',
      )

      // Add color grading LUT reference if specified
      if (plan?.color_grading?.overall_lut) {
        xmlParts.push(
          '      <filter>',
          '        <effect>',
          `          <name>Color Grading</name>`,
          `          <effectid>color_grade</effectid>`,
          '          <effecttype>video</effecttype>',
          '          <parameter>',
          '            <name>LUT</name>',
          `            <value>${escapeXml(plan.color_grading.overall_lut)}</value>`,
          '          </parameter>',
          '        </effect>',
          '      </filter>',
        )
      }

      xmlParts.push(
        '    </sequence>',
        '  </children>',
        '</project>',
        '</xmeml>',
      )

      const xml = xmlParts.join('\n')
      downloadFile(xml, `${projectName.replace(/\s+/g, '_')}_premiere.xml`, 'text/xml')
      toast.success(t('Premiere project exported.'))
    },
    [t]
  )

  return { exportXml }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function downloadFile(
  content: string,
  filename: string,
  mimeType: string
) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
