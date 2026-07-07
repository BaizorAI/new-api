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

export interface BlogChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'complete' | 'streaming' | 'loading' | 'error'
  paragraphIndex: number | null
  paragraphText: string | null
}

interface UseBlogArticleChatOptions {
  model?: string
  content: string
  selectedParagraphIndex: number | null
  selectedParagraphText: string | null
  onComplete?: (responseContent: string) => void
}

export function useBlogArticleChat({
  model = 'huayu-v2',
  content,
  selectedParagraphIndex,
  selectedParagraphText,
  onComplete,
}: UseBlogArticleChatOptions) {
  const [messages, setMessages] = useState<BlogChatMessage[]>([])
  const { sendStreamRequest, stopStream } = useStreamRequest()
  const isStreamingRef = useRef(false)
  const streamedContentRef = useRef('')

  const hermesSessionId = useMemo(() => {
    const userId = useAuthStore.getState().auth.user?.id ?? 'anon'
    return getOrCreatePlaygroundSessionId(`skill_blog_user_${userId}`)
  }, [])

  const requestHeaders = useMemo<Record<string, string>>(
    () => ({
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': hermesSessionId,
      'X-Baizor-Hermes-Workspace': 'skill_blog',
      'X-Baizor-Hermes-Skill-Activate': 'blog',
    }),
    [hermesSessionId]
  )

  const sendMessage = useCallback(
    (text: string) => {
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

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      isStreamingRef.current = true
      streamedContentRef.current = ''

      const chatMessages: ChatCompletionRequest['messages'] = []

      // Include article context and paragraph selection as system context
      if (content || (selectedParagraphIndex !== null && selectedParagraphText)) {
        const contextParts: string[] = []
        if (content) {
          const truncated =
            content.length > 4000
              ? content.slice(0, 4000) + '\n\n[...truncated]'
              : content
          contextParts.push('## Current article content:', '', truncated)
        }
        if (selectedParagraphIndex !== null && selectedParagraphText) {
          contextParts.push(
            '',
            `## Selected paragraph (index ${selectedParagraphIndex}):`,
            '',
            selectedParagraphText
          )
        }
        chatMessages.push({ role: 'system', content: contextParts.join('\n') })
      }

      // Include recent chat history for context
      for (const msg of messages.slice(-6)) {
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
            return [
              ...prev.slice(0, -1),
              { ...last, status: 'complete' },
            ]
          })
          onComplete?.(streamedContentRef.current)
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
      content,
      messages,
      model,
      onComplete,
      requestHeaders,
      selectedParagraphIndex,
      selectedParagraphText,
      sendStreamRequest,
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

  const clearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const isStreaming = messages.some(
    (m) => m.status === 'loading' || m.status === 'streaming'
  )

  return {
    messages,
    sendMessage,
    stopGeneration,
    clearMessages,
    isStreaming,
  }
}
