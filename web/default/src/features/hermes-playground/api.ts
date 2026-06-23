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

export type HermesWeixinStatusValue =
  | 'disabled'
  | 'not_connected'
  | 'qr_ready'
  | 'scanned'
  | 'connected'
  | 'expired'
  | 'failed'
  | 'disconnected'

export interface HermesWeixinStatus {
  platform: 'weixin'
  status: HermesWeixinStatusValue
  enabled: boolean
  requestId?: string
  qrcode?: string
  qrcodeUrl?: string
  expiresAt?: number
  accountLabel?: string
  connectedAt?: string | number
  message?: string
  removedAccounts?: number
}

export async function createHermesSkill(payload: CreateHermesSkillPayload) {
  const content = buildSkillContent(payload)
  try {
    const response = await api.post(
      '/pg/hermes/skills',
      {
        name: payload.name,
        category: payload.category,
        content,
      },
      {
        skipBusinessError: true,
        skipErrorHandler: true,
      }
    )
    return response.data
  } catch (error) {
    throw new Error(getHermesRequestErrorMessage(error))
  }
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

export async function getHermesWeixinStatus(): Promise<HermesWeixinStatus> {
  const response = await api.get('/pg/hermes/platforms/weixin/status', {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return normalizeWeixinStatusResponse(response.data)
}

export async function createHermesWeixinQR(): Promise<HermesWeixinStatus> {
  const response = await api.post('/pg/hermes/platforms/weixin/qr', undefined, {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return normalizeWeixinStatusResponse(response.data)
}

export async function getHermesWeixinQRStatus(
  requestId: string
): Promise<HermesWeixinStatus> {
  const response = await api.get(
    `/pg/hermes/platforms/weixin/qr/${encodeURIComponent(requestId)}`,
    {
      skipBusinessError: true,
      skipErrorHandler: true,
    }
  )
  return normalizeWeixinStatusResponse(response.data)
}

export async function disconnectHermesWeixin(): Promise<HermesWeixinStatus> {
  const response = await api.post(
    '/pg/hermes/platforms/weixin/disconnect',
    undefined,
    {
      skipBusinessError: true,
      skipErrorHandler: true,
    }
  )
  return normalizeWeixinStatusResponse(response.data)
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

function getHermesRequestErrorMessage(error: unknown): string {
  const errorRecord = asRecord(error)
  const response = asRecord(errorRecord.response)
  const data = asRecord(response.data)
  const hermesError = asRecord(data.error)
  const hermesMessage = stringFromUnknown(hermesError.message)
  if (hermesMessage) return hermesMessage

  const message = stringFromUnknown(data.message)
  if (message) return message

  const fallback = stringFromUnknown(errorRecord.message)
  if (fallback) return fallback

  return 'Failed to add skill'
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

function normalizeWeixinStatusResponse(payload: unknown): HermesWeixinStatus {
  const record = asRecord(payload)
  const status = normalizeWeixinStatus(stringFromUnknown(record.status))
  return {
    platform: 'weixin',
    status,
    enabled: booleanFromUnknown(record.enabled) ?? status !== 'disabled',
    requestId: stringFromUnknown(record.request_id) || undefined,
    qrcode: stringFromUnknown(record.qrcode) || undefined,
    qrcodeUrl: stringFromUnknown(record.qrcode_url) || undefined,
    expiresAt: numberFromUnknown(record.expires_at) ?? undefined,
    accountLabel: stringFromUnknown(record.account_label) || undefined,
    connectedAt:
      stringFromUnknown(record.connected_at) ||
      numberFromUnknown(record.connected_at) ||
      undefined,
    message: stringFromUnknown(record.message) || undefined,
    removedAccounts: numberFromUnknown(record.removed_accounts) ?? undefined,
  }
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

function numberFromUnknown(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function normalizeSource(value: string): HermesSkill['source'] {
  if (value === 'user' || value === 'system' || value === 'external') {
    return value
  }
  return 'unknown'
}

function normalizeWeixinStatus(value: string): HermesWeixinStatusValue {
  if (
    value === 'disabled' ||
    value === 'not_connected' ||
    value === 'qr_ready' ||
    value === 'scanned' ||
    value === 'connected' ||
    value === 'expired' ||
    value === 'failed' ||
    value === 'disconnected'
  ) {
    return value
  }
  return 'failed'
}

function normalizeOwnerScope(value: string): HermesSkill['ownerScope'] {
  if (value === 'user' || value === 'system' || value === 'external') {
    return value
  }
  return 'unknown'
}
