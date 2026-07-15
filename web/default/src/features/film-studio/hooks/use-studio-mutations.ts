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
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  createStudioCharacter,
  createStudioShots,
  deleteStudioCharacter,
  deleteStudioShot,
  updateStudioCharacter,
  updateStudioShot,
  updateStudioStage,
} from '../api'
import { STUDIO_QUERY_KEYS, SUCCESS_MESSAGES } from '../constants'
import type { StudioCharacterFormData, StudioShotFormData } from '../types'

// ============================================================================
// Stage Mutations
// ============================================================================

export function useUpdateStudioStage(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: {
      key: string
      data: {
        status?: number
        total_items?: number
        done_items?: number
        output_data?: string
      }
    }) => updateStudioStage(projectId, params.key, params.data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.STAGE_UPDATED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.stages(projectId)],
        })
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.project(projectId)],
        })
      }
    },
  })
}

// ============================================================================
// Character Mutations
// ============================================================================

export function useCreateStudioCharacter(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: StudioCharacterFormData) =>
      createStudioCharacter(projectId, data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.CHARACTER_CREATED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)],
        })
      }
    },
  })
}

export function useUpdateStudioCharacter(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: {
      charId: number
      data: Partial<StudioCharacterFormData>
    }) => updateStudioCharacter(projectId, params.charId, params.data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.CHARACTER_UPDATED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)],
        })
      }
    },
  })
}

export function useDeleteStudioCharacter(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (charId: number) =>
      deleteStudioCharacter(projectId, charId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.CHARACTER_DELETED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)],
        })
      }
    },
  })
}

// ============================================================================
// Shot Mutations
// ============================================================================

export function useCreateStudioShot(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: StudioShotFormData) =>
      createStudioShots(projectId, [data]),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.SHOT_CREATED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.shots(projectId)],
        })
      }
    },
  })
}

export function useUpdateStudioShot(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (params: {
      shotId: number
      data: Partial<
        StudioShotFormData & {
          image_url: string
          video_url: string
          video_task_id: string
          status: number
        }
      >
    }) => updateStudioShot(projectId, params.shotId, params.data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.SHOT_UPDATED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.shots(projectId)],
        })
      }
    },
  })
}

export function useDeleteStudioShot(projectId: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (shotId: number) => deleteStudioShot(projectId, shotId),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.SHOT_DELETED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.shots(projectId)],
        })
      }
    },
  })
}
