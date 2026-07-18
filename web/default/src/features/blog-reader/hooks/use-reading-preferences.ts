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

export const READING_PREFERENCES_KEY = 'reading_preferences_v1'

export type ReadingFontSize = 'sm' | 'base' | 'lg' | 'xl'
export type ReadingLineHeight = 'snug' | 'relaxed' | 'loose'

export interface ReadingPreferences {
  fontSize: ReadingFontSize
  lineHeight: ReadingLineHeight
}

const DEFAULT_PREFERENCES: ReadingPreferences = {
  fontSize: 'base',
  lineHeight: 'relaxed',
}

function readPreferences(): ReadingPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_PREFERENCES
  }

  try {
    const raw = localStorage.getItem(READING_PREFERENCES_KEY)
    if (!raw) {
      return DEFAULT_PREFERENCES
    }

    const parsed = JSON.parse(raw) as Partial<ReadingPreferences>
    return {
      fontSize: parsed.fontSize ?? DEFAULT_PREFERENCES.fontSize,
      lineHeight: parsed.lineHeight ?? DEFAULT_PREFERENCES.lineHeight,
    }
  } catch {
    return DEFAULT_PREFERENCES
  }
}

function writePreferences(preferences: ReadingPreferences): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    localStorage.setItem(READING_PREFERENCES_KEY, JSON.stringify(preferences))
  } catch {
    // Ignore storage errors (e.g., private mode).
  }
}

export function useReadingPreferences(): {
  preferences: ReadingPreferences
  setPreferences: (next: Partial<ReadingPreferences>) => void
} {
  const [preferences, setState] = useState<ReadingPreferences>(readPreferences)

  const setPreferences = useCallback(
    (next: Partial<ReadingPreferences>) => {
      setState((current) => {
        const updated = { ...current, ...next }
        writePreferences(updated)
        return updated
      })
    },
    [setState]
  )

  return { preferences, setPreferences }
}
