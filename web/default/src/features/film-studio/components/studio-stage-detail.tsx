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
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
  getStudioCharacters,
  getStudioProject,
  getStudioShots,
  getStudioStages,
} from '../api'
import {
  PIPELINE_STAGES,
  STAGE_STATUS_CONFIG,
  STUDIO_QUERY_KEYS,
  type StageStatusValue,
} from '../constants'

export function StudioStageDetail() {
  const { t } = useTranslation()
  const { projectId, stageKey } = useParams({
    from: '/_authenticated/studio/$projectId/$stageKey/',
  })
  const id = Number(projectId)

  const stageConfig = useMemo(
    () => PIPELINE_STAGES.find((s) => s.key === stageKey),
    [stageKey]
  )

  const { data: projectData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.project(id)],
    queryFn: () => getStudioProject(id),
    enabled: id > 0,
  })

  const { data: stagesData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.stages(id)],
    queryFn: () => getStudioStages(id),
    enabled: id > 0,
  })

  const { data: shotsData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.shots(id)],
    queryFn: () => getStudioShots(id),
    enabled: id > 0 && (stageKey === 'storyboard' || stageKey === 'image_gen' || stageKey === 'video_gen'),
  })

  const { data: charsData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.characters(id)],
    queryFn: () => getStudioCharacters(id),
    enabled: id > 0 && stageKey === 'characters',
  })

  const project = projectData?.data
  const stages = stagesData?.data ?? []
  const stage = stages.find((s) => s.key === stageKey)
  const shots = shotsData?.data ?? []
  const characters = charsData?.data ?? []

  const statusConfig = stage
    ? STAGE_STATUS_CONFIG[stage.status as StageStatusValue]
    : null

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-border flex items-center gap-3 border-b px-6 py-4'>
        <Button variant='ghost' size='icon' className='size-8' asChild>
          <Link
            to='/studio/$projectId'
            params={{ projectId: String(id) }}
          >
            <ArrowLeft className='size-4' />
          </Link>
        </Button>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            {stageConfig ? (
              <span className='text-base' aria-hidden='true'>
                {stageConfig.icon}
              </span>
            ) : null}
            <h1 className='truncate text-lg font-semibold'>
              {stageConfig ? t(stageConfig.labelKey) : stageKey}
            </h1>
          </div>
          {project ? (
            <p className='text-muted-foreground truncate text-xs'>
              {project.name}
              {statusConfig
                ? ` · ${t(statusConfig.labelKey)}`
                : null}
            </p>
          ) : null}
        </div>
      </div>

      {/* Stage content area */}
      <ScrollArea className='flex-1'>
        <div className='mx-auto max-w-4xl p-6'>
          {/* Stage description */}
          {stageConfig ? (
            <p className='text-muted-foreground mb-6 text-sm'>
              {t(stageConfig.descriptionKey)}
            </p>
          ) : null}

          {/* Stage-specific content placeholder */}
          {stageKey === 'characters' && characters.length > 0 ? (
            <div className='space-y-3'>
              <h2 className='text-sm font-medium'>
                {t('Characters')} ({characters.length})
              </h2>
              <div className='grid gap-3 sm:grid-cols-2'>
                {characters.map((char) => (
                  <div
                    key={char.id}
                    className='border-border rounded-lg border p-3'
                  >
                    <h3 className='text-sm font-medium'>{char.name}</h3>
                    {char.description ? (
                      <p className='text-muted-foreground mt-1 text-xs'>
                        {char.description}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {(stageKey === 'storyboard' ||
            stageKey === 'image_gen' ||
            stageKey === 'video_gen') &&
          shots.length > 0 ? (
            <div className='space-y-3'>
              <h2 className='text-sm font-medium'>
                {t('Shots')} ({shots.length})
              </h2>
              <div className='space-y-2'>
                {shots.map((shot) => (
                  <div
                    key={shot.id}
                    className='border-border flex items-start gap-3 rounded-lg border p-3'
                  >
                    <span className='text-muted-foreground shrink-0 text-xs font-mono'>
                      S{shot.scene_number}-{shot.shot_number}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <p className='text-sm'>{shot.description}</p>
                      {shot.camera_angle || shot.camera_move ? (
                        <p className='text-muted-foreground mt-0.5 text-xs'>
                          {[shot.camera_angle, shot.camera_move]
                            .filter(Boolean)
                            .join(' · ')}
                        </p>
                      ) : null}
                    </div>
                    {shot.image_url ? (
                      <img
                        src={shot.image_url}
                        alt={shot.description}
                        className='size-16 shrink-0 rounded object-cover'
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Placeholder for stages with no specific content yet */}
          {stageKey !== 'characters' &&
          stageKey !== 'storyboard' &&
          stageKey !== 'image_gen' &&
          stageKey !== 'video_gen' ? (
            <div className='text-muted-foreground flex h-40 items-center justify-center text-sm'>
              {t('Stage workspace — coming soon.')}
            </div>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}
