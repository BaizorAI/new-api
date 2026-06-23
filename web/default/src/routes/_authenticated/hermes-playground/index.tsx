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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { Building2Icon, SparklesIcon, WalletCardsIcon } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

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
import type { HermesSkill } from '@/features/hermes-playground/api'
import { HermesCapabilityCenter } from '@/features/hermes-playground/components/hermes-capability-center'
import { HermesMessagePlatforms } from '@/features/hermes-playground/components/hermes-message-platforms'
import { HermesResults } from '@/features/hermes-playground/components/hermes-results'
import { HermesSkillDialog } from '@/features/hermes-playground/components/hermes-skill-dialog'
import {
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
import type { Message, ModelOption } from '@/features/playground/types'
import { listTeams } from '@/features/teams/api'
import { formatQuota } from '@/lib/format'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { useAuthStore } from '@/stores/auth-store'

export const Route = createFileRoute('/_authenticated/hermes-playground/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'hermes_playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: HermesPlaygroundPage,
})

function HermesPlaygroundPage() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const userId = useAuthStore((s) => s.auth.user?.id)
  const baseScope = getHermesBaseScope(userId)
  const queryUserScope = String(userId ?? 'anonymous')
  const [sessions, setSessions] = useState<HermesConversation[]>(() =>
    loadHermesConversations(baseScope)
  )
  const [activeSessionId, setActiveSessionId] = useState(() =>
    loadActiveConversationId(baseScope, sessions)
  )
  const [isSkillDialogOpen, setIsSkillDialogOpen] = useState(false)
  const [editSkill, setEditSkill] = useState<HermesSkill | null>(null)
  const [isCapabilityCenterOpen, setIsCapabilityCenterOpen] = useState(false)
  const [isResultsOpen, setIsResultsOpen] = useState(false)
  const [isMessagePlatformsOpen, setIsMessagePlatformsOpen] = useState(false)
  const [billingOwner, setBillingOwner] = useState('personal')

  const { data: teamsResponse } = useQuery({
    queryKey: ['hermes-playground', queryUserScope, 'teams'],
    queryFn: listTeams,
  })
  const teams = teamsResponse?.success ? (teamsResponse.data ?? []) : []

  const selectedTeamId = billingOwner.startsWith('team:')
    ? Number(billingOwner.slice('team:'.length))
    : 0

  useEffect(() => {
    if (billingOwner === 'personal') return
    if (!teams.some((team) => team.id === selectedTeamId)) {
      setBillingOwner('personal')
    }
  }, [billingOwner, selectedTeamId, teams])

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

  const defaultConfig = useMemo(
    () => ({
      ...DEFAULT_CONFIG,
      model: 'hermes-agent',
      systemPrompt: 'Use Chinese by default unless the user asks otherwise.',
    }),
    []
  )

  const modelFilter = useCallback((model: ModelOption) => {
    return /hermes/i.test(`${model.label} ${model.value}`)
  }, [])

  const requestHeaders = useMemo(() => {
    const headers: Record<string, string> = {
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': activeSession.hermesSessionId,
    }
    if (selectedTeamId > 0) {
      headers['X-Baizor-Team-Id'] = String(selectedTeamId)
    }
    return headers
  }, [activeSession.hermesSessionId, selectedTeamId])

  const updateActiveSessionFromMessages = useCallback(
    (messages: Message[]) => {
      setSessions((prev) => {
        const now = Date.now()
        let changed = false
        const next = prev.map((session) => {
          if (session.id !== activeSession.id) return session

          const title = deriveConversationTitle(messages) ?? session.title
          if (
            session.title === title &&
            now - session.updatedAt < SESSION_TOUCH_INTERVAL_MS
          ) {
            return session
          }

          changed = true
          return {
            ...session,
            title,
            updatedAt: now,
          }
        })

        if (!changed) return prev
        saveHermesConversations(baseScope, next)
        return next
      })
    },
    [activeSession.id, baseScope]
  )

  const createSession = useCallback(() => {
    const nextSession = createHermesConversation(baseScope)
    const nextSessions = [nextSession, ...sessions]
    saveHermesConversations(baseScope, nextSessions)
    saveActiveConversationId(baseScope, nextSession.id)
    setSessions(nextSessions)
    setActiveSessionId(nextSession.id)
  }, [baseScope, sessions])

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

  const handleSkillCreated = useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: ['hermes-capabilities', queryUserScope, 'skills'],
    })
  }, [queryClient, queryUserScope])

  return (
    <Main className='relative p-0'>
      <div className='absolute top-3 right-3 z-10 flex items-center gap-2'>
        {teams.length > 0 && (
          <Select
            value={billingOwner}
            onValueChange={(value) => {
              if (value) setBillingOwner(value)
            }}
          >
            <SelectTrigger
              aria-label={t('Billing Ownership')}
              className='bg-background/95 h-8 max-w-[220px] shadow-sm backdrop-blur'
            >
              <SelectValue placeholder={t('Billing Ownership')} />
            </SelectTrigger>
            <SelectContent align='end' alignItemWithTrigger={false}>
              <SelectGroup>
                <SelectItem value='personal'>
                  <WalletCardsIcon className='size-4' />
                  <span>{t('Personal Wallet')}</span>
                </SelectItem>
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
      </div>
      <Playground
        key={activeSession.storageScope}
        defaultConfig={defaultConfig}
        enableSlashCommands
        emptyModelsMessage={t('No Hermes models available')}
        modelFilter={modelFilter}
        onAddSkill={() => setIsSkillDialogOpen(true)}
        onMessagesChange={updateActiveSessionFromMessages}
        onNewSession={createSession}
        onSaveSession={exportActiveSession}
        queryKeyPrefix='hermes-playground'
        requestHeaders={requestHeaders}
        storageScope={activeSession.storageScope}
      />
      <HermesSkillDialog
        open={isSkillDialogOpen}
        editSkill={editSkill}
        onOpenChange={(open) => {
          setIsSkillDialogOpen(open)
          if (!open) setEditSkill(null)
        }}
        onCreated={handleSkillCreated}
      />
      <HermesCapabilityCenter
        open={isCapabilityCenterOpen}
        userScope={queryUserScope}
        onAddSkill={() => setIsSkillDialogOpen(true)}
        onEditSkill={(skill) => {
          setEditSkill(skill)
          setIsCapabilityCenterOpen(false)
          setIsSkillDialogOpen(true)
        }}
        onOpenChange={setIsCapabilityCenterOpen}
      />
      <HermesResults
        open={isResultsOpen}
        sessions={sessions}
        activeSessionId={activeSessionId}
        onOpenChange={setIsResultsOpen}
        onSelectSession={(sessionId) => {
          saveActiveConversationId(baseScope, sessionId)
          setActiveSessionId(sessionId)
        }}
      />
      <HermesMessagePlatforms
        open={isMessagePlatformsOpen}
        userScope={queryUserScope}
        onOpenChange={setIsMessagePlatformsOpen}
      />
    </Main>
  )
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
