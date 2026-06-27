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
import { useCallback, useState } from 'react'

const STORAGE_KEY = 'sidebar_group_state_v1'

type GroupState = Record<string, boolean>

function readInitialState(): GroupState {
  if (typeof window === 'undefined') {
    return {}
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as GroupState
    }
  } catch {
    // Ignore corrupt state.
  }

  return {}
}

/**
 * Persist the open/closed state of sidebar collapsible groups in localStorage.
 */
export function useSidebarGroupState(): {
  getGroupOpen: (id: string, fallback?: boolean) => boolean
  setGroupOpen: (id: string, open: boolean) => void
} {
  const [state, setState] = useState<GroupState>(readInitialState)

  const setGroupOpen = useCallback((id: string, open: boolean) => {
    setState((previous) => {
      const next = { ...previous, [id]: open }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      } catch {
        // Storage is best-effort.
      }
      return next
    })
  }, [])

  const getGroupOpen = useCallback(
    (id: string, fallback = true): boolean => {
      const value = state[id]
      return value === undefined ? fallback : value
    },
    [state]
  )

  return { getGroupOpen, setGroupOpen }
}
