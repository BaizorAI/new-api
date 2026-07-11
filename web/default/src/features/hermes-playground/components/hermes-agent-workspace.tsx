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
import { Building2Icon, UsersIcon, WalletCardsIcon } from 'lucide-react'
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
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
  deleteUserHermesConversation,
  getHermesExecutionTask,
  listHermesSkills,
  listTeamHermesConversations,
  listUserHermesConversations,
  syncHermesResults,
  upsertTeamHermesConversation,
  upsertUserHermesConversation,
  type HermesExecutionTask,
  type HermesSkill,
  type HermesTeamConversationRecord,
  type HermesUserConversationRecord,
} from '@/features/hermes-playground/api'
import {
  HermesCapabilityCenter,
  HermesCapabilityCenterWorkspace,
} from '@/features/hermes-playground/components/hermes-capability-center'
import {
  HermesExecutionTasksSheet,
  HermesExecutionTasksWorkspace,
} from '@/features/hermes-playground/components/hermes-execution-tasks-sheet'
import {
  HermesMessagePlatforms,
  HermesMessagePlatformsWorkspace,
} from '@/features/hermes-playground/components/hermes-message-platforms'
import {
  HermesResults,
  HermesResultsWorkspace,
  type HermesResultScope,
  type HermesResultType,
} from '@/features/hermes-playground/components/hermes-results'
import { HermesSessionsSheet } from '@/features/hermes-playground/components/hermes-sessions-sheet'
import { HermesSkillDialog } from '@/features/hermes-playground/components/hermes-skill-dialog'
import type {
  HermesCapabilitySection,
  HermesMessageSection,
  HermesPersonalPanel,
  HermesTeamPanel,
} from '@/features/hermes-playground/lib/workspace-panel-controller'
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
  HERMES_SESSION_DELETED_EVENT,
  loadActiveConversationId,
  loadHermesConversations,
  safeStorageScope,
  saveActiveConversationId,
  saveHermesConversations,
  consumeHermesSkillDialogOpenRequest,
  HERMES_SKILL_DIALOG_OPEN_EVENT,
  notifyHermesSkillsChanged,
  loadPersistedDeletedSessionIds,
  SESSION_TOUCH_INTERVAL_MS,
  type HermesConversation,
} from '@/features/hermes-playground/sessions'
import { Playground } from '@/features/playground'
import { DEFAULT_CONFIG, ERROR_MESSAGES } from '@/features/playground/constants'
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

interface HermesAgentWorkspaceProps {
  baseScopePrefix?: string
  defaultSystemPrompt: string
  emptyModelsMessage: string
  initialCapabilityCategory?: string
  initialCapabilitySection?: HermesCapabilitySection
  initialMessageSection?: HermesMessageSection
  initialPanel?: HermesPersonalPanel | HermesTeamPanel
  initialResultScope?: HermesResultScope
  initialResultType?: HermesResultType
  initialSkill?: string
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
  const [resultsTaskId, setResultsTaskId] = useState<string | undefined>()
  const [isMessagePlatformsOpen, setIsMessagePlatformsOpen] = useState(false)
  const [isExecutionTasksOpen, setIsExecutionTasksOpen] = useState(false)
  const [quickPromptRequest, setQuickPromptRequest] = useState<{
    id: string
    prompt: string
  } | null>(null)
  const [playgroundRefreshKey, setPlaygroundRefreshKey] = useState(0)
  const teamPersistTimerRef = useRef<number | null>(null)
  const userPersistTimerRef = useRef<number | null>(null)
  const resultSyncTimerRef = useRef<number | null>(null)
  // deletedSessions gates any upsert timer that fires after a delete is issued.
  // upsertInFlight lets deleteSession await a racing in-flight upsert before
  // issuing the DELETE request, so delete always arrives after upsert.
  const deletedSessions = useRef(new Set<string>(loadPersistedDeletedSessionIds()))
  const upsertInFlight = useRef(new Map<string, Promise<void>>())

  const { data: teamsResponse, isLoading: isTeamsLoading } = useQuery({
    queryKey: [props.queryKeyPrefix, queryUserScope, 'teams'],
    queryFn: listTeams,
  })
  const teams = useMemo(
    () => (teamsResponse?.success ? (teamsResponse.data ?? []) : []),
    [teamsResponse]
  )

