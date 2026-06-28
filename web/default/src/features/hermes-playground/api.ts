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
import type { Message } from '@/features/playground/types'
import { api } from '@/lib/api'

import type { HermesConversation } from './sessions'

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
  source: 'user' | 'team' | 'baizor' | 'system' | 'external' | 'unknown'
  ownerScope: 'user' | 'team' | 'baizor' | 'system' | 'external' | 'unknown'
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
  | 'account_saved'
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
  listenerStatus?: 'running' | 'stopped' | 'failed'
  listenerError?: string
  message?: string
  removedAccounts?: number
}

export interface HermesTeamConversationRecord extends HermesConversation {
  messages: Message[]
  createdBy?: number
  updatedBy?: number
}

export type HermesExecutionTaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'canceled'

export interface HermesExecutionTask {
  taskId: string
  userId: number
  teamId: number
  workspaceMode: string
  conversationId: string
  storageScope: string
  hermesSessionId: string
  title: string
  status: HermesExecutionTaskStatus
  progress: number
  responsePayload?: unknown
  error?: string
  createdAt: number
  updatedAt: number
  startedAt?: number
  finishedAt?: number
}

export interface CreateHermesExecutionTaskPayload {
  title?: string
  workspaceMode: string
  conversationId: string
  storageScope: string
  hermesSessionId: string
  teamId?: number
  payload: unknown
}

