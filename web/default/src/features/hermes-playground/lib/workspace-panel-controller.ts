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
export const HERMES_CAPABILITY_SECTIONS = [
  'mine',
  'team',
  'baizor',
  'builtin',
  'tools',
] as const

export const HERMES_MESSAGE_SECTIONS = [
  'overview',
  'wechat',
  'history',
  'settings',
] as const

export const HERMES_ROUTE_SECTIONS = [
  ...HERMES_CAPABILITY_SECTIONS,
  ...HERMES_MESSAGE_SECTIONS,
] as const

export const HERMES_PERSONAL_PANELS = [
  'skills',
  'messages',
  'results',
  'tasks',
] as const

export const HERMES_TEAM_PANELS = [
  'sessions',
  ...HERMES_PERSONAL_PANELS,
] as const

export const HERMES_RESULT_SCOPES = ['all', 'mine', 'team'] as const
export const HERMES_RESULT_TYPES = [
  'all',
  'ppt',
  'report',
  'document',
  'attachment',
] as const

export type HermesCapabilitySection =
  (typeof HERMES_CAPABILITY_SECTIONS)[number]
export type HermesMessageSection = (typeof HERMES_MESSAGE_SECTIONS)[number]
export type HermesPersonalPanel = (typeof HERMES_PERSONAL_PANELS)[number]
export type HermesTeamPanel = (typeof HERMES_TEAM_PANELS)[number]

export function isHermesCapabilitySection(
  value: unknown
): value is HermesCapabilitySection {
  return HERMES_CAPABILITY_SECTIONS.includes(
    value as HermesCapabilitySection
  )
}

export function isHermesMessageSection(
  value: unknown
): value is HermesMessageSection {
  return HERMES_MESSAGE_SECTIONS.includes(value as HermesMessageSection)
}
