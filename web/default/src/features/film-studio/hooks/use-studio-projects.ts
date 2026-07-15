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
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { toast } from 'sonner'

import {
  createStudioProject,
  deleteStudioProject,
  getStudioProject,
  getStudioProjects,
  updateStudioProject,
} from '../api'
import { STUDIO_QUERY_KEYS, SUCCESS_MESSAGES } from '../constants'
import type { StudioProjectFormData } from '../types'

export function useStudioProjects(params?: {
  p?: number
  page_size?: number
  status?: number
}) {
  return useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.projects, params],
    queryFn: () => getStudioProjects(params),
  })
}

export function useStudioProject(id: number) {
  return useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.project(id)],
    queryFn: () => getStudioProject(id),
    enabled: id > 0,
  })
}

export function useCreateStudioProject() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: StudioProjectFormData) => createStudioProject(data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.PROJECT_CREATED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.projects],
        })
      }
    },
  })
}

export function useUpdateStudioProject(id: number) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: Partial<StudioProjectFormData & { status: number }>) =>
      updateStudioProject(id, data),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.PROJECT_UPDATED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.projects],
        })
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.project(id)],
        })
      }
    },
  })
}

export function useDeleteStudioProject() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: number) => deleteStudioProject(id),
    onSuccess: (res) => {
      if (res.success) {
        toast.success(t(SUCCESS_MESSAGES.PROJECT_DELETED))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.projects],
        })
      }
    },
  })
}
