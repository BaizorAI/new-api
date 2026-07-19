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
import type { ApiResponse, BlogArticle, GetBlogArticlesParams } from '@/features/blog-hall/types'

export interface BlogAuthor {
  id: number
  display_name: string
  slug: string
  avatar: string
  bio: string
  is_public: boolean
}

export interface BlogAuthorDetail extends BlogAuthor {
  article_count: number
  follower_count: number
  is_followed: boolean
}

export interface GetBlogAuthorsParams extends GetBlogArticlesParams {}

export type GetBlogAuthorsResponse = ApiResponse<{
  items: BlogAuthorDetail[]
  total: number
  page: number
  page_size: number
}>

export type GetBlogAuthorResponse = ApiResponse<BlogAuthorDetail>

export type GetBlogAuthorArticlesResponse = ApiResponse<{
  items: BlogArticle[]
  total: number
  page: number
  page_size: number
}>

export interface AuthorProfileFormData {
  display_name: string
  slug: string
  avatar: string
  bio: string
  is_public: boolean
}

export type GetSelfAuthorProfileResponse = ApiResponse<BlogAuthor | null>
export type UpdateSelfAuthorProfileResponse = ApiResponse<BlogAuthor>

export interface FollowAuthorResponse {
  success: boolean
  message?: string
  data?: {
    following: boolean
    follower_count: number
  }
}
