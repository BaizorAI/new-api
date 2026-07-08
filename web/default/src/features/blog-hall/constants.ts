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
import { type TFunction } from 'i18next'

import { type StatusBadgeProps } from '@/components/status-badge'

import type { BlogArticleStatus } from './types'

// ============================================================================
// Blog Article Status Configuration
// ============================================================================

export const BLOG_ARTICLE_STATUS = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  ARCHIVED: 'archived',
} as const satisfies Record<string, BlogArticleStatus>

export const BLOG_ARTICLE_STATUS_VALUES = Object.values(
  BLOG_ARTICLE_STATUS
) as BlogArticleStatus[]

export const BLOG_ARTICLE_STATUSES: Record<
  BlogArticleStatus,
  Pick<StatusBadgeProps, 'variant'> & { labelKey: string }
> = {
  draft: { labelKey: 'Draft', variant: 'neutral' },
  published: { labelKey: 'Published', variant: 'success' },
  archived: { labelKey: 'Archived', variant: 'warning' },
} as const

export function getBlogArticleStatusOptions(t: TFunction) {
  return BLOG_ARTICLE_STATUS_VALUES.map((status) => ({
    label: t(BLOG_ARTICLE_STATUSES[status].labelKey),
    value: status,
  }))
}

// ============================================================================
// Success Messages (i18n keys)
// ============================================================================

export const SUCCESS_MESSAGES = {
  ARTICLE_CREATED: 'Article created.',
  ARTICLE_UPDATED: 'Article updated.',
  ARTICLE_DELETED: 'Article deleted.',
  ARTICLE_PUBLISHED: 'Article published.',
  ARTICLE_UNPUBLISHED: 'Article unpublished.',
} as const
