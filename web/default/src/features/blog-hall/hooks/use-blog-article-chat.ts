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
import { useCallback, useRef, useState } from 'react'

import { useStreamRequest } from '@/features/playground/hooks/use-stream-request'
import type { ChatCompletionRequest } from '@/features/playground/types'

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
}

export function useBlogArticleChat({
  model = 'gpt-4o-mini',
  content,
  selectedParagraphIndex,
  selectedParagraphText,
}: UseBlogArticleChatOptions) {
  const [messages, setMessages] = useState<BlogChatMessage[]>([])
  const { sendStreamRequest, stopStream } = useStreamRequest()
  const isStreamingRef = useRef(false)

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

      const systemPrompt = buildSystemPrompt(
        content,
        selectedParagraphIndex,
        selectedParagraphText
      )

      const chatMessages: ChatCompletionRequest['messages'] = [
        { role: 'system', content: systemPrompt },
      ]

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
        undefined,
        // onUpdate
        (_type, chunk) => {
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

function buildSystemPrompt(
  articleContent: string,
  paragraphIndex: number | null,
  paragraphText: string | null
): string {
  const parts = [
    'You are an AI writing assistant helping edit a blog article.',
    'The user may ask you to rewrite, improve, expand, or modify parts of the article.',
    '',
    'When you produce revised text for a paragraph, wrap it in a fenced code block with the language `revised-paragraph` like this:',
    '```revised-paragraph',
    'Your revised text here...',
    '```',
    '',
    'This allows the system to offer an "Apply" button to replace the selected paragraph.',
    '',
  ]

  if (articleContent) {
    const truncated =
      articleContent.length > 4000
        ? articleContent.slice(0, 4000) + '\n\n[...truncated]'
        : articleContent
    parts.push('## Current article content:', '', truncated, '')
  }

  if (paragraphIndex !== null && paragraphText) {
    parts.push(
      `## Selected paragraph (index ${paragraphIndex}):`,
      '',
      paragraphText,
      ''
    )
  }

  return parts.join('\n')
}
