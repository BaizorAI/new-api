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

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Team {
  id: number
  name: string
  owner_id: number
  quota: number
  used_quota: number
  request_count: number
  status: number
  created_at: number
  updated_at: number
  role: TeamRole
}

export interface TeamMember {
  id: number
  team_id: number
  user_id: number
  role: TeamRole
  status: number
  created_at: number
  updated_at: number
  username: string
  display_name: string
  email: string
}

export interface TeamMemberCandidate {
  id: number
  username: string
  display_name: string
  email: string
}

export interface TeamToken {
  id: number
  user_id: number
  team_id: number
  key: string
  status: number
  name: string
  created_time: number
  accessed_time: number
  expired_time: number
  remain_quota: number
  unlimited_quota: boolean
  model_limits_enabled: boolean
  model_limits: string
  allow_ips: string
  used_quota: number
  group: string
  cross_group_retry: boolean
}

export interface TeamDetail {
  team: Team
  members: TeamMember[]
  tokens: TeamToken[]
}

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}