export async function createHermesExecutionTask(
  payload: CreateHermesExecutionTaskPayload,
  options?: { teamId?: number; teamName?: string }
): Promise<HermesExecutionTask> {
  const response = await api.post('/pg/hermes/execution-tasks', payload, {
    headers: buildHermesTeamHeaders(options?.teamId, options?.teamName),
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return normalizeExecutionTaskResponse(response.data)
}

export async function listHermesExecutionTasks(options?: {
  teamId?: number
  limit?: number
}): Promise<HermesExecutionTask[]> {
  const response = await api.get('/pg/hermes/execution-tasks', {
    params: {
      team_id: options?.teamId,
      limit: options?.limit,
    },
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return normalizeExecutionTasksResponse(response.data)
}

export async function getHermesExecutionTask(
  taskId: string
): Promise<HermesExecutionTask> {
  const response = await api.get(
    `/pg/hermes/execution-tasks/${encodeURIComponent(taskId)}`,
    {
      skipBusinessError: true,
      skipErrorHandler: true,
    }
  )
  return normalizeExecutionTaskResponse(response.data)
}

export async function retryHermesExecutionTask(
  taskId: string
): Promise<HermesExecutionTask> {
  const response = await api.post(
    `/pg/hermes/execution-tasks/${encodeURIComponent(taskId)}/retry`,
    undefined,
    {
      skipBusinessError: true,
      skipErrorHandler: true,
    }
  )
  return normalizeExecutionTaskResponse(response.data)
}

export async function listTeamHermesConversations(
  teamId: number
): Promise<HermesTeamConversationRecord[]> {
  const response = await api.get(`/api/team/${teamId}/hermes/conversations`, {
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return normalizeTeamConversationsResponse(response.data)
}

export async function upsertTeamHermesConversation(
  teamId: number,
  conversation: HermesTeamConversationRecord
) {
  const response = await api.put(
    `/api/team/${teamId}/hermes/conversations/${encodeURIComponent(conversation.id)}`,
    {
      id: conversation.id,
      title: conversation.title,
      storage_scope: conversation.storageScope,
      hermes_session_id: conversation.hermesSessionId,
      pinned: Boolean(conversation.pinned),
      archived: Boolean(conversation.archived),
      messages: conversation.messages,
    },
    {
      skipBusinessError: true,
      skipErrorHandler: true,
    }
  )
  return response.data
}

export async function deleteTeamHermesConversation(
  teamId: number,
  conversationId: string
) {
  const response = await api.delete(
    `/api/team/${teamId}/hermes/conversations/${encodeURIComponent(conversationId)}`,
    {
      skipBusinessError: true,
      skipErrorHandler: true,
    }
  )
  return response.data
}

export async function createHermesSkill(
  payload: CreateHermesSkillPayload,
  options?: { teamId?: number; teamName?: string }
) {
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
        headers: buildHermesTeamHeaders(options?.teamId, options?.teamName),
        skipBusinessError: true,
        skipErrorHandler: true,
      }
    )
    return response.data
  } catch (error) {
    throw new Error(getHermesRequestErrorMessage(error))
  }
}

export async function listHermesSkills(options?: {
  teamId?: number
  teamName?: string
}): Promise<HermesSkill[]> {
  const response = await api.get('/pg/hermes/skills', {
    headers: buildHermesTeamHeaders(options?.teamId, options?.teamName),
    skipBusinessError: true,
    skipErrorHandler: true,
  })
  return normalizeSkillsResponse(response.data)
}

export async function updateHermesSkill(
  name: string,
  payload: {
    name: string
    description: string
    instructions: string
    category?: string
  },
  options?: { teamId?: number; teamName?: string }
) {
  const content = buildSkillContent({
    name: payload.name,
    description: payload.description,
    instructions: payload.instructions,
    category: payload.category,
  })
  try {
    const response = await api.put(
      '/pg/hermes/skills',
      {
        name,
        content,
      },
      {
        headers: buildHermesTeamHeaders(options?.teamId, options?.teamName),
        skipBusinessError: true,
        skipErrorHandler: true,
      }
    )
    return response.data
  } catch (error) {
    throw new Error(getHermesRequestErrorMessage(error))
  }
}

export async function deleteHermesSkill(
  name: string,
  options?: { teamId?: number; teamName?: string }
) {
  try {
    const response = await api.delete('/pg/hermes/skills', {
      data: { name },
      headers: buildHermesTeamHeaders(options?.teamId, options?.teamName),
      skipBusinessError: true,
      skipErrorHandler: true,
    })
    return response.data
  } catch (error) {
    throw new Error(getHermesRequestErrorMessage(error))
  }
}

export async function promoteHermesSkill(
  name: string,
  options?: {
    target?: 'baizor' | 'team' | 'system'
    sourceScope?: 'user' | 'team' | 'baizor'
    teamId?: number
    teamName?: string
  }
) {
  try {
    const response = await api.post(
      '/pg/hermes/skills/promote',
      {
        name,
        target: options?.target,
        source_scope: options?.sourceScope,
      },
      {
        headers: buildHermesTeamHeaders(options?.teamId, options?.teamName),
        skipBusinessError: true,
        skipErrorHandler: true,
      }
    )
    return response.data
  } catch (error) {
    throw new Error(getHermesRequestErrorMessage(error))
  }
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

function buildHermesTeamHeaders(teamId: number | undefined, teamName?: string) {
  if (!teamId || teamId <= 0) return undefined
  const headers: Record<string, string> = { 'X-Baizor-Team-Id': String(teamId) }
  const cleanTeamName = teamName?.trim()
  if (
    cleanTeamName &&
    !cleanTeamName.includes('\r') &&
    !cleanTeamName.includes('\n') &&
    !cleanTeamName.includes(String.fromCharCode(0))
  ) {
    headers['X-Baizor-Team-Name'] = cleanTeamName
  }
  return headers
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

function normalizeExecutionTasksResponse(
  payload: unknown
): HermesExecutionTask[] {
  const record = asRecord(payload)
  const rawTasks = arrayFromUnknown(record.data)
  if (!rawTasks) return []
  return rawTasks.map(normalizeExecutionTask)
}

function normalizeExecutionTaskResponse(payload: unknown): HermesExecutionTask {
  const record = asRecord(payload)
  return normalizeExecutionTask(asRecord(record.data))
}

function normalizeExecutionTask(payload: unknown): HermesExecutionTask {
  const task = asRecord(payload)
  return {
    taskId: stringFromUnknown(task.task_id),
    userId: numberFromUnknown(task.user_id) ?? 0,
    teamId: numberFromUnknown(task.team_id) ?? 0,
    workspaceMode: stringFromUnknown(task.workspace_mode),
    conversationId: stringFromUnknown(task.conversation_id),
    storageScope: stringFromUnknown(task.storage_scope),
    hermesSessionId: stringFromUnknown(task.hermes_session_id),
    title: stringFromUnknown(task.title) || 'Hermes task',
    status: normalizeExecutionTaskStatus(stringFromUnknown(task.status)),
    progress: numberFromUnknown(task.progress) ?? 0,
    responsePayload: task.response_payload,
    error: stringFromUnknown(task.error) || undefined,
    createdAt: numberFromUnknown(task.created_at) ?? 0,
    updatedAt: numberFromUnknown(task.updated_at) ?? 0,
    startedAt: numberFromUnknown(task.started_at) ?? undefined,
    finishedAt: numberFromUnknown(task.finished_at) ?? undefined,
  }
}

function normalizeTeamConversationsResponse(
  payload: unknown
): HermesTeamConversationRecord[] {
  const record = asRecord(payload)
  const rawConversations = arrayFromUnknown(record.data)
  if (!rawConversations) return []

  return rawConversations.map((item) => {
    const conversation = asRecord(item)
    return {
      id: stringFromUnknown(conversation.id),
      title: stringFromUnknown(conversation.title),
      storageScope: stringFromUnknown(conversation.storage_scope),
      hermesSessionId: stringFromUnknown(conversation.hermes_session_id),
      createdAt: numberFromUnknown(conversation.created_at) ?? Date.now(),
      updatedAt: numberFromUnknown(conversation.updated_at) ?? Date.now(),
      pinned: booleanFromUnknown(conversation.pinned) ?? false,
      archived: booleanFromUnknown(conversation.archived) ?? false,
      createdBy: numberFromUnknown(conversation.created_by) ?? undefined,
      updatedBy: numberFromUnknown(conversation.updated_by) ?? undefined,
      messages: (arrayFromUnknown(conversation.messages) ?? []) as Message[],
    }
  })
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
    listenerStatus: normalizeWeixinListenerStatus(
      stringFromUnknown(record.listener_status)
    ),
    listenerError: stringFromUnknown(record.listener_error) || undefined,
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

function normalizeExecutionTaskStatus(
  value: string
): HermesExecutionTaskStatus {
  if (
    value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed' ||
    value === 'canceled'
  ) {
    return value
  }
  return 'failed'
}

function normalizeSource(value: string): HermesSkill['source'] {
  if (
    value === 'user' ||
    value === 'team' ||
    value === 'baizor' ||
    value === 'system' ||
    value === 'external'
  ) {
    return value
  }
  return 'unknown'
}

function normalizeWeixinStatus(value: string): HermesWeixinStatusValue {
  if (
    value === 'disabled' ||
    value === 'not_connected' ||
    value === 'account_saved' ||
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

function normalizeWeixinListenerStatus(
  value: string
): HermesWeixinStatus['listenerStatus'] {
  if (value === 'running' || value === 'stopped' || value === 'failed') {
    return value
  }
  return undefined
}

function normalizeOwnerScope(value: string): HermesSkill['ownerScope'] {
  if (
    value === 'user' ||
    value === 'team' ||
    value === 'baizor' ||
    value === 'system' ||
    value === 'external'
  ) {
    return value
  }
  return 'unknown'
}