  const { data: skillsForToolbar = [] } = useQuery({
    queryKey: ['hermes-skills-toolbar', queryUserScope],
    queryFn: () => listHermesSkills(),
    staleTime: 5 * 60 * 1000,
  })

  const favoriteSkills = useMemo(() => {
    const userSkills = skillsForToolbar.filter(
      (s) => s.isUserCreated || s.source === 'user' || s.ownerScope === 'user'
    )
    return userSkills.slice(0, 3)
  }, [skillsForToolbar])

  const handleSelectSkill = useCallback((skillName: string) => {
    setQuickPromptRequest({
      id: `toolbar-skill-${Date.now()}-${skillName}`,
      prompt: `/skill ${skillName} `,
    })
  }, [])

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

  const userConversationsQuery = useQuery({
    queryKey: [
      props.queryKeyPrefix,
      queryUserScope,
      'user-conversations',
      props.baseScopePrefix ?? 'hermes',
    ],
    queryFn: () =>
      listUserHermesConversations(props.baseScopePrefix ?? 'hermes'),
    enabled: !isTeamWorkspace,
    staleTime: 60_000,
  })

  const baseScope = useMemo(() => {
    if (isTeamWorkspace) {
      if (selectedTeamId <= 0) return 'team_workspace_pending'
      // Team skill workspaces scope sessions to team+skill so each
      // skill gets its own conversation tree shared within the team.
      if (props.initialSkill) {
        return `team_workspace_team_${selectedTeamId}_skill_${safeStorageScope(props.initialSkill)}`
      }
      return `team_workspace_team_${selectedTeamId}`
    }
    return getHermesBaseScope(userId, props.baseScopePrefix)
  }, [isTeamWorkspace, props.baseScopePrefix, props.initialSkill, selectedTeamId, userId])

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

