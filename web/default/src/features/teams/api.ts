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

import { api } from '@/lib/api'
import type { ApiResponse, Team, TeamDetail, TeamRole, TeamToken } from './types'

export async function listTeams(): Promise<ApiResponse<Team[]>> {
  const res = await api.get('/api/team/')
  return res.data
}

export async function createTeam(name: string): Promise<ApiResponse<Team>> {
  const res = await api.post('/api/team/', { name })
  return res.data
}

export async function getTeam(id: number): Promise<ApiResponse<TeamDetail>> {
  const res = await api.get(`/api/team/${id}`)
  return res.data
}

export async function addTeamMember(
  teamId: number,
  usernameOrEmail: string,
  role: TeamRole
): Promise<ApiResponse> {
  const res = await api.post(`/api/team/${teamId}/members`, {
    username_or_email: usernameOrEmail,
    role,
  })
  return res.data
}

export async function removeTeamMember(
  teamId: number,
  userId: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/team/${teamId}/members/${userId}`)
  return res.data
}

export async function transferQuotaToTeam(
  teamId: number,
  quota: number
): Promise<ApiResponse> {
  const res = await api.post(`/api/team/${teamId}/quota`, { quota })
  return res.data
}

export async function createTeamToken(
  teamId: number,
  data: {
    name: string
    remain_quota: number
    unlimited_quota: boolean
    expired_time: number
    model_limits_enabled: boolean
    model_limits: string
    allow_ips: string
    group: string
    cross_group_retry: boolean
  }
): Promise<ApiResponse<TeamToken>> {
  const res = await api.post(`/api/team/${teamId}/tokens`, data)
  return res.data
}

export async function updateTeamToken(
  teamId: number,
  tokenId: number,
  data: {
    name: string
    remain_quota: number
    unlimited_quota: boolean
    expired_time: number
    model_limits_enabled: boolean
    model_limits: string
    allow_ips: string
    group: string
    cross_group_retry: boolean
    status?: number
  }
): Promise<ApiResponse<TeamToken>> {
  const res = await api.put(`/api/team/${teamId}/tokens/${tokenId}`, data)
  return res.data
}

export async function updateTeamTokenStatus(
  teamId: number,
  tokenId: number,
  status: number
): Promise<ApiResponse<TeamToken>> {
  const res = await api.put(`/api/team/${teamId}/tokens/${tokenId}?status_only=true`, {
    status,
  })
  return res.data
}

export async function deleteTeamToken(
  teamId: number,
  tokenId: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/team/${teamId}/tokens/${tokenId}`)
  return res.data
}

export async function revealTeamTokenKey(
  teamId: number,
  tokenId: number
): Promise<ApiResponse<{ key: string }>> {
  const res = await api.post(`/api/team/${teamId}/tokens/${tokenId}/key`)
  return res.data
}
