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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { getBlogArticle, updateBlogArticle } from '../api'
import { splitMarkdownIntoParagraphs } from '../lib/paragraph-utils'
import type { BlogArticle, BlogArticleStatus } from '../types'

interface BlogWorkspaceContextType {
  article: BlogArticle | null
  isLoading: boolean
  isDirty: boolean

  content: string
  setContent: (content: string) => void
  title: string
  setTitle: (title: string) => void
  summary: string
  setSummary: (summary: string) => void
  coverImage: string
  setCoverImage: (coverImage: string) => void
  tags: string
  setTags: (tags: string) => void
  status: BlogArticleStatus
  setStatus: (status: BlogArticleStatus) => void

  selectedParagraphIndex: number | null
  selectedParagraphText: string | null
  selectParagraph: (index: number | null) => void

  save: () => Promise<void>
  isSaving: boolean

  // AI actions — triggered by toolbar, implemented by chat bar
  analyzeRequested: number
  isAnalyzing: boolean
  requestAnalyze: () => void
  setAnalyzing: (v: boolean) => void
  genTitleRequested: number
  genSummaryRequested: number
  requestGenTitle: () => void
  requestGenSummary: () => void
  generatingField: 'title' | 'summary' | null
  setGeneratingField: (f: 'title' | 'summary' | null) => void

  // Edit mode toggle
  editMode: 'preview' | 'edit'
  setEditMode: (mode: 'preview' | 'edit') => void
}

const BlogWorkspaceContext = createContext<BlogWorkspaceContextType | null>(null)

export function useBlogWorkspace() {
  const ctx = useContext(BlogWorkspaceContext)
  if (!ctx) {
    throw new Error('useBlogWorkspace must be used within BlogWorkspaceProvider')
  }
  return ctx
}

interface BlogWorkspaceProviderProps {
  articleId: number
  children: ReactNode
}

export function BlogWorkspaceProvider({
  articleId,
  children,
}: BlogWorkspaceProviderProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['blog-article', articleId],
    queryFn: () => getBlogArticle(articleId),
    enabled: !!articleId,
  })

  const article = data?.data ?? null

  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [coverImage, setCoverImage] = useState('')
  const [tags, setTags] = useState('')
  const [status, setStatus] = useState<BlogArticleStatus>('draft')
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState<number | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [analyzeRequested, setAnalyzeRequested] = useState(0)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [editMode, setEditMode] = useState<'preview' | 'edit'>('preview')
  const [genTitleRequested, setGenTitleRequested] = useState(0)
  const [genSummaryRequested, setGenSummaryRequested] = useState(0)
  const [generatingField, setGeneratingField] = useState<'title' | 'summary' | null>(null)

  const requestAnalyze = useCallback(() => {
    setAnalyzeRequested((prev) => prev + 1)
  }, [])

  const requestGenTitle = useCallback(() => {
    setGenTitleRequested((prev) => prev + 1)
  }, [])

  const requestGenSummary = useCallback(() => {
    setGenSummaryRequested((prev) => prev + 1)
  }, [])

  // Sync from fetched article to local state
  useEffect(() => {
    if (article) {
      setContent(article.content)
      setTitle(article.title)
      setSummary(article.summary)
      setCoverImage(article.cover_image ?? '')
      setTags(article.tags.join(', '))
      setStatus(article.status)
      setInitialized(true)
    }
  }, [article])

  // Reset selection when article changes
  useEffect(() => {
    setSelectedParagraphIndex(null)
  }, [articleId])

  const isDirty =
    initialized &&
    article != null &&
    (content !== article.content ||
      title !== article.title ||
      summary !== article.summary ||
      coverImage !== (article.cover_image ?? '') ||
      tags !== article.tags.join(', ') ||
      status !== article.status)

  const selectedParagraphText = (() => {
    if (selectedParagraphIndex === null) return null
    const blocks = splitMarkdownIntoParagraphs(content)
    return blocks[selectedParagraphIndex]?.trim() ?? null
  })()

  const save = useCallback(async () => {
    if (!article || isSaving) return
    setIsSaving(true)
    try {
      const parsedTags = tags
        ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        : []
      const result = await updateBlogArticle(article.id, {
        title,
        summary,
        content,
        cover_image: coverImage,
        tags: parsedTags,
        status,
      })
      if (result.success) {
        toast.success(t('Article updated.'))
        void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
        void queryClient.invalidateQueries({ queryKey: ['blog-article', articleId] })
      }
    } finally {
      setIsSaving(false)
    }
  }, [article, articleId, content, coverImage, isSaving, queryClient, status, summary, t, tags, title])

  const selectParagraph = useCallback((index: number | null) => {
    setSelectedParagraphIndex((prev) => (prev === index ? null : index))
  }, [])

  return (
    <BlogWorkspaceContext.Provider
      value={{
        article,
        isLoading,
        isDirty,
        content,
        setContent,
        title,
        setTitle,
        summary,
        setSummary,
        coverImage,
        setCoverImage,
        tags,
        setTags,
        status,
        setStatus,
        selectedParagraphIndex,
        selectedParagraphText,
        selectParagraph,
        save,
        isSaving,
        analyzeRequested,
        isAnalyzing,
        requestAnalyze,
        setAnalyzing: setIsAnalyzing,
        editMode,
        setEditMode,
        genTitleRequested,
        genSummaryRequested,
        requestGenTitle,
        requestGenSummary,
        generatingField,
        setGeneratingField,
      }}
    >
      {children}
    </BlogWorkspaceContext.Provider>
  )
}
