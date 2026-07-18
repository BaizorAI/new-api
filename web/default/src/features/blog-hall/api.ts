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
import { api } from '@/lib/api'

import type {
  ApiResponse,
  BlogArticle,
  BlogArticleFormData,
  GetBlogArticlesParams,
  GetBlogArticlesResponse,
} from './types'

// ============================================================================
// Blog Article API
// ============================================================================

export async function getBlogArticles(
  params: GetBlogArticlesParams = {}
): Promise<GetBlogArticlesResponse> {
  const { p = 1, page_size = 20, status } = params
  let url = `/api/blog/?p=${p}&page_size=${page_size}`
  if (status) url += `&status=${status}`
  const res = await api.get(url)
  return res.data
}

export async function getBlogArticle(
  id: number
): Promise<ApiResponse<BlogArticle>> {
  const res = await api.get(`/api/blog/${id}`)
  return res.data
}

export async function createBlogArticle(
  data: BlogArticleFormData
): Promise<ApiResponse<BlogArticle>> {
  const res = await api.post('/api/blog/', data)
  return res.data
}

export async function updateBlogArticle(
  id: number,
  data: Partial<BlogArticleFormData>
): Promise<ApiResponse<BlogArticle>> {
  const res = await api.put(`/api/blog/${id}`, data)
  return res.data
}

export async function deleteBlogArticle(
  id: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/blog/${id}`)
  return res.data
}

// ============================================================================
// Blog Chat Message API
// ============================================================================

export interface BlogChatMessageRecord {
  id?: number
  role: 'user' | 'assistant'
  content: string
  created_at?: string
}

export async function getBlogChatMessages(
  articleId: number
): Promise<ApiResponse<BlogChatMessageRecord[]>> {
  const res = await api.get(`/api/blog/${articleId}/messages`)
  return res.data
}

export async function saveBlogChatMessages(
  articleId: number,
  messages: { role: 'user' | 'assistant'; content: string }[]
): Promise<ApiResponse<BlogChatMessageRecord[]>> {
  const res = await api.post(`/api/blog/${articleId}/messages`, { messages })
  return res.data
}

export async function clearBlogChatMessages(
  articleId: number
): Promise<ApiResponse> {
  const res = await api.delete(`/api/blog/${articleId}/messages`)
  return res.data
}

// ============================================================================
// Blog Image Upload API
// ============================================================================

export interface BlogImageUploadResponse {
  url: string
  filename: string
  bytes: number
}

export async function uploadBlogImage(
  file: File
): Promise<BlogImageUploadResponse> {
  const formData = new FormData()
  formData.append('image', file)
  const res = await api.post('/api/blog/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return res.data.data
}
