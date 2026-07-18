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
import { nanoid } from 'nanoid'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { useStreamRequest } from '@/features/playground/hooks/use-stream-request'
import { getOrCreatePlaygroundSessionId } from '@/features/playground/lib/storage'
import type { ChatCompletionRequest } from '@/features/playground/types'
import { useAuthStore } from '@/stores/auth-store'

import {
  clearBlogChatMessages,
  getBlogChatMessages,
  saveBlogChatMessages,
} from '../api'

export interface BlogChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'complete' | 'streaming' | 'loading' | 'error'
  paragraphIndex: number | null
  paragraphText: string | null
}

export type BlogModificationType =
  | 'analyze'
  | 'generate'
  | 'polish'
  | 'expand'
  | 'shorten'
  | 'rewrite'

interface UseBlogArticleChatOptions {
  articleId: number
  model?: string
  content: string
  selectedParagraphIndex: number | null
  selectedParagraphText: string | null
  onComplete?: (responseContent: string) => void
  title?: string
  summary?: string
}

export function useBlogArticleChat({
  articleId,
  model = 'huayu-v2',
  content,
  selectedParagraphIndex,
  selectedParagraphText,
  onComplete,
  title = '',
  summary = '',
}: UseBlogArticleChatOptions) {
  const [messages, setMessages] = useState<BlogChatMessage[]>([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const { sendStreamRequest, stopStream } = useStreamRequest()
  const isStreamingRef = useRef(false)
  const streamedContentRef = useRef('')
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const hermesSessionId = useMemo(() => {
    const userId = useAuthStore.getState().auth.user?.id ?? 'anon'
    return getOrCreatePlaygroundSessionId(`skill_blog_a${articleId}_u${userId}`)
  }, [articleId])

  const requestHeaders = useMemo<Record<string, string>>(
    () => ({
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': hermesSessionId,
      'X-Baizor-Hermes-Workspace': 'skill_blog',
      'X-Baizor-Hermes-Skill-Activate': '/magicalbrush',
    }),
    [hermesSessionId]
  )

  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  // Load persisted chat history — resets when switching articles
  useEffect(() => {
    if (!articleId) { setLoadingHistory(false); return }
    // Clear immediately when switching articles to avoid flash of old messages
    setMessages([])
    setLoadingHistory(true)
    let cancelled = false
    getBlogChatMessages(articleId)
      .then((res) => {
        if (cancelled) return
        if (res.success && Array.isArray(res.data)) {
          const history: BlogChatMessage[] = res.data.map((m) => ({
            id: String(m.id),
            role: m.role,
            content: m.content,
            status: 'complete' as const,
            paragraphIndex: null,
            paragraphText: null,
          }))
          setMessages(history)
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => { cancelled = true }
  }, [articleId])

  const sendMessage = useCallback(
    (
      text: string,
      opts?: {
        modificationType?: BlogModificationType
      }
    ) => {
      if (isStreamingRef.current) return

      const userMessage: BlogChatMessage = {
        id: nanoid(),
        role: 'user',
        content: text,
        status: 'complete',
        paragraphIndex: selectedParagraphIndex,
        paragraphText: selectedParagraphText,
      }

      const assistantMessage: BlogChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: '',
        status: 'loading',
        paragraphIndex: selectedParagraphIndex,
        paragraphText: null,
      }

      const userContent = text

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      isStreamingRef.current = true
      streamedContentRef.current = ''

      const chatMessages: ChatCompletionRequest['messages'] = []

      // Build rich system context based on modification type
      const modType = opts?.modificationType

      if (modType === 'analyze') {
        // AI Analysis mode — evaluate article quality and publishing readiness
        const parts: string[] = []
        parts.push(
          '你是一个专业的写作分析助手，使用 MagicalBrush 技能。请对以下文章进行全面分析。',
          '',
          '从以下维度评估文章质量：',
          '1. 结构是否清晰（开头、主体、结尾）',
          '2. 内容是否充实（论据、例子、细节）',
          '3. 语言表达是否流畅优美',
          '4. SEO优化程度（标题、关键词、可读性）',
          '5. 是否适合发布（整体完成度）',
          '',
          '最后明确给出结论：',
          '- 如果可以发布：✅ **可以发布**，简述理由',
          '- 如果需要修改：⚠️ **建议修改**，列出需要改进的地方'
        )
        if (title) parts.push('', `标题：${title}`)
        if (summary) parts.push(`摘要：${summary}`)
        if (content) {
          const truncated = content.length > 8000 ? content.slice(0, 8000) + '\n\n[...truncated]' : content
          parts.push('', '以下是文章全文：', '---', truncated, '---')
        }
        chatMessages.push({ role: 'system', content: parts.join('\n') })
      } else if (modType === 'generate') {
        // Article generation mode — create a full article from a topic/brief
        const parts: string[] = []
        parts.push(
          '你是一个专业的博客写作助手，使用 MagicalBrush 技能。请根据用户提供的主题和要求，生成一篇结构完整、内容丰富的博客文章。',
          '',
          '要求：',
          '- 使用 Markdown 格式',
          '- 包含引人入胜的标题',
          '- 结构清晰：引言 → 主体内容（分多个小节）→ 总结',
          '- 内容充实，提供有价值的信息',
          '- 语言流畅自然，适合公开发表',
          '- 用 ```markdown 代码块包裹完整文章'
        )
        chatMessages.push({ role: 'system', content: parts.join('\n') })
      } else if (
        modType === 'polish' ||
        modType === 'expand' ||
        modType === 'shorten' ||
        modType === 'rewrite'
      ) {
        // Paragraph-level AI modification
        const prompts: Record<string, string> = {
          polish: '请润色以下段落，使其更加流畅优美：',
          expand: '请扩写以下段落，增加更多细节和描写：',
          shorten: '请精简以下段落，保留核心内容：',
          rewrite: '请用不同的方式改写以下段落：',
        }
        const parts: string[] = []
        parts.push(
          '你是一个专业的写作编辑助手，使用 MagicalBrush 技能。',
          '',
          '以下是当前文章的上下文：'
        )
        if (title) parts.push(`标题：${title}`)
        if (content) {
          const truncated = content.length > 4000 ? content.slice(0, 4000) + '\n\n[...truncated]' : content
          parts.push('', '## 当前文章内容：', '', truncated)
        }
        if (selectedParagraphIndex !== null && selectedParagraphText) {
          parts.push(
            '',
            `## 用户选中了第 ${selectedParagraphIndex + 1} 段进行【${modType}】操作：`,
            '',
            selectedParagraphText,
            '',
            '请只输出修改后的段落文本，用 ```revised-paragraph 代码块包裹修改内容。保持原有的格式和风格，只输出修改后的段落。'
          )
        }
        chatMessages.push({ role: 'system', content: parts.join('\n') })
      } else {
        // General chat — include article context and paragraph selection
        if (content || (selectedParagraphIndex !== null && selectedParagraphText)) {
          const contextParts: string[] = []
          if (title) contextParts.push(`标题：${title}`)
          if (content) {
            const truncated =
              content.length > 4000
                ? content.slice(0, 4000) + '\n\n[...truncated]'
                : content
            contextParts.push('## 当前文章内容：', '', truncated)
          }
          if (selectedParagraphIndex !== null && selectedParagraphText) {
            contextParts.push(
              '',
              `## 选中段落 (第 ${selectedParagraphIndex + 1} 段)：`,
              '',
              selectedParagraphText
            )
          }
          chatMessages.push({ role: 'system', content: contextParts.join('\n') })
        }
      }

      // Include recent chat history for context
      for (const msg of messagesRef.current.slice(-6)) {
        chatMessages.push({
          role: msg.role,
          content: msg.content,
        })
      }

      chatMessages.push({ role: 'user', content: text })

      const payload: ChatCompletionRequest = {
        model,
        messages: chatMessages,
        stream: true,
      }

      sendStreamRequest(
        payload,
        requestHeaders,
        // onUpdate
        (_type, chunk) => {
          streamedContentRef.current += chunk
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + chunk, status: 'streaming' },
            ]
          })
        },
        // onComplete
        () => {
          isStreamingRef.current = false
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            const completed = { ...last, status: 'complete' as const }
            // Persist both messages to the backend
            if (articleId) {
              saveBlogChatMessages(articleId, [
                { role: 'user', content: userContent },
                { role: 'assistant', content: completed.content },
              ]).catch(() => {})
            }
            onCompleteRef.current?.(completed.content)
            return [
              ...prev.slice(0, -1),
              completed,
            ]
          })
        },
        // onError
        (error) => {
          isStreamingRef.current = false
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                content: error || 'An error occurred',
                status: 'error',
              },
            ]
          })
        }
      )
    },
    [
      articleId,
      content,
      messages,
      model,
      requestHeaders,
      selectedParagraphIndex,
      selectedParagraphText,
      sendStreamRequest,
      summary,
      title,
    ]
  )

  const stopGeneration = useCallback(() => {
    stopStream()
    isStreamingRef.current = false
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [
        ...prev.slice(0, -1),
        { ...last, status: 'complete' },
      ]
    })
  }, [stopStream])

  const clearMessages = useCallback(async () => {
    setMessages([])
    if (articleId) {
      clearBlogChatMessages(articleId).catch(() => {})
    }
  }, [articleId])

  const addAssistantMessage = useCallback((content: string) => {
    const msg: BlogChatMessage = {
      id: nanoid(),
      role: 'assistant',
      content,
      status: 'complete',
      paragraphIndex: null,
      paragraphText: null,
    }
    setMessages((prev) => [...prev, msg])
  }, [])

  const isStreaming = messages.some(
    (m) => m.status === 'loading' || m.status === 'streaming'
  )

  return {
    messages,
    loadingHistory,
    sendMessage,
    stopGeneration,
    clearMessages,
    addAssistantMessage,
    isStreaming,
  }
}
