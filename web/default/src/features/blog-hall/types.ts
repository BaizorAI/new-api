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
import { z } from 'zod'

// ============================================================================
// BlogArticle Schema & Types
// ============================================================================

export const blogAuthorSchema = z.object({
  id: z.number(),
  display_name: z.string(),
  slug: z.string(),
  avatar: z.string(),
  bio: z.string(),
})

export type BlogAuthor = z.infer<typeof blogAuthorSchema>

export const blogArticleSchema = z.object({
  id: z.number(),
  author_id: z.number(),
  title: z.string(),
  summary: z.string(),
  content: z.string(),
  cover_image: z.string().optional().default(''),
  tags: z.array(z.string()),
  status: z.enum(['draft', 'published', 'archived']),
  created_time: z.number(),
  updated_time: z.number(),
  published_at: z.number(),
  author: blogAuthorSchema.optional(),
})

export type BlogArticle = z.infer<typeof blogArticleSchema>

export type BlogArticleStatus = BlogArticle['status']

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetBlogArticlesParams {
  p?: number
  page_size?: number
  status?: string
  author_id?: number
}

export interface GetBlogArticlesResponse {
  success: boolean
  message?: string
  data?: {
    items: BlogArticle[]
    total: number
    page: number
    page_size: number
  }
}

export interface BlogArticleFormData {
  title: string
  summary: string
  content: string
  cover_image?: string
  tags: string[]
  status: BlogArticleStatus
}

// ============================================================================
// Dialog Types
// ============================================================================

export type BlogHallDialogType = 'create' | 'update' | 'delete'
