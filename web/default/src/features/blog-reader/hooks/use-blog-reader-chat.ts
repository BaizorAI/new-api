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
import { useCallback, useMemo, useRef, useState } from 'react'

import { useStreamRequest } from '@/features/playground/hooks/use-stream-request'
import { getOrCreatePlaygroundSessionId } from '@/features/playground/lib/storage'
import type { ChatCompletionRequest } from '@/features/playground/types'
import { useAuthStore } from '@/stores/auth-store'

export interface ReaderChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'complete' | 'streaming' | 'loading' | 'error'
}

export type ReaderPromptType = 'summarize' | 'simplify' | 'takeaways' | 'related'

interface UseBlogReaderChatOptions {
  articleId: number
  title: string
  summary: string
  content: string
  model?: string
}

const MAX_CONTEXT_CHARS = 8000

export function useBlogReaderChat({
  articleId,
  title,
  summary,
  content,
  model = 'huayu-v2',
}: UseBlogReaderChatOptions) {
  const [messages, setMessages] = useState<ReaderChatMessage[]>([])
  const { sendStreamRequest, stopStream } = useStreamRequest()
  const isStreamingRef = useRef(false)
  const streamedContentRef = useRef('')
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const user = useAuthStore((state) => state.auth.user)

  const hermesSessionId = useMemo(() => {
    const userId = user?.id ?? 'anon'
    return getOrCreatePlaygroundSessionId(`skill_blog_reader_a${articleId}_u${userId}`)
  }, [articleId, user?.id])

  const requestHeaders = useMemo<Record<string, string>>(
    () => ({
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': hermesSessionId,
      'X-Baizor-Hermes-Workspace': 'skill_blog_reader',
      'X-Baizor-Hermes-Skill-Activate': '/blog-reader-v1',
    }),
    [hermesSessionId]
  )

  const buildArticleContext = useCallback(() => {
    const parts: string[] = []
    if (title) parts.push(`标题：${title}`)
    if (summary) parts.push(`摘要：${summary}`)
    const truncated =
      content.length > MAX_CONTEXT_CHARS
        ? `${content.slice(0, MAX_CONTEXT_CHARS)}\n\n[...truncated]`
        : content
    parts.push('', '--- 文章内容 ---', truncated, '---')
    return parts.join('\n')
  }, [title, summary, content])

  const presetText: Record<ReaderPromptType, string> = useMemo(
    () => ({
      summarize: '请帮我总结这篇文章的核心内容。',
      simplify: '请用通俗易懂的语言解释这篇文章。',
      takeaways: '请列出这篇文章的关键要点。',
      related: '请基于这篇文章的主题，推荐一些延伸阅读方向。',
    }),
    []
  )

  const clearChat = useCallback(() => {
    setMessages([])
  }, [])

  const stopStreaming = useCallback(() => {
    stopStream()
    isStreamingRef.current = false
    setMessages((prev) => {
      const last = prev.at(-1)
      if (!last || last.role !== 'assistant') return prev
      if (last.status === 'streaming' || last.status === 'loading') {
        return [...prev.slice(0, -1), { ...last, status: 'complete' as const }]
      }
      return prev
    })
  }, [stopStream])

  const sendMessage = useCallback(
    (text: string) => {
      if (!text.trim() || isStreamingRef.current) return

      const userMessage: ReaderChatMessage = {
        id: nanoid(),
        role: 'user',
        content: text.trim(),
        status: 'complete',
      }
      const assistantMessage: ReaderChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: '',
        status: 'loading',
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      isStreamingRef.current = true
      streamedContentRef.current = ''

      const chatMessages: ChatCompletionRequest['messages'] = [
        {
          role: 'system',
          content: buildArticleContext(),
        },
      ]

      // Include recent history for continuity
      for (const msg of messagesRef.current.slice(-6)) {
        chatMessages.push({
          role: msg.role,
          content: msg.content,
        })
      }

      chatMessages.push({ role: 'user', content: text.trim() })

      const payload: ChatCompletionRequest = {
        model,
        messages: chatMessages,
        stream: true,
      }

      sendStreamRequest(
        payload,
        requestHeaders,
        (_type, chunk) => {
          streamedContentRef.current += chunk
          setMessages((prev) => {
            const last = prev.at(-1)
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              { ...last, content: last.content + chunk, status: 'streaming' },
            ]
          })
        },
        () => {
          isStreamingRef.current = false
          setMessages((prev) => {
            const last = prev.at(-1)
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              { ...last, status: 'complete' },
            ]
          })
        },
        (error) => {
          isStreamingRef.current = false
          setMessages((prev) => {
            const last = prev.at(-1)
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
    [buildArticleContext, model, requestHeaders, sendStreamRequest]
  )

  const runPreset = useCallback(
    (type: ReaderPromptType) => {
      sendMessage(presetText[type])
    },
    [presetText, sendMessage]
  )

  return {
    messages,
    sendMessage,
    runPreset,
    clearChat,
    stopStream: stopStreaming,
  }
}
