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
import { useNavigate } from '@tanstack/react-router'
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useAuthStore } from '@/stores/auth-store'

export type SessionLike = {
  id: string
  title: string
  pinned?: boolean
  archived?: boolean
}

export type SessionListAdapter<T extends SessionLike> = {
  baseUrl: string
  getBaseScope: (userId?: number | string | null) => string
  create: (scope: string) => T
  load: (scope: string) => T[]
  save: (scope: string, sessions: T[]) => void
  loadActiveId: (scope: string, sessions: T[]) => string
  saveActiveId: (scope: string, id: string) => void
  sort: (sessions: T[]) => T[]
  clearStorage: (session: T) => void
  changedEvent: string
  newSessionLabelKey: string
  renameDialogTitleKey: string
  inputLabelKey: string
  getCopyId: (session: T) => string
  exportFilenameFallback: string
  buildExportPayload: (session: T) => unknown
}

export type SessionActions<T extends SessionLike> = {
  archive: (session: T) => void
  copyId: (session: T) => void
  delete: (session: T) => void
  export: (session: T) => void
  openInNewWindow: (session: T) => void
  pin: (session: T) => void
  rename: (session: T) => void
  select: (sessionId: string) => void
}

type SessionGroups<T extends SessionLike> = {
  pinned: T[]
  recent: T[]
  archived: T[]
}

export function useSessionList<T extends SessionLike>(
  adapter: SessionListAdapter<T>
) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const userId = useAuthStore((s) => s.auth.user?.id)
  const baseScope = adapter.getBaseScope(userId)

  const [sessions, setSessions] = useState<T[]>(() => adapter.load(baseScope))
  const [activeSessionId, setActiveSessionId] = useState(() =>
    adapter.loadActiveId(baseScope, sessions)
  )
  const [renamingSession, setRenamingSession] = useState<T | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const reloadSessions = useCallback(() => {
    const nextSessions = adapter.load(baseScope)
    setSessions(nextSessions)
    setActiveSessionId(adapter.loadActiveId(baseScope, nextSessions))
  }, [adapter, baseScope])

  useEffect(() => {
    const handleChange = () => reloadSessions()
    window.addEventListener(adapter.changedEvent, handleChange)
    window.addEventListener('storage', handleChange)
    return () => {
      window.removeEventListener(adapter.changedEvent, handleChange)
      window.removeEventListener('storage', handleChange)
    }
  }, [adapter, reloadSessions])

  const sessionGroups = useMemo<SessionGroups<T>>(
    () => ({
      pinned: adapter.sort(
        sessions.filter((session) => session.pinned && !session.archived)
      ),
      recent: adapter.sort(
        sessions.filter((session) => !session.pinned && !session.archived)
      ),
      archived: adapter.sort(sessions.filter((session) => session.archived)),
    }),
    [adapter, sessions]
  )

  const createSession = useCallback(() => {
    const nextSession = adapter.create(baseScope)
    const nextSessions = [nextSession, ...sessions]
    adapter.save(baseScope, nextSessions)
    adapter.saveActiveId(baseScope, nextSession.id)
    setSessions(nextSessions)
    setActiveSessionId(nextSession.id)
    void navigate({ to: adapter.baseUrl })
  }, [adapter, baseScope, navigate, sessions])

  const selectSession = useCallback(
    (sessionId: string) => {
      adapter.saveActiveId(baseScope, sessionId)
      setActiveSessionId(sessionId)
    },
    [adapter, baseScope]
  )

  const updateSession = useCallback(
    (sessionId: string, updater: (session: T) => T) => {
      const nextSessions = sessions.map((session) =>
        session.id === sessionId
          ? ({ ...updater(session), updatedAt: Date.now() } as T)
          : session
      )
      adapter.save(baseScope, nextSessions)
      setSessions(nextSessions)
    },
    [adapter, baseScope, sessions]
  )

  const copySessionId = useCallback(
    async (session: T) => {
      try {
        await navigator.clipboard.writeText(adapter.getCopyId(session))
        toast.success(t('Copied to clipboard'))
      } catch {
        toast.error(t('Copy failed'))
      }
    },
    [adapter, t]
  )

  const exportSession = useCallback(
    (session: T) => {
      downloadSessionJson(
        adapter.buildExportPayload(session),
        `${session.title || session.id}.json`,
        adapter.exportFilenameFallback
      )
      toast.success(t('Exported'))
    },
    [adapter, t]
  )

  const deleteSession = useCallback(
    (session: T) => {
      adapter.clearStorage(session)

      if (sessions.length <= 1) {
        const nextSession = adapter.create(baseScope)
        adapter.save(baseScope, [nextSession])
        adapter.saveActiveId(baseScope, nextSession.id)
        setSessions([nextSession])
        setActiveSessionId(nextSession.id)
        return
      }

      const nextSessions = sessions.filter((item) => item.id !== session.id)
      adapter.save(baseScope, nextSessions)
      setSessions(nextSessions)

      if (activeSessionId !== session.id) return

      const nextActive =
        nextSessions.find((item) => !item.archived)?.id ?? nextSessions[0]?.id
      if (!nextActive) return

      adapter.saveActiveId(baseScope, nextActive)
      setActiveSessionId(nextActive)
    },
    [activeSessionId, adapter, baseScope, sessions]
  )

  const submitRename = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      if (!renamingSession) return
      updateSession(renamingSession.id, (session) => ({
        ...session,
        title: renameValue.trim(),
      }))
      setRenamingSession(null)
      setRenameValue('')
    },
    [renameValue, renamingSession, updateSession]
  )

  return {
    baseUrl: adapter.baseUrl,
    sessions,
    sessionGroups,
    activeSessionId,
    createSession,
    sessionActions: {
      archive: (session: T) =>
        updateSession(session.id, (current) => ({
          ...current,
          archived: !current.archived,
          pinned: current.archived ? current.pinned : false,
        })),
      copyId: copySessionId,
      delete: deleteSession,
      export: exportSession,
      openInNewWindow: (session: T) => {
        adapter.saveActiveId(baseScope, session.id)
        window.open(adapter.baseUrl, '_blank', 'noopener,noreferrer')
      },
      pin: (session: T) =>
        updateSession(session.id, (current) => ({
          ...current,
          archived: false,
          pinned: !current.pinned,
        })),
      rename: (session: T) => {
        setRenamingSession(session)
        setRenameValue(session.title)
      },
      select: selectSession,
    } satisfies SessionActions<T>,
    renamingSession,
    renameValue,
    setRenamingSession,
    setRenameValue,
    submitRename,
  }
}

export function downloadSessionJson(
  payload: unknown,
  filename: string,
  fallback: string
): void {
  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = sanitizeDownloadFilename(filename, fallback)
  anchor.click()
  URL.revokeObjectURL(url)
}

function sanitizeDownloadFilename(filename: string, fallback: string): string {
  const filenameWithoutPathChars = filename
    .trim()
    .replaceAll(/[<>:"/\\|?*]/g, '_')
  const safeName = [...filenameWithoutPathChars]
    .filter((character) => character.charCodeAt(0) >= 32)
    .join('')
  return safeName || fallback
}
