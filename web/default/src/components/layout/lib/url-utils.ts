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
import type { LinkProps } from '@tanstack/react-router'

import type { NavItem, NavCollapsible } from '../types'

/**
 * Convert LinkProps['to'] to string
 * Handles both string URLs and object URLs (e.g., { pathname, search })
 */
function urlToString(url: LinkProps['to'] | (string & {})): string | null {
  if (typeof url === 'string') {
    return url
  }
  if (url && typeof url === 'object' && !Array.isArray(url)) {
    // Handle object URLs like { pathname: string, search?: string }
    const urlObj = url as Record<string, unknown>
    const pathname = typeof urlObj.pathname === 'string' ? urlObj.pathname : ''
    const search = typeof urlObj.search === 'string' ? urlObj.search : ''
    return pathname + search
  }
  return null
}

/**
 * Normalize URL by removing query parameters and trailing slashes.
 * Keeps the root `/` intact.
 */
export function normalizeHref(href: string): string {
  const withoutQuery = href.split('?')[0] ?? ''
  return withoutQuery.length > 1
    ? withoutQuery.replace(/\/+$/, '')
    : withoutQuery
}

/**
 * Check whether two normalized pathnames match.
 */
function pathsMatch(a: string, b: string): boolean {
  return normalizeHref(a) === normalizeHref(b)
}

/**
 * Check if a navigation item is active.
 * @param href - Current URL
 * @param item - Navigation item
 * @param mainNav - Whether this is a main navigation item (matches first-level path)
 */
export function checkIsActive(
  href: string,
  item: NavItem,
  mainNav = false
): boolean {
  const normalizedHref = normalizeHref(href)

  // Explicit active URL overrides (e.g. task records covering drawing logs).
  if (
    item.activeUrls?.some((url) => {
      const urlStr = urlToString(url)
      return urlStr ? pathsMatch(urlStr, href) : false
    })
  ) {
    return true
  }

  // For collapsible items, check if any sub-item matches.
  if ('items' in item && item.items) {
    const collapsibleItem = item as NavCollapsible
    if (
      collapsibleItem.items.some((sub) => {
        if (!sub.url) return false
        const subUrl = urlToString(sub.url)
        return subUrl ? pathsMatch(subUrl, href) : false
      })
    ) {
      return true
    }
  }

  // For regular link items, check the item's URL.
  if (!item.url) return false

  const itemUrl = urlToString(item.url)
  if (!itemUrl) return false

  if (pathsMatch(itemUrl, href)) {
    return true
  }

  // Main navigation match: first path segment only.
  if (mainNav) {
    const hrefFirstPath = normalizedHref.split('/')[1]
    const itemFirstPath = normalizeHref(itemUrl).split('/')[1]
    if (hrefFirstPath && itemFirstPath) {
      return hrefFirstPath === itemFirstPath
    }
  }

  return false
}