    const nextSessions = teamConversationsQuery.data
      .filter((conversation) => !deletedSessions.current.has(conversation.id))
      .map((conversation) => {
        const session = normalizePersistedConversation(conversation, baseScope)
        saveMessages(
          conversation.messages,
          createPlaygroundStorageKeys(session.storageScope)
        )
        return session
      })
    if (nextSessions.length === 0) return
    saveHermesConversations(baseScope, nextSessions)
    setSessions(nextSessions)
    setActiveSessionId(loadActiveConversationId(baseScope, nextSessions))
  }, [baseScope, isTeamWorkspace, selectedTeamId, teamConversationsQuery.data])

  useEffect(() => {
    if (isTeamWorkspace) return
    if (!userConversationsQuery.data) return
    if (userConversationsQuery.data.length === 0) return

    const nextSessions = userConversationsQuery.data
      .filter((conversation) => !deletedSessions.current.has(conversation.id))
      .map((conversation) => {
        const session = normalizePersistedConversation(conversation, baseScope)
        saveMessages(
          conversation.messages,
          createPlaygroundStorageKeys(session.storageScope)
        )
        return session
      })
    if (nextSessions.length === 0) return
    saveHermesConversations(baseScope, nextSessions)
    setSessions(nextSessions)
    setActiveSessionId(loadActiveConversationId(baseScope, nextSessions))
  }, [baseScope, isTeamWorkspace, userConversationsQuery.data])

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
    const onSessionDeleted = (e: Event) => {
      const sessionId = (e as CustomEvent<string>).detail
      if (sessionId) deletedSessions.current.add(sessionId)
    }
    window.addEventListener(HERMES_SESSION_DELETED_EVENT, onSessionDeleted)
    return () => {
      window.removeEventListener(HERMES_SESSION_DELETED_EVENT, onSessionDeleted)
    }
  }, [])

  useEffect(() => {
    if (props.initialPanel === 'tasks') {
      // Tasks panel renders inline — no sheet needed.
    }
  }, [isTeamWorkspace, props.initialPanel])

  useEffect(() => {
    if (props.initialPanel === 'sessions' && isTeamWorkspace) {
      setIsSessionsOpen(true)
    }
  }, [isTeamWorkspace, props.initialPanel])

  useEffect(() => {
    if (consumeHermesCapabilitiesOpenRequest()) {
      setIsCapabilityCenterOpen(true)
    }
    if (consumeHermesResultsOpenRequest()) {
      setResultsTaskId(undefined)
      setIsResultsOpen(true)
    }
    if (consumeHermesMessagePlatformsOpenRequest()) {
      setIsMessagePlatformsOpen(true)
    }
    const requestedSkillTeamId = consumeHermesSkillDialogOpenRequest()
    if (requestedSkillTeamId !== undefined) {
      openSkillDialog(requestedSkillTeamId)
    }

    const openCapabilityCenter = () => setIsCapabilityCenterOpen(true)
    const openResults = () => {
      setResultsTaskId(undefined)
      setIsResultsOpen(true)
    }
    const openMessagePlatforms = () => setIsMessagePlatformsOpen(true)
    const openSkillDialogFromEvent = (e: Event) => {
      const teamId = (e as CustomEvent<{ teamId?: number }>).detail?.teamId
      setEditSkill(null)
      setSkillDialogTeamId(teamId)
      setIsSkillDialogOpen(true)
    }
    window.addEventListener(
      HERMES_CAPABILITIES_OPEN_EVENT,
      openCapabilityCenter
    )
    window.addEventListener(HERMES_RESULTS_OPEN_EVENT, openResults)
    window.addEventListener(
      HERMES_MESSAGE_PLATFORMS_OPEN_EVENT,
      openMessagePlatforms
    )
    window.addEventListener(
      HERMES_SKILL_DIALOG_OPEN_EVENT,
      openSkillDialogFromEvent
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
      window.removeEventListener(
        HERMES_SKILL_DIALOG_OPEN_EVENT,
        openSkillDialogFromEvent
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
      model: 'huayu-v2',
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
      'X-Baizor-Smart-Route': 'auto',
    }
    if (props.baseScopePrefix) {
      headers['X-Baizor-Hermes-Workspace'] = props.baseScopePrefix
    }
    if (props.initialSkill) {
      // Skill, jilai, and team-skill workspaces always activate
      // their designated skill. For hermes-playground the
      // auto-submitted quick-prompt message handles skill
      // activation so new sessions don't inherit the URL param
      // as persistent context.
      const prefix = props.baseScopePrefix ?? ''
      if (
        prefix.startsWith('skill_') ||
        prefix.startsWith('jilai_') ||
        prefix.startsWith('team_workspace_skill_')
      ) {
        headers['X-Baizor-Hermes-Skill-Activate'] = props.initialSkill
      }
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
    props.initialSkill,
    selectedTeamId,
    selectedTeamName,
  ])

  const persistTeamConversation = useCallback(
    (session: HermesConversation, messages: Message[]) => {
      if (!isTeamWorkspace || selectedTeamId <= 0) return
      if (deletedSessions.current.has(session.id)) return
      if (teamPersistTimerRef.current) {
        window.clearTimeout(teamPersistTimerRef.current)
      }
      teamPersistTimerRef.current = window.setTimeout(() => {
        if (deletedSessions.current.has(session.id)) return
        const payload: HermesTeamConversationRecord = {
          ...session,
          messages,
        }
        const p = upsertTeamHermesConversation(selectedTeamId, payload)
          .then(() => {})
          .finally(() => {
            upsertInFlight.current.delete(session.id)
          })
        upsertInFlight.current.set(session.id, p)
      }, 800)
    },
    [isTeamWorkspace, selectedTeamId]
  )

  const persistUserConversation = useCallback(
    (session: HermesConversation, messages: Message[]) => {
      if (isTeamWorkspace) return
      if (deletedSessions.current.has(session.id)) return
      if (userPersistTimerRef.current) {
        window.clearTimeout(userPersistTimerRef.current)
      }
      userPersistTimerRef.current = window.setTimeout(() => {
        if (deletedSessions.current.has(session.id)) return
        const payload: HermesUserConversationRecord = {
          ...session,
          workspaceScope: props.baseScopePrefix ?? 'hermes',
          messages,
        }
        const p = upsertUserHermesConversation(
          props.baseScopePrefix ?? 'hermes',
          payload
        )
          .then(() => {})
          .finally(() => {
            upsertInFlight.current.delete(session.id)
          })
        upsertInFlight.current.set(session.id, p)
      }, 800)
    },
    [isTeamWorkspace, props.baseScopePrefix]
  )

  const syncResultsForSession = useCallback(
    (
      session: HermesConversation,
      messages: Message[],
      options?: { immediate?: boolean }
    ) => {
      if (isTeamWorkspace && selectedTeamId <= 0) return
      if (resultSyncTimerRef.current) {
        window.clearTimeout(resultSyncTimerRef.current)
      }

      const run = () => {
        void syncHermesResults(
          {
            teamId: isTeamWorkspace ? selectedTeamId : undefined,
            conversationId: session.id,
            storageScope: session.storageScope,
            hermesSessionId: isTeamWorkspace
              ? `team_workspace_${selectedTeamId || 0}_${session.id}`
              : session.hermesSessionId,
            title: session.title,
            messages,
          },
          { teamName: selectedTeamName || undefined }
        )
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: ['hermes-results'] })
          })
          .catch(() => {
            // Results sync is best-effort; conversation saving remains primary.
          })
      }

      if (options?.immediate) {
        run()
        return
      }
      resultSyncTimerRef.current = window.setTimeout(run, 1200)
    },
    [isTeamWorkspace, queryClient, selectedTeamId, selectedTeamName]
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

  const persistUserConversationNow = useCallback(
    async (session: HermesConversation) => {
      if (isTeamWorkspace) return
      const messages =
        loadMessages(createPlaygroundStorageKeys(session.storageScope)) ?? []
      const payload: HermesUserConversationRecord = {
        ...session,
        workspaceScope: props.baseScopePrefix ?? 'hermes',
        messages,
      }
      await upsertUserHermesConversation(
        props.baseScopePrefix ?? 'hermes',
        payload
      )
      void userConversationsQuery.refetch()
    },
    [isTeamWorkspace, props.baseScopePrefix, userConversationsQuery]
  )

  useEffect(() => {
    return () => {
      if (teamPersistTimerRef.current) {
        window.clearTimeout(teamPersistTimerRef.current)
      }
      if (userPersistTimerRef.current) {
        window.clearTimeout(userPersistTimerRef.current)
      }
      if (resultSyncTimerRef.current) {
        window.clearTimeout(resultSyncTimerRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (!isResultsOpen) return
    const messages =
      loadMessages(createPlaygroundStorageKeys(activeSession.storageScope)) ??
      []
    syncResultsForSession(activeSession, messages, { immediate: true })
  }, [activeSession, isResultsOpen, syncResultsForSession])

  const updateActiveSessionFromMessages = useCallback(
    (messages: Message[]) => {
      const now = Date.now()
      const title = activeSession.titleEdited
        ? activeSession.title
        : (deriveConversationTitle(messages) ?? activeSession.title)
      const sessionToPersist = {
        ...activeSession,
        title,
        updatedAt: now,
      }
      persistTeamConversation(sessionToPersist, messages)
      persistUserConversation(sessionToPersist, messages)
      syncResultsForSession(sessionToPersist, messages)

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
    [activeSession, baseScope, persistTeamConversation, persistUserConversation, syncResultsForSession]
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
      void persistUserConversationNow(updatedSession).catch(() => {
        toast.error(t('Failed to save session'))
      })
    },
    [baseScope, persistTeamConversationNow, persistUserConversationNow, sessions, t]
  )

  const deleteSession = useCallback(
    (session: HermesConversation) => {
      // Gate: any timer that fires after this point will see the session in
      // deletedSessions and skip the upsert. Also clears any pending timer
      // for this session via the check inside persist callbacks.
      deletedSessions.current.add(session.id)

      // Optimistic UI update — synchronous so the user sees it immediately.
      clearConversationStorage(session)
      const nextSessions = sessions.filter((item) => item.id !== session.id)
      if (nextSessions.length === 0) {
        const nextSession = createHermesConversation(baseScope)
        saveHermesConversations(baseScope, [nextSession])
        saveActiveConversationId(baseScope, nextSession.id)
        setSessions([nextSession])
        setActiveSessionId(nextSession.id)
        persistTeamConversation(nextSession, [])
        persistUserConversation(nextSession, [])
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

      // Server operations: first await any in-flight upsert for this session so
      // DELETE always arrives after UPSERT, then issue the delete.
      void (async () => {
        await upsertInFlight.current.get(session.id)?.catch(() => {})
        try {
          if (isTeamWorkspace && selectedTeamId > 0) {
            await deleteTeamHermesConversation(selectedTeamId, session.id)
            void teamConversationsQuery.refetch()
          } else if (!isTeamWorkspace) {
            await deleteUserHermesConversation(session.id)
            void userConversationsQuery.refetch()
          }
        } catch {
          toast.error(t('Failed to delete session'))
        }
      })()
    },
    [
      activeSessionId,
      baseScope,
      isTeamWorkspace,
      persistTeamConversation,
      persistUserConversation,
      selectedTeamId,
      sessions,
      t,
      teamConversationsQuery,
      userConversationsQuery,
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
      queryKey: ['hermes-execution-tasks'],
    })
  }, [queryClient])

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
      } else if (!isTeamWorkspace) {
        void upsertUserHermesConversation(
          props.baseScopePrefix ?? 'hermes',
          {
            ...targetSession,
            workspaceScope: props.baseScopePrefix ?? 'hermes',
            messages: nextMessages,
          }
        )
      }
      if (task.conversationId === activeSession.id) {
        updateActiveSessionFromMessages(nextMessages)
        setPlaygroundRefreshKey((value) => value + 1)
      }
    },
    [
      activeSession,
      isTeamWorkspace,
      props.baseScopePrefix,
      selectedTeamId,
      sessions,
      updateActiveSessionFromMessages,
    ]
  )

  const markExecutionTaskRunning = useCallback(
    (task: HermesExecutionTask) => {
      if (task.status !== 'queued' && task.status !== 'running') return
      const targetStorageScope = task.storageScope || activeSession.storageScope
      const keys = createPlaygroundStorageKeys(targetStorageScope)
      const existingMessages = loadMessages(keys) ?? []
      let changed = false
      const nextMessages = existingMessages.map((message) => {
        if (
          message.executionTaskId !== task.taskId ||
          (message.status !== 'error' && message.status !== 'streaming')
        ) {
          return message
        }

        changed = true
        return {
          ...message,
          versions:
            message.status === 'error'
              ? message.versions.map((version, index) =>
                  index === 0 ? { ...version, content: '' } : version
                )
              : message.versions,
          status: 'loading' as const,
          errorCode: null,
        }
      })

      if (!changed) return
      saveMessages(nextMessages, keys)
      if (task.conversationId === activeSession.id) {
        updateActiveSessionFromMessages(nextMessages)
        setPlaygroundRefreshKey((value) => value + 1)
      }
    },
    [activeSession, updateActiveSessionFromMessages]
  )

  const markExecutionTaskFailed = useCallback(
    (task: HermesExecutionTask) => {
      if (task.status !== 'failed' && task.status !== 'canceled') return
      const targetStorageScope = task.storageScope || activeSession.storageScope
      const keys = createPlaygroundStorageKeys(targetStorageScope)
      const existingMessages = loadMessages(keys) ?? []
      let changed = false
      const nextMessages = existingMessages.map((message) => {
        if (message.executionTaskId !== task.taskId) return message

        changed = true
        return {
          ...message,
          versions: message.versions.map((version, index) =>
            index === 0
              ? {
                  ...version,
                  content: `${ERROR_MESSAGES.API_REQUEST_ERROR}: ${
                    task.error || ERROR_MESSAGES.API_REQUEST_ERROR
                  }`,
                }
              : version
          ),
          status: 'error' as const,
          errorCode: `hermes_task_${task.status}`,
        }
      })

      if (!changed) return
      saveMessages(nextMessages, keys)
      if (task.conversationId === activeSession.id) {
        updateActiveSessionFromMessages(nextMessages)
        setPlaygroundRefreshKey((value) => value + 1)
      }
    },
    [activeSession, updateActiveSessionFromMessages]
  )

  const recoverActiveExecutionTasks = useCallback(async () => {
    const messages =
      loadMessages(createPlaygroundStorageKeys(activeSession.storageScope)) ??
      []
    const taskIds = getRecoverableExecutionTaskIds(messages)
    if (taskIds.length === 0) return

    await Promise.all(
      taskIds.map(async (taskId) => {
        try {
          const task = await getHermesExecutionTask(taskId)
          if (task.status === 'succeeded') {
            applyExecutionTaskResult(task)
            return
          }
          if (task.status === 'failed' || task.status === 'canceled') {
            markExecutionTaskFailed(task)
            return
          }
          markExecutionTaskRunning(task)
        } catch {
          // The task may still be running server-side; the next focus/interval
          // pass will try again.
        }
      })
    )
    invalidateExecutionTasks()
  }, [
    activeSession.storageScope,
    applyExecutionTaskResult,
    invalidateExecutionTasks,
    markExecutionTaskFailed,
    markExecutionTaskRunning,
  ])

  useEffect(() => {
    let cancelled = false
    const recover = () => {
      if (!cancelled) {
        void recoverActiveExecutionTasks()
      }
    }
    const recoverOnVisible = () => {
      if (document.visibilityState === 'visible') {
        recover()
      }
    }

    recover()
    const intervalId = window.setInterval(recover, 5000)
    window.addEventListener('focus', recover)
    document.addEventListener('visibilitychange', recoverOnVisible)
    return () => {
      cancelled = true
      window.clearInterval(intervalId)
      window.removeEventListener('focus', recover)
      document.removeEventListener('visibilitychange', recoverOnVisible)
    }
  }, [recoverActiveExecutionTasks])

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
      navigateToConversationWorkspace()
    },
    [applyExecutionTaskResult, baseScope, sessions, t]
  )

  const openSkillDialog = useCallback((teamId?: number) => {
    setEditSkill(null)
    setSkillDialogTeamId(teamId)
    setIsSkillDialogOpen(true)
  }, [])

  const navigateToConversationWorkspace = useCallback(() => {
    if (isTeamWorkspace) {
      if (selectedTeamId <= 0) return
      void navigate({
        to: '/team-workspace',
        search: {
          team_id: selectedTeamId,
          ...(props.initialSkill ? { skill: props.initialSkill } : {}),
        },
      })
      return
    }

    // Detect skill/jilai workspaces from baseScopePrefix so that
    // navigating back from capability center, results, or skill
    // activation returns to the correct workspace instead of always
    // landing on /hermes-playground.
    const prefix = props.baseScopePrefix ?? ''
    if (prefix.startsWith('skill_') && props.initialSkill) {
      void navigate({
        to: '/skill-workspace',
        search: { skill: props.initialSkill },
      })
      return
    }
    if (prefix.startsWith('jilai_') && props.initialSkill) {
      void navigate({
        to: '/jilai-workspace',
        search: { skill: props.initialSkill },
      })
      return
    }

    void navigate({ to: '/hermes-playground' })
  }, [
    isTeamWorkspace,
    navigate,
    selectedTeamId,
    props.baseScopePrefix,
    props.initialSkill,
  ])

  const handleSkillCreated = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['hermes-capabilities', queryUserScope, 'skills'],
    })
    notifyHermesSkillsChanged()
  }, [queryClient, queryUserScope])

  const startWithSkill = useCallback(
    (skill: HermesSkill) => {
      setIsCapabilityCenterOpen(false)

      // Route to the skill's dedicated workspace based on owner scope so
      // each skill gets its own isolated conversation tree.
      if (
        skill.ownerScope === 'user' ||
        skill.source === 'user' ||
        skill.isUserCreated
      ) {
        void navigate({
          to: '/skill-workspace',
          search: { skill: skill.name },
        })
        return
      }

      if (
        (skill.ownerScope === 'team' || skill.source === 'team') &&
        isTeamWorkspace &&
        selectedTeamId > 0
      ) {
        void navigate({
          to: '/team-workspace',
          search: { team_id: selectedTeamId, skill: skill.name },
        })
        return
      }

      // For baizor/system/external skills without a dedicated workspace,
      // inject a skill invocation prompt in the current conversation.
      setQuickPromptRequest({
        id: `skill-${Date.now()}-${skill.name}`,
        prompt: `/skill ${skill.name} `,
      })
      navigateToConversationWorkspace()
    },
    [isTeamWorkspace, navigate, navigateToConversationWorkspace, selectedTeamId]
  )

  const continueWithResult = useCallback(
    (prompt: string, session: HermesConversation) => {
      if (!sessions.some((item) => item.id === session.id)) {
        const nextSessions = [session, ...sessions]
        saveHermesConversations(baseScope, nextSessions)
        setSessions(nextSessions)
      }
      saveActiveConversationId(baseScope, session.id)
      setActiveSessionId(session.id)
      setQuickPromptRequest({
        id: `result-${Date.now()}-${session.id}`,
        prompt,
      })
      navigateToConversationWorkspace()
    },
    [baseScope, navigateToConversationWorkspace, sessions]
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

  let workspaceContent: ReactNode
  if (props.initialPanel === 'messages') {
    workspaceContent = (
      <HermesMessagePlatformsWorkspace
        initialSection={props.initialMessageSection}
        userScope={queryUserScope}
      />
    )
  } else if (props.initialPanel === 'skills') {
    workspaceContent = (
      <HermesCapabilityCenterWorkspace
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
      />
    )
  } else if (props.initialPanel === 'results') {
    workspaceContent = (
      <HermesResultsWorkspace
        sessions={sessions}
        activeSessionId={activeSessionId}
        initialScope={props.initialResultScope}
        initialType={props.initialResultType}
        selectedTeamId={selectedTeamId > 0 ? selectedTeamId : undefined}
        selectedTeamName={selectedTeamName || undefined}
        workspaceMode={isTeamWorkspace ? 'team' : 'personal'}
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
        onContinueResult={continueWithResult}
        onOpenTask={(task) => {
          void openExecutionTask(task)
        }}
        onSelectSession={(session) => {
          if (!sessions.some((item) => item.id === session.id)) {
            const nextSessions = [session, ...sessions]
            saveHermesConversations(baseScope, nextSessions)
            setSessions(nextSessions)
          }
          saveActiveConversationId(baseScope, session.id)
          setActiveSessionId(session.id)
          navigateToConversationWorkspace()
        }}
      />
    )
  } else if (props.initialPanel === 'tasks') {
    workspaceContent = (
      <HermesExecutionTasksWorkspace
        userScope={queryUserScope}
        teamId={selectedTeamId > 0 ? selectedTeamId : undefined}
        title={isTeamWorkspace ? t('Team tasks') : t('Execution tasks')}
        description={
          isTeamWorkspace && selectedTeam
            ? t('Track running and completed tasks for {{team}}.', {
                team: selectedTeam.name,
              })
            : t('Track running work and reopen the related workspace.')
        }
        onSelectTask={(task) => {
          void openExecutionTask(task)
        }}
        onOpenTaskResults={(task) => {
          setResultsTaskId(task.taskId)
          setIsResultsOpen(true)
        }}
      />
    )
  } else {
    workspaceContent = (
      <Playground
        key={`${activeSession.storageScope}:${playgroundRefreshKey}`}
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
        quickPromptRequest={quickPromptRequest ?? undefined}
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
        favoriteSkills={favoriteSkills}
        allSkills={skillsForToolbar}
        onSelectSkill={handleSelectSkill}
      />
    )
  }

  return (
    <Main className='relative p-0'>
      {teams.length > 0 && (
        <div className='absolute top-3 right-3 z-10 flex max-w-[calc(100%-1.5rem)] flex-wrap items-center justify-end gap-2'>
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
        </div>
      )}
      {workspaceContent}
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
        initialTaskId={resultsTaskId}
        selectedTeamId={selectedTeamId > 0 ? selectedTeamId : undefined}
        selectedTeamName={selectedTeamName || undefined}
        workspaceMode={isTeamWorkspace ? 'team' : 'personal'}
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
        onContinueResult={continueWithResult}
        onOpenTask={(task) => {
          void openExecutionTask(task)
        }}
        onOpenChange={(open) => {
          setIsResultsOpen(open)
          if (!open) setResultsTaskId(undefined)
        }}
        onSelectSession={(session) => {
          if (!sessions.some((item) => item.id === session.id)) {
            const nextSessions = [session, ...sessions]
            saveHermesConversations(baseScope, nextSessions)
            setSessions(nextSessions)
          }
          saveActiveConversationId(baseScope, session.id)
          setActiveSessionId(session.id)
        }}
      />
      <HermesExecutionTasksSheet
        open={isExecutionTasksOpen}
        userScope={queryUserScope}
        teamId={selectedTeamId > 0 ? selectedTeamId : undefined}
        onOpenChange={setIsExecutionTasksOpen}
        onOpenTaskResults={(task) => {
          setResultsTaskId(task.taskId)
          setIsExecutionTasksOpen(false)
          setIsResultsOpen(true)
        }}
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

function getRecoverableExecutionTaskIds(messages: Message[]): string[] {
  const taskIds = new Set<string>()
  for (const message of messages) {
    if (
      message.from === 'assistant' &&
      message.executionTaskId &&
      !message.errorCode?.startsWith('hermes_task_') &&
      message.status !== 'complete'
    ) {
      taskIds.add(message.executionTaskId)
    }
  }
  return [...taskIds]
}

function normalizePersistedConversation(
  conversation: HermesTeamConversationRecord,
  baseScope: string
): HermesConversation {
  return {
    id: conversation.id,
    title: conversation.title,
    titleEdited: conversation.titleEdited,
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
