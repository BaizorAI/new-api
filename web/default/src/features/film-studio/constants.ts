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
import { type TFunction } from 'i18next'

import type { StatusBadgeProps } from '@/components/status-badge'

import type { StageKey } from './types'

// ============================================================================
// Project Status
// ============================================================================

export const PROJECT_STATUS = {
  DRAFT: 1,
  IN_PROGRESS: 2,
  COMPLETED: 3,
  ARCHIVED: 4,
} as const

export type ProjectStatusValue =
  (typeof PROJECT_STATUS)[keyof typeof PROJECT_STATUS]

export const PROJECT_STATUS_CONFIG: Record<
  ProjectStatusValue,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  [PROJECT_STATUS.DRAFT]: { labelKey: 'Draft', variant: 'neutral' },
  [PROJECT_STATUS.IN_PROGRESS]: {
    labelKey: 'In Progress',
    variant: 'info',
  },
  [PROJECT_STATUS.COMPLETED]: {
    labelKey: 'Completed',
    variant: 'success',
  },
  [PROJECT_STATUS.ARCHIVED]: {
    labelKey: 'Archived',
    variant: 'warning',
  },
}

export function getProjectStatusOptions(t: TFunction) {
  return (
    Object.entries(PROJECT_STATUS_CONFIG) as [
      string,
      (typeof PROJECT_STATUS_CONFIG)[ProjectStatusValue],
    ][]
  ).map(([value, config]) => ({
    label: t(config.labelKey),
    value: Number(value),
  }))
}

// ============================================================================
// Stage Status
// ============================================================================

export const STAGE_STATUS = {
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2,
  NEEDS_REVISION: 3,
} as const

export type StageStatusValue =
  (typeof STAGE_STATUS)[keyof typeof STAGE_STATUS]

export const STAGE_STATUS_CONFIG: Record<
  StageStatusValue,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  [STAGE_STATUS.NOT_STARTED]: {
    labelKey: 'Not Started',
    variant: 'neutral',
  },
  [STAGE_STATUS.IN_PROGRESS]: {
    labelKey: 'In Progress',
    variant: 'info',
  },
  [STAGE_STATUS.COMPLETED]: {
    labelKey: 'Completed',
    variant: 'success',
  },
  [STAGE_STATUS.NEEDS_REVISION]: {
    labelKey: 'Needs Revision',
    variant: 'warning',
  },
}

// ============================================================================
// Shot Status
// ============================================================================

export const SHOT_STATUS = {
  PENDING: 0,
  GENERATING: 1,
  COMPLETED: 2,
  FAILED: 3,
} as const

// ============================================================================
// Pipeline Stage Configuration (7-stage pipeline)
// ============================================================================

export interface StageConfig {
  key: StageKey
  labelKey: string
  descriptionKey: string
  icon: string
}

export const PIPELINE_STAGES: StageConfig[] = [
  {
    key: 'script',
    labelKey: 'Script Writing',
    descriptionKey: 'Write screenplay, dialogue and scene descriptions.',
    icon: '📝',
  },
  {
    key: 'characters',
    labelKey: 'Character Design',
    descriptionKey: 'Define characters with visual prompts and references.',
    icon: '👤',
  },
  {
    key: 'storyboard',
    labelKey: 'Storyboard',
    descriptionKey: 'Break script into shots with camera and timing.',
    icon: '🎬',
  },
  {
    key: 'image_gen',
    labelKey: 'Image Generation',
    descriptionKey: 'Generate key frame images for each shot.',
    icon: '🖼️',
  },
  {
    key: 'video_gen',
    labelKey: 'Video Generation',
    descriptionKey: 'Generate video clips from images and prompts.',
    icon: '🎥',
  },
  {
    key: 'post',
    labelKey: 'Post-Production',
    descriptionKey: 'Add transitions, audio, subtitles and effects.',
    icon: '✂️',
  },
  {
    key: 'review',
    labelKey: 'Review & Export',
    descriptionKey: 'Final review, adjustments and export.',
    icon: '✅',
  },
]

export function getStageLabelKey(key: string): string {
  return PIPELINE_STAGES.find((s) => s.key === key)?.labelKey ?? key
}

// ============================================================================
// Genre Options
// ============================================================================

export const GENRE_OPTIONS = [
  'short_film',
  'commercial',
  'music_video',
  'animation',
  'documentary',
  'other',
] as const

export function getGenreOptions(t: TFunction) {
  const labels: Record<string, string> = {
    short_film: 'Short Film',
    commercial: 'Commercial',
    music_video: 'Music Video',
    animation: 'Animation',
    documentary: 'Documentary',
    other: 'Other',
  }
  return GENRE_OPTIONS.map((genre) => ({
    label: t(labels[genre] ?? genre),
    value: genre,
  }))
}

// ============================================================================
// Query Keys
// ============================================================================

export const STUDIO_QUERY_KEYS = {
  projects: ['studio-projects'] as const,
  project: (id: number) => ['studio-project', id] as const,
  stages: (projectId: number) => ['studio-stages', projectId] as const,
  shots: (projectId: number) => ['studio-shots', projectId] as const,
  characters: (projectId: number) =>
    ['studio-characters', projectId] as const,
} as const

// ============================================================================
// Success Messages (i18n keys)
// ============================================================================

export const SUCCESS_MESSAGES = {
  PROJECT_CREATED: 'Project created.',
  PROJECT_UPDATED: 'Project updated.',
  PROJECT_DELETED: 'Project deleted.',
  STAGE_UPDATED: 'Stage updated.',
  SHOT_CREATED: 'Shot created.',
  SHOT_UPDATED: 'Shot updated.',
  SHOT_DELETED: 'Shot deleted.',
  CHARACTER_CREATED: 'Character created.',
  CHARACTER_UPDATED: 'Character updated.',
  CHARACTER_DELETED: 'Character deleted.',
} as const
