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
  BlogTag,
  GetBlogArticlesParams,
  GetBlogArticlesResponse,
  SearchBlogArticlesParams,
} from '@/features/blog-hall/types'

// Public endpoints – no auth required.

export async function getPublishedArticles(
  params: GetBlogArticlesParams = {}
): Promise<GetBlogArticlesResponse> {
  const { p = 1, page_size = 20, author_id } = params
  let url = `/api/blog/public/?p=${p}&page_size=${page_size}`
  if (author_id && author_id > 0) {
    url += `&author_id=${author_id}`
  }
  const res = await api.get(url)
  return res.data
}

export async function getPublishedArticle(
  identifier: string | number
): Promise<ApiResponse<BlogArticle>> {
  const res = await api.get(`/api/blog/public/${encodeURIComponent(String(identifier))}`)
  return res.data
}

export async function searchPublishedArticles(
  params: SearchBlogArticlesParams = {}
): Promise<GetBlogArticlesResponse> {
  const { q, tag, p = 1, page_size = 20 } = params
  const query = new URLSearchParams()
  query.set('p', String(p))
  query.set('page_size', String(page_size))
  if (q && q.trim()) {
    query.set('q', q.trim())
  }
  if (tag) {
    const tags = Array.isArray(tag) ? tag : [tag]
    for (const t of tags) {
      if (t && t.trim()) {
        query.append('tag', t.trim())
      }
    }
  }
  const res = await api.get(`/api/blog/public/search?${query.toString()}`)
  return res.data
}

export async function getRelatedArticles(
  identifier: string | number
): Promise<GetBlogArticlesResponse> {
  const res = await api.get(
    `/api/blog/public/articles/${encodeURIComponent(String(identifier))}/related?page_size=6`
  )
  return res.data
}

export async function getPublishedBlogTags(): Promise<ApiResponse<BlogTag[]>> {
  const res = await api.get('/api/blog/public/tags?limit=50')
  return res.data
}
