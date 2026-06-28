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
import { getBuildVersion } from './build-metadata'

interface RuntimeVersionPayload {
  readonly version?: string
  readonly buildId?: string
  readonly cacheVersion?: string
}

export interface RuntimeVersionState {
  readonly currentVersion: string
  readonly serverVersion?: string
  readonly changed: boolean
}

function normalizeVersion(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

export async function getRuntimeVersionState(): Promise<RuntimeVersionState> {
  const currentVersion = getBuildVersion()
  const response = await fetch('/version.json', {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch runtime version: ${response.status}`)
  }

  const payload = (await response.json()) as RuntimeVersionPayload
  const serverVersion =
    normalizeVersion(payload.cacheVersion) ??
    normalizeVersion(payload.buildId) ??
    normalizeVersion(payload.version)

  return {
    currentVersion,
    serverVersion,
    changed: Boolean(serverVersion && serverVersion !== currentVersion),
  }
}
