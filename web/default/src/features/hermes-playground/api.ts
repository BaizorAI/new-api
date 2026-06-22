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

export interface CreateHermesSkillPayload {
  name: string
  description: string
  instructions: string
  category?: string
}

export interface HermesSkill {
  name: string
  description: string
  category?: string
  path?: string
  source: 'user' | 'system' | 'external' | 'unknown'
  ownerScope: 'user' | 'system' | 'external' | 'unknown'
  isUserCreated: boolean
}

export interface HermesToolset {
  name: string
  label: string
  description: string
  enabled: boolean
  configured: boolean
  tools: string[]
}

export async function createHermesSkill(payload: CreateHermesSkillPayload) {
  const content = buildSkillContent(payload)
  const response = await api.post(
    '/pg/hermes/skills',
    {
      name: payload.name,
      category: payload.category,
      content,
    },
    {
      skipBusinessError: true,
    }
  )
  return response.data
}

export async function listHermesSkills(): Promise<HermesSkill[]> {
  const response = await api.get('/pg/hermes/skills', {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return normalizeSkillsResponse(response.data)
}

export async function listHermesToolsets(): Promise<HermesToolset[]> {
  const response = await api.get('/pg/hermes/toolsets', {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return normalizeToolsetsResponse(response.data)
}

function buildSkillContent(payload: CreateHermesSkillPayload): string {
  const description = payload.description.trim()
  const instructions = payload.instructions.trim()

  return `---
name: ${quoteYamlString(payload.name.trim())}
description: ${quoteYamlString(description)}
---

# ${payload.name.trim()}

${instructions}
`
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value)
}

function normalizeSkillsResponse(payload: unknown): HermesSkill[] {
  const record = asRecord(payload)
  const rawSkills =
    arrayFromUnknown(record.data) ?? arrayFromUnknown(record.skills)
  if (!rawSkills) return []

  return rawSkills.map((item) => {
    const skill = asRecord(item)
    const source = normalizeSource(stringFromUnknown(skill.source))
    const ownerScope = normalizeOwnerScope(stringFromUnknown(skill.owner_scope))
    const isUserCreated =
      booleanFromUnknown(skill.is_user_created) ??
      (source === 'user' || ownerScope === 'user')

    return {
      name: stringFromUnknown(skill.name) || 'Unnamed skill',
      description: stringFromUnknown(skill.description),
      category: stringFromUnknown(skill.category) || undefined,
      path: stringFromUnknown(skill.path) || undefined,
      source,
      ownerScope,
      isUserCreated,
    }
  })
}

function normalizeToolsetsResponse(payload: unknown): HermesToolset[] {
  const record = asRecord(payload)
  const rawToolsets = arrayFromUnknown(record.data)
  if (!rawToolsets) return []

  return rawToolsets.map((item) => {
    const toolset = asRecord(item)
    return {
      name: stringFromUnknown(toolset.name) || 'unknown',
      label:
        stringFromUnknown(toolset.label) ||
        stringFromUnknown(toolset.name) ||
        'Unknown',
      description: stringFromUnknown(toolset.description),
      enabled: booleanFromUnknown(toolset.enabled) ?? false,
      configured: booleanFromUnknown(toolset.configured) ?? false,
      tools: (arrayFromUnknown(toolset.tools) ?? [])
        .map((tool) => stringFromUnknown(tool))
        .filter((tool) => tool.length > 0),
    }
  })
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function arrayFromUnknown(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value : null
}

function stringFromUnknown(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function booleanFromUnknown(value: unknown): boolean | null {
  return typeof value === 'boolean' ? value : null
}

function normalizeSource(value: string): HermesSkill['source'] {
  if (value === 'user' || value === 'system' || value === 'external') {
    return value
  }
  return 'unknown'
}

function normalizeOwnerScope(value: string): HermesSkill['ownerScope'] {
  if (value === 'user' || value === 'system' || value === 'external') {
    return value
  }
  return 'unknown'
}
