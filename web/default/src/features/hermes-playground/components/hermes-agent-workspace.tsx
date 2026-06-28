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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import {
  Building2Icon,
  FileCheck2Icon,
  ListChecksIcon,
  MessageSquareIcon,
  SparklesIcon,
  UsersIcon,
  WalletCardsIcon,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Main } from '@/components/layout'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  deleteTeamHermesConversation,
  getHermesExecutionTask,
  listTeamHermesConversations,
  upsertTeamHermesConversation,
  type HermesExecutionTask,
  type HermesSkill,
  type HermesTeamConversationRecord,
} from '@/features/hermes-playground/api'
import {
  HermesCapabilityCenter,
  type HermesCapabilitySection,
} from '@/features/hermes-playground/components/hermes-capability-center'
import { HermesExecutionTasksSheet } from '@/features/hermes-playground/components/hermes-execution-tasks-sheet'
import { HermesMessagePlatforms } from '@/features/hermes-playground/components/hermes-message-platforms'
import {
  HermesResults,
  type HermesResultScope,
  type HermesResultType,
} from '@/features/hermes-playground/components/hermes-results'
import { HermesSessionsSheet } from '@/features/hermes-playground/components/hermes-sessions-sheet'
import { HermesSkillDialog } from '@/features/hermes-playground/components/hermes-skill-dialog'
import {
  clearConversationStorage,
  createDefaultConversation,
  createHermesConversation,
  consumeHermesCapabilitiesOpenRequest,
  consumeHermesMessagePlatformsOpenRequest,
  consumeHermesResultsOpenRequest,
  deriveConversationTitle,
  getHermesBaseScope,
  HERMES_CAPABILITIES_OPEN_EVENT,
  HERMES_MESSAGE_PLATFORMS_OPEN_EVENT,
  HERMES_RESULTS_OPEN_EVENT,
  HERMES_SESSIONS_CHANGED_EVENT,
  loadActiveConversationId,
  loadHermesConversations,
  saveActiveConversationId,
  saveHermesConversations,
  SESSION_TOUCH_INTERVAL_MS,
  type HermesConversation,
} from '@/features/hermes-playground/sessions'
import { Playground } from '@/features/playground'
import { DEFAULT_CONFIG } from '@/features/playground/constants'
import {
  createPlaygroundStorageKeys,
  loadMessages,
  saveMessages,
} from '@/features/playground/lib'
import type { Message, ModelOption } from '@/features/playground/types'
import { listTeams } from '@/features/teams/api'
import { formatQuota } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'

export interface HermesPromptSuggestion {
  label: string
  prompt: string
}

export type HermesMessageSection = 'wechat' | 'history' | 'settings'

interface HermesAgentWorkspaceProps {
  baseScopePrefix?: string
  defaultSystemPrompt: string
  emptyModelsMessage: string
  initialCapabilityCategory?: string
  initialCapabilitySection?: HermesCapabilitySection
  initialMessageSection?: HermesMessageSection
  initialPanel?: 'sessions' | 'results' | 'skills' | 'messages' | 'tasks'
  initialResultScope?: HermesResultScope
  initialResultType?: HermesResultType
  initialTeamId?: number
  queryKeyPrefix: string
  suggestedPrompts?: HermesPromptSuggestion[]
  workspaceMode?: 'personal' | 'team'
}

export function HermesAgentWorkspace(props: HermesAgentWorkspaceProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.auth.user?.id)
  const isTeamWorkspace = props.workspaceMode === 'team'
  const queryUserScope = String(userId ?? 'anonymous')
  const [billingOwner, setBillingOwner] = useState(() => {
    if (isTeamWorkspace && props.initialTeamId) {
      return `team:${props.initialTeamId}`
    }
    return isTeamWorkspace ? '' : 'personal'
  })
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false)
  const [editSkill, setEditSkill] = useState<HermesSkill | null>(null)
  const [skillDialogTeamId, setSkillDialogTeamId] = useState<
    number | undefined
  >()
  const [isSessionsOpen, setIsSessionsOpen] = useState(false)
  const [isCapabilityCenterOpen, setIsCapabilityCenterOpen] = useState(false)
  const [isResultsOpen, setIsResultsOpen] = useState(false)
  const [isMessagePlatformsOpen, setIsMessagePlatformsOpen] = useState(false)
  const [isExecutionTasksOpen, setIsExecutionTasksOpen] = useState(false)
  const [quickPromptRequest, setQuickPromptRequest] = useState<{
    id: string
    prompt: string
  } | null>(null)
  const teamPersistTimerRef = useRef<number | null>(null)

  const { data: teamsResponse, isLoading: isTeamsLoading } = useQuery({
    queryKey: [props.queryKeyPrefix, queryUserScope, 'teams'],
    queryFn: listTeams,
  })
  const teams = useMemo(
    () => (teamsResponse?.success ? (teamsResponse.data ?? []) : []),
    [teamsResponse]
  )

  const selectedTeamId = billingOwner.startsWith('team:')
    ? Number(billingOwner.slice('team:'.length))
    : 0
  const selectedTeam = teams.find((team) => team.id === selectedTeamId)
  const selectedTeamName = selectedTeam?.name.trim() || ''

  const selectBillingOwner = useCallback(
    (value: string | null) => {
      if (!value) return
      setBillingOwner(value)
      if (!isTeamWorkspace || !value.startsWith('team:')) return

      const teamId = Number(value.slice('team:'.length))
      if (!Number.isFinite(teamId) || teamId <= 0) return

      void navigate({
        to: '/team-workspace',
        search: {
          team_id: teamId,
          panel: props.initialPanel,
        },
      })
    },
    [isTeamWorkspace, navigate, props.initialPanel]
  )

  const teamConversationsQuery = useQuery({
    queryKey: [
      props.queryKeyPrefix,
      queryUserScope,
      'team-conversations',
      selectedTeamId,
    ],
    queryFn: () => listTeamHermesConversations(selectedTeamId),
    enabled: isTeamWorkspace && selectedTeamId > 0,
  })

  const baseScope = useMemo(() => {
    if (isTeamWorkspace) {
      return selectedTeamId > 0
        ? `team_workspace_team_${selectedTeamId}`
        : 'team_workspace_pending'
    }
    return getHermesBaseScope(userId, props.baseScopePrefix)
  }, [isTeamWorkspace, props.baseScopePrefix, selectedTeamId, userId])

  const [sessions, setSessions] = useState<HermesConversation[]>(() =>
    loadHermesConversations(baseScope)
  )
  const [activeSessionId, setActiveSessionId] = useState(() =>
    loadActiveConversationId(baseScope, sessions)
  )

  useEffect(() => {
    if (isTeamWorkspace && props.initialTeamId) {
      setBillingOwner(`team:${props.initialTeamId}`)
    }
  }, [isTeamWorkspace, props.initialTeamId])

  useEffect(() => {
    if (isTeamWorkspace) {
      const fallbackTeam = teams[0]
      if (!fallbackTeam) return
      if (!teams.some((team) => team.id === selectedTeamId)) {
        setBillingOwner(`team:${fallbackTeam.id}`)
      }
      return
    }

    if (billingOwner === 'personal') return
    if (!teams.some((team) => team.id === selectedTeamId)) {
      setBillingOwner('personal')
    }
  }, [billingOwner, isTeamWorkspace, selectedTeamId, teams])

  useEffect(() => {
    const nextSessions = loadHermesConversations(baseScope)
    setSessions(nextSessions)
    setActiveSessionId(loadActiveConversationId(baseScope, nextSessions))
  }, [baseScope])

  useEffect(() => {
    if (!isTeamWorkspace || selectedTeamId <= 0) return
    if (!teamConversationsQuery.data) return
    if (teamConversationsQuery.data.length === 0) return

    const nextSessions = teamConversationsQuery.data.map((conversation) => {
      const session = normalizePersistedConversation(conversation, baseScope)
      saveMessages(
        conversation.messages,
        createPlaygroundStorageKeys(session.storageScope)
      )
      return session
    })
    saveHermesConversations(baseScope, nextSessions)
    setSessions(nextSessions)
    setActiveSessionId(loadActiveConversationId(baseScope, nextSessions))
  }, [baseScope, isTeamWorkspace, selectedTeamId, teamConversationsQuery.data])

  const reloadSessions = useCallback(() => {
    const nextSessions = loadHermesConversations(baseScope)
    setSessions(nextSessions)
    setActiveSessionId(loadActiveConversationId(baseScope, nextSessions))
  }, [baseScope])

  useEffect(() => {
    window.addEventListener(HERMES_SESSIONS_CHANGED_EVENT, reloadSessions)
    window.addEventListener('storage', reloadSessions)
    return () => {
      window.removeEventListener(HERMES_SESSIONS_CHANGED_EVENT, reloadSessions)
      window.removeEventListener('storage', reloadSessions)
    }
  }, [reloadSessions])

  useEffect(() => {
    if (props.initialPanel === 'messages') {
      setIsMessagePlatformsOpen(true)
      return
    }
    if (props.initialPanel === 'tasks') {
      setIsExecutionTasksOpen(true)
      return
    }
    if (props.initialPanel === 'skills') {
      setIsCapabilityCenterOpen(true)
      return
    }
    if (props.initialPanel === 'results') {
      setIsResultsOpen(true)
      return
    }
    if (
      props.initialPanel === 'sessions' &&
      isTeamWorkspace &&
      selectedTeamId > 0
    ) {
      setIsSessionsOpen(true)
    }
  }, [isTeamWorkspace, props.initialPanel, selectedTeamId])

  useEffect(() => {
    if (consumeHermesCapabilitiesOpenRequest()) {
      setIsCapabilityCenterOpen(true)
    }
    if (consumeHermesResultsOpenRequest()) {
      setIsResultsOpen(true)
    }
    if (consumeHermesMessagePlatformsOpenRequest()) {
      setIsMessagePlatformsOpen(true)
    }

    const openCapabilityCenter = () => setIsCapabilityCenterOpen(true)
    const openResults = () => setIsResultsOpen(true)
    const openMessagePlatforms = () => setIsMessagePlatformsOpen(true)
    window.addEventListener(
      HERMES_CAPABILITIES_OPEN_EVENT,
      openCapabilityCenter
    )
    window.addEventListener(HERMES_RESULTS_OPEN_EVENT, openResults)
    window.addEventListener(
      HERMES_MESSAGE_PLATFORMS_OPEN_EVENT,
      openMessagePlatforms
    )
    return () => {
      window.removeEventListener(
        HERMES_CAPABILITIES_OPEN_EVENT,
        openCapabilityCenter
      )
      window.removeEventListener(HERMES_RESULTS_OPEN_EVENT, openResults)
      window.removeEventListener(
        HERMES_MESSAGE_PLATFORMS_OPEN_EVENT,
        openMessagePlatforms
      )
    }
  }, [])

  const activeSession = useMemo(
    () =>
      sessions.find((session) => session.id === activeSessionId) ??
      sessions[0] ??
      createDefaultConversation(baseScope),
    [activeSessionId, baseScope, sessions]
  )

  const activeHermesSessionId = isTeamWorkspace
    ? `team_workspace_${selectedTeamId || 0}_${activeSession.id}`
    : activeSession.hermesSessionId

  const teamContextPrompt = useMemo(() => {
    if (!isTeamWorkspace || !selectedTeamName) return ''
    return t('Team: {{team}}', { team: selectedTeamName })
  }, [isTeamWorkspace, selectedTeamName, t])

  const defaultConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      model: 'hermes-agent',
      systemPrompt: [props.defaultSystemPrompt, teamContextPrompt]
        .filter(Boolean)
        .join('\n\n'),
    }),
    [props.defaultSystemPrompt, teamContextPrompt]
  )

  const modelFilter = useCallback((model: ModelOption) => {
    return /hermes/i.test(`${model.label} ${model.value}`)
  }, [])

  const requestHeaders = useMemo(() => {
    const headers: Record<string, string> = {
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': activeHermesSessionId,
    }
    if (props.baseScopePrefix) {
      headers['X-Baizor-Hermes-Workspace'] = props.baseScopePrefix
    }
    if (selectedTeamId > 0) {
      headers['X-Baizor-Team-Id'] = String(selectedTeamId)
      if (
        selectedTeamName &&
        !selectedTeamName.includes('\r') &&
        !selectedTeamName.includes('\n') &&
        !selectedTeamName.includes(String.fromCharCode(0))
      ) {
        headers['X-Baizor-Team-Name'] = selectedTeamName
      }
    }
    return headers
  }, [
    activeHermesSessionId,
    props.baseScopePrefix,
    selectedTeamId,
    selectedTeamName,
  ])

  const persistTeamConversation = useCallback(
    (session: HermesConversation, messages: Message[]) => {
      if (!isTeamWorkspace || selectedTeamId <= 0) return
      if (teamPersistTimerRef.current) {
        window.clearTimeout(teamPersistTimerRef.current)
      }
      teamPersistTimerRef.current = window.setTimeout(() => {
        const payload: HermesTeamConversationRecord = {
          ...session,
          messages,
        }
        void upsertTeamHermesConversation(selectedTeamId, payload)
      }, 800)
    },
    [isTeamWorkspace, selectedTeamId]
  )

  const persistTeamConversationNow = useCallback(
    async (session: HermesConversation) => {
      if (!isTeamWorkspace || selectedTeamId <= 0) return
      const messages =
        loadMessages(createPlaygroundStorageKeys(session.storageScope)) ?? []
      const payload: HermesTeamConversationRecord = {
        ...session,
        messages,
      }
      await upsertTeamHermesConversation(selectedTeamId, payload)
      void teamConversationsQuery.refetch()
    },
    [isTeamWorkspace, selectedTeamId, teamConversationsQuery]
  )

  useEffect(() => {
    return () => {
      if (teamPersistTimerRef.current) {
        window.clearTimeout(teamPersistTimerRef.current)
      }
    }
  }, [])

  const updateActiveSessionFromMessages = useCallback(
    (messages: Message[]) => {
      const now = Date.now()
      const title = deriveConversationTitle(messages) ?? activeSession.title
      const sessionToPersist = {
        ...activeSession,
        title,
        updatedAt: now,
      }
      persistTeamConversation(sessionToPersist, messages)

      setSessions((prev) => {
        let changed = false
        const next = prev.map((session) => {
          if (session.id !== activeSession.id) return session
          if (
            session.title === title &&
            now - session.updatedAt < SESSION_TOUCH_INTERVAL_MS
          ) {
            return session
          }

          changed = true
          return sessionToPersist
        })

        if (!changed) return prev
        saveHermesConversations(baseScope, next)
        return next
      })
    },
    [activeSession, baseScope, persistTeamConversation]
  )

  const createSession = useCallback(() => {
    const nextSession = createHermesConversation(baseScope)
    const nextSessions = [nextSession, ...sessions]
    saveHermesConversations(baseScope, nextSessions)
    saveActiveConversationId(baseScope, nextSession.id)
    setSessions(nextSessions)
    setActiveSessionId(nextSession.id)
    persistTeamConversation(nextSession, [])
  }, [baseScope, persistTeamConversation, sessions])

  const selectSession = useCallback(
    (sessionId: string) => {
      saveActiveConversationId(baseScope, sessionId)
      setActiveSessionId(sessionId)
    },
    [baseScope]
  )

  const updateSession = useCallback(
    (
      sessionId: string,
      updater: (session: HermesConversation) => HermesConversation
    ) => {
      let updatedSession: HermesConversation | null = null
      const nextSessions = sessions.map((session) => {
        if (session.id !== sessionId) return session
        updatedSession = { ...updater(session), updatedAt: Date.now() }
        return updatedSession
      })
      if (!updatedSession) return

      saveHermesConversations(baseScope, nextSessions)
      setSessions(nextSessions)
      void persistTeamConversationNow(updatedSession).catch(() => {
        toast.error(t('Failed to save session'))
      })
    },
    [baseScope, persistTeamConversationNow, sessions, t]
  )

  const deleteSession = useCallback(
    (session: HermesConversation) => {
      clearConversationStorage(session)

      const nextSessions = sessions.filter((item) => item.id !== session.id)
      if (nextSessions.length === 0) {
        const nextSession = createHermesConversation(baseScope)
        saveHermesConversations(baseScope, [nextSession])
        saveActiveConversationId(baseScope, nextSession.id)
        setSessions([nextSession])
        setActiveSessionId(nextSession.id)
        persistTeamConversation(nextSession, [])
      } else {
        saveHermesConversations(baseScope, nextSessions)
        setSessions(nextSessions)

        if (activeSessionId === session.id) {
          const nextActive =
            nextSessions.find((item) => !item.archived)?.id ??
            nextSessions[0]?.id
          if (nextActive) {
            saveActiveConversationId(baseScope, nextActive)
            setActiveSessionId(nextActive)
          }
        }
      }

      if (isTeamWorkspace && selectedTeamId > 0) {
        void deleteTeamHermesConversation(selectedTeamId, session.id)
          .then(() => teamConversationsQuery.refetch())
          .catch(() => toast.error(t('Failed to delete session')))
      }
    },
    [
      activeSessionId,
      baseScope,
      isTeamWorkspace,
      persistTeamConversation,
      selectedTeamId,
      sessions,
      t,
      teamConversationsQuery,
    ]
  )

  const exportSession = useCallback(
    (session: HermesConversation) => {
      const messages =
        loadMessages(createPlaygroundStorageKeys(session.storageScope)) ?? []
      downloadJson(
        {
          exportedAt: new Date().toISOString(),
          session,
          messages,
        },
        `${session.title || session.id}.json`
      )
      toast.success(t('Exported'))
    },
    [t]
  )

  const openSessionInNewWindow = useCallback(
    (session: HermesConversation) => {
      saveActiveConversationId(baseScope, session.id)
      const target = isTeamWorkspace
        ? `/team-workspace?team_id=${selectedTeamId}&panel=sessions`
        : '/hermes-playground'
      window.open(target, '_blank', 'noopener,noreferrer')
    },
    [baseScope, isTeamWorkspace, selectedTeamId]
  )

  const exportActiveSession = useCallback(
    (messages: Message[]) => {
      downloadJson(
        {
          exportedAt: new Date().toISOString(),
          session: activeSession,
          messages,
        },
        `${activeSession.title || activeSession.id}.json`
      )
    },
    [activeSession]
  )

  const invalidateExecutionTasks = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['hermes-execution-tasks', queryUserScope],
    })
  }, [queryClient, queryUserScope])

  const applyExecutionTaskResult = useCallback(
    (task: HermesExecutionTask) => {
      if (task.status !== 'succeeded' || !task.responsePayload) return
      const result = extractExecutionTaskAssistantResult(task.responsePayload)
      if (!result.content && !result.reasoningContent) return

      const targetStorageScope = task.storageScope || activeSession.storageScope
      const keys = createPlaygroundStorageKeys(targetStorageScope)
      const existingMessages = loadMessages(keys) ?? []
      const assistantMessage: Message = {
        key: `task-${task.taskId}`,
        from: 'assistant',
        versions: [
          {
            id: `task-${task.taskId}-v1`,
            content: result.content,
          },
        ],
        reasoning: result.reasoningContent
          ? { content: result.reasoningContent, duration: 0 }
          : undefined,
        status: 'complete',
        executionTaskId: task.taskId,
      }

      const lastMessage = existingMessages.at(-1)
      const shouldReplaceLastAssistant =
        lastMessage?.from === 'assistant' &&
        (lastMessage.executionTaskId === task.taskId ||
          lastMessage.status === 'loading' ||
          lastMessage.status === 'streaming' ||
          lastMessage.status === 'error')
      const nextMessages = shouldReplaceLastAssistant
        ? [...existingMessages.slice(0, -1), assistantMessage]
        : [...existingMessages, assistantMessage]
      saveMessages(nextMessages, keys)
      const targetSession =
        sessions.find((session) => session.id === task.conversationId) ??
        activeSession
      if (isTeamWorkspace && selectedTeamId > 0) {
        void upsertTeamHermesConversation(selectedTeamId, {
          ...targetSession,
          messages: nextMessages,
        })
      }
      if (task.conversationId === activeSession.id) {
        updateActiveSessionFromMessages(nextMessages)
      }
    },
    [
      activeSession,
      isTeamWorkspace,
      selectedTeamId,
      sessions,
      updateActiveSessionFromMessages,
    ]
  )

  const openExecutionTask = useCallback(
    async (task: HermesExecutionTask) => {
      if (task.conversationId) {
        const exists = sessions.some(
          (session) => session.id === task.conversationId
        )
        if (!exists) {
          const restoredSession: HermesConversation = {
            id: task.conversationId,
            title: task.title || task.conversationId,
            storageScope:
              task.storageScope ||
              `${baseScope}_session_${task.conversationId}`,
            hermesSessionId: task.hermesSessionId || task.conversationId,
            createdAt: task.createdAt ? task.createdAt * 1000 : Date.now(),
            updatedAt: task.updatedAt ? task.updatedAt * 1000 : Date.now(),
            pinned: false,
            archived: false,
          }
          const nextSessions = [restoredSession, ...sessions]
          saveHermesConversations(baseScope, nextSessions)
          setSessions(nextSessions)
        }
        saveActiveConversationId(baseScope, task.conversationId)
        setActiveSessionId(task.conversationId)
      }

      try {
        const detail = await getHermesExecutionTask(task.taskId)
        applyExecutionTaskResult(detail)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t('Failed to load task')
        )
      }
      setIsExecutionTasksOpen(false)
    },
    [applyExecutionTaskResult, baseScope, sessions, t]
  )

  const openSkillDialog = useCallback((teamId?: number) => {
    setEditSkill(null)
    setSkillDialogTeamId(teamId)
    setIsSkillDialogOpen(true)
  }, [])

  const handleSkillCreated = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['hermes-capabilities', queryUserScope, 'skills'],
    })
  }, [queryClient, queryUserScope])

  const startWithSkill = useCallback(
    (skill: HermesSkill) => {
      setQuickPromptRequest({
        id: `${Date.now()}-${skill.name}`,
        prompt: t('Use the "{{name}}" skill for this task.', {
          name: skill.name,
        }),
      })
      setIsCapabilityCenterOpen(false)
    },
    [t]
  )

  if (isTeamWorkspace && selectedTeamId <= 0) {
    return (
      <Main className='flex min-h-[calc(100vh-var(--app-header-height,0px))] items-center justify-center p-6'>
        <div className='text-center'>
          <Building2Icon className='text-muted-foreground mx-auto mb-3 size-8' />
          <h2 className='text-lg font-semibold'>{t('My Teams')}</h2>
          <p className='text-muted-foreground mt-1 text-sm'>
            {isTeamsLoading
              ? t('Loading teams...')
              : t('Create or join a team to use the team workspace.')}
          </p>
          {!isTeamsLoading && (
            <Button className='mt-4' render={<Link to='/teams' />}>
              <UsersIcon className='size-4' />
              {t('Team management')}
            </Button>
          )}
        </div>
      </Main>
    )
  }

  return (
    <Main className='relative p-0'>
      <div className='absolute top-3 right-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2'>
        {teams.length > 0 && (
          <Select value={billingOwner} onValueChange={selectBillingOwner}>
            <SelectTrigger
              aria-label={t('Billing Ownership')}
              className='bg-background/95 h-8 max-w-[220px] shadow-sm backdrop-blur'
            >
              <SelectValue placeholder={t('Billing Ownership')} />
            </SelectTrigger>
            <SelectContent align='end' alignItemWithTrigger={false}>
              <SelectGroup>
                {!isTeamWorkspace && (
                  <SelectItem value='personal'>
                    <WalletCardsIcon className='size-4' />
                    <span>{t('Personal Wallet')}</span>
                  </SelectItem>
                )}
                {teams.map((team) => (
                  <SelectItem key={team.id} value={`team:${team.id}`}>
                    <Building2Icon className='size-4' />
                    <span className='min-w-0 truncate'>{team.name}</span>
                    <span className='text-muted-foreground text-xs'>
                      {formatQuota(team.quota)}
                    </span>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        )}
        {isTeamWorkspace ? (
          <>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              render={<Link to='/teams' />}
              size='sm'
              type='button'
              variant='outline'
            >
              <UsersIcon className='size-4' />
              <span className='hidden sm:inline'>{t('Team management')}</span>
            </Button>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              onClick={() => setIsMessagePlatformsOpen(true)}
              size='sm'
              type='button'
              variant='outline'
            >
              <MessageSquareIcon className='size-4' />
              <span className='hidden sm:inline'>{t('Message platforms')}</span>
            </Button>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              onClick={() => setIsExecutionTasksOpen(true)}
              size='sm'
              type='button'
              variant='outline'
            >
              <ListChecksIcon className='size-4' />
              <span className='hidden sm:inline'>{t('Execution tasks')}</span>
            </Button>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              onClick={() => setIsSessionsOpen(true)}
              size='sm'
              type='button'
              variant='outline'
            >
              <MessageSquareIcon className='size-4' />
              <span className='hidden sm:inline'>{t('Team sessions')}</span>
            </Button>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              onClick={() => setIsResultsOpen(true)}
              size='sm'
              type='button'
              variant='outline'
            >
              <FileCheck2Icon className='size-4' />
              <span className='hidden sm:inline'>{t('Team results')}</span>
            </Button>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              onClick={() => setIsCapabilityCenterOpen(true)}
              size='sm'
              type='button'
              variant='outline'
            >
              <SparklesIcon className='size-4' />
              <span className='hidden sm:inline'>{t('Team skills')}</span>
            </Button>
          </>
        ) : (
          <>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              onClick={() => setIsCapabilityCenterOpen(true)}
              size='sm'
              type='button'
              variant='outline'
            >
              <SparklesIcon className='size-4' />
              {t('Capabilities')}
            </Button>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              onClick={() => setIsMessagePlatformsOpen(true)}
              size='sm'
              type='button'
              variant='outline'
            >
              <MessageSquareIcon className='size-4' />
              {t('Message platforms')}
            </Button>
            <Button
              className='bg-background/95 shadow-sm backdrop-blur'
              onClick={() => setIsExecutionTasksOpen(true)}
              size='sm'
              type='button'
              variant='outline'
            >
              <ListChecksIcon className='size-4' />
              {t('Execution tasks')}
            </Button>
          </>
        )}
      </div>
      <Playground
        key={activeSession.storageScope}
        defaultConfig={defaultConfig}
        enableSlashCommands
        emptyModelsMessage={props.emptyModelsMessage}
        modelFilter={modelFilter}
        onAddSkill={() =>
          openSkillDialog(isTeamWorkspace ? selectedTeamId : undefined)
        }
        onMessagesChange={updateActiveSessionFromMessages}
        onNewSession={createSession}
        onSaveSession={exportActiveSession}
        queryKeyPrefix={props.queryKeyPrefix}
        quickPromptRequest={quickPromptRequest}
        requestHeaders={requestHeaders}
        executionTaskContext={{
          workspaceMode: isTeamWorkspace
            ? 'team_workspace'
            : props.baseScopePrefix || 'personal',
          conversationId: activeSession.id,
          storageScope: activeSession.storageScope,
          hermesSessionId: activeHermesSessionId,
          teamId: selectedTeamId > 0 ? selectedTeamId : undefined,
          teamName: selectedTeamName || undefined,
          title: activeSession.title,
          onTaskCreated: invalidateExecutionTasks,
          onTaskSettled: (task) => {
            invalidateExecutionTasks()
            applyExecutionTaskResult(task)
          },
        }}
        storageScope={activeSession.storageScope}
        suggestedPrompts={props.suggestedPrompts}
      />
      <HermesSkillDialog
        open={isSkillDialogOpen}
        editSkill={editSkill}
        onOpenChange={(open) => {
          setIsSkillDialogOpen(open)
          if (!open) {
            setEditSkill(null)
            setSkillDialogTeamId(undefined)
          }
        }}
        onCreated={handleSkillCreated}
        teamId={skillDialogTeamId}
      />
      <HermesCapabilityCenter
        open={isCapabilityCenterOpen}
        userScope={queryUserScope}
        initialCategory={props.initialCapabilityCategory}
        initialSection={props.initialCapabilitySection}
        selectedTeamId={selectedTeamId}
        selectedTeamName={selectedTeamName}
        teams={teams}
        onAddSkill={() =>
          openSkillDialog(isTeamWorkspace ? selectedTeamId : undefined)
        }
        onUseSkill={startWithSkill}
        onEditSkill={(skill, teamId) => {
          setEditSkill(skill)
          setSkillDialogTeamId(teamId)
          setIsCapabilityCenterOpen(false)
          setIsSkillDialogOpen(true)
        }}
        onOpenChange={setIsCapabilityCenterOpen}
      />
      <HermesSessionsSheet
        open={isSessionsOpen}
        activeSessionId={activeSessionId}
        description={
          selectedTeam
            ? t('Manage shared sessions for {{team}}.', {
                team: selectedTeam.name,
              })
            : t('Manage shared team sessions.')
        }
        isLoading={teamConversationsQuery.isLoading}
        sessions={sessions}
        title={t('Team sessions')}
        onCreateSession={createSession}
        onDeleteSession={deleteSession}
        onExportSession={exportSession}
        onOpenChange={setIsSessionsOpen}
        onOpenSessionInNewWindow={openSessionInNewWindow}
        onSelectSession={selectSession}
        onUpdateSession={updateSession}
      />
      <HermesResults
        open={isResultsOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        initialScope={props.initialResultScope}
        initialType={props.initialResultType}
        title={isTeamWorkspace ? t('Team results') : undefined}
        description={
          selectedTeam
            ? t('Review shared outputs and files for {{team}}.', {
                team: selectedTeam.name,
              })
            : undefined
        }
        emptyTitle={isTeamWorkspace ? t('No team results yet') : undefined}
        emptyDescription={
          isTeamWorkspace
            ? t(
                'Ask Hermes to produce team reports, documents or analysis results, then review and export them here.'
              )
            : undefined
        }
        onOpenChange={setIsResultsOpen}
        onSelectSession={(sessionId) => {
          saveActiveConversationId(baseScope, sessionId)
          setActiveSessionId(sessionId)
        }}
      />
      <HermesExecutionTasksSheet
        open={isExecutionTasksOpen}
        userScope={queryUserScope}
        teamId={selectedTeamId > 0 ? selectedTeamId : undefined}
        onOpenChange={setIsExecutionTasksOpen}
        onSelectTask={(task) => {
          void openExecutionTask(task)
        }}
      />
      <HermesMessagePlatforms
        open={isMessagePlatformsOpen}
        initialSection={props.initialMessageSection}
        userScope={queryUserScope}
        onOpenChange={setIsMessagePlatformsOpen}
      />
    </Main>
  )
}

function extractExecutionTaskAssistantResult(payload: unknown): {
  content: string
  reasoningContent?: string
} {
  const record = asRecord(payload)
  const choices = Array.isArray(record.choices) ? record.choices : []
  const choice = asRecord(choices[0])
  const message = asRecord(choice.message)
  return {
    content: stringFromUnknown(message.content),
    reasoningContent: stringFromUnknown(message.reasoning_content) || undefined,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function stringFromUnknown(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function normalizePersistedConversation(
  conversation: HermesTeamConversationRecord,
  baseScope: string
): HermesConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    storageScope:
      conversation.storageScope || `${baseScope}_session_${conversation.id}`,
    hermesSessionId: conversation.hermesSessionId || conversation.id,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    pinned: conversation.pinned,
    archived: conversation.archived,
  }
}

function downloadJson(payload: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeDownloadFilename(filename)
  anchor.click()
  URL.revokeObjectURL(url)
}

function sanitizeDownloadFilename(filename: string): string {
  const filenameWithoutPathChars = filename
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, '_')
  const safeName = [...filenameWithoutPathChars]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
  return safeName || 'hermes-session.json'
}
