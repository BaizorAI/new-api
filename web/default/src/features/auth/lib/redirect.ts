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

export const DEFAULT_AUTH_REDIRECT = '/team-workspace'

const AUTH_ROUTE_PATHS = new Set(['/sign-in', '/sign-up', '/otp'])

export function normalizeLocalRedirect(redirectTo?: string | null): string {
  const rawRedirect = typeof redirectTo === 'string' ? redirectTo.trim() : ''
  if (!rawRedirect) {
    return DEFAULT_AUTH_REDIRECT
  }

  const origin =
    typeof window !== 'undefined' && window.location?.origin
      ? window.location.origin
      : 'http://localhost'

  try {
    const url = new URL(rawRedirect, origin)
    if (url.origin !== origin || AUTH_ROUTE_PATHS.has(url.pathname)) {
      return DEFAULT_AUTH_REDIRECT
    }

    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return DEFAULT_AUTH_REDIRECT
  }
}