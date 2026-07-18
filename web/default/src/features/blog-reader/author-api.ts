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
  GetBlogAuthorsParams,
  GetBlogAuthorsResponse,
  GetBlogAuthorResponse,
  GetBlogAuthorArticlesResponse,
  GetSelfAuthorProfileResponse,
  UpdateSelfAuthorProfileResponse,
  AuthorProfileFormData,
} from './author-types'

export async function getBlogAuthors(
  params: GetBlogAuthorsParams = {}
): Promise<GetBlogAuthorsResponse> {
  const { p = 1, page_size = 20 } = params
  const res = await api.get(`/api/blog/public/authors?p=${p}&page_size=${page_size}`)
  return res.data
}

export async function getBlogAuthor(slug: string): Promise<GetBlogAuthorResponse> {
  const res = await api.get(`/api/blog/public/authors/${encodeURIComponent(slug)}`)
  return res.data
}

export async function getBlogAuthorArticles(
  slug: string,
  params: GetBlogAuthorsParams = {}
): Promise<GetBlogAuthorArticlesResponse> {
  const { p = 1, page_size = 12 } = params
  const res = await api.get(
    `/api/blog/public/authors/${encodeURIComponent(slug)}/articles?p=${p}&page_size=${page_size}`
  )
  return res.data
}

export async function getSelfAuthorProfile(): Promise<GetSelfAuthorProfileResponse> {
  const res = await api.get('/api/user/author-profile')
  return res.data
}

export async function updateSelfAuthorProfile(
  data: AuthorProfileFormData
): Promise<UpdateSelfAuthorProfileResponse> {
  const res = await api.put('/api/user/author-profile', data)
  return res.data
}
