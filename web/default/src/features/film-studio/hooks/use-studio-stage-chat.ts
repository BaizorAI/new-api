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

export interface StageChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'complete' | 'streaming' | 'loading' | 'error'
}

interface UseStudioStageChatOptions {
  projectId: number
  stageKey: string
  model?: string
  onMessageComplete?: (messageId: string, content: string) => void
}

export function useStudioStageChat({
  projectId,
  stageKey,
  model = 'huayu-v2',
  onMessageComplete,
}: UseStudioStageChatOptions) {
  const [messages, setMessages] = useState<StageChatMessage[]>([])
  const { sendStreamRequest, stopStream } = useStreamRequest()
  const isStreamingRef = useRef(false)

  const hermesSessionId = useMemo(() => {
    const userId = useAuthStore.getState().auth.user?.id ?? 'anon'
    return getOrCreatePlaygroundSessionId(
      `film_studio_p${projectId}_${stageKey}_u${userId}`
    )
  }, [projectId, stageKey])

  const requestHeaders = useMemo<Record<string, string>>(
    () => ({
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': hermesSessionId,
      'X-Baizor-Hermes-Workspace': 'skill_film_studio',
      'X-Baizor-Hermes-Skill-Activate': 'film_studio',
    }),
    [hermesSessionId]
  )

  const onMessageCompleteRef = useRef(onMessageComplete)
  onMessageCompleteRef.current = onMessageComplete

  const sendMessage = useCallback(
    (text: string, opts?: { scriptContext?: string; selectionContext?: string }) => {
      if (isStreamingRef.current) return

      const userMessage: StageChatMessage = {
        id: nanoid(),
        role: 'user',
        content: text,
        status: 'complete',
      }

      const assistantMessage: StageChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: '',
        status: 'loading',
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      isStreamingRef.current = true

      const chatMessages: ChatCompletionRequest['messages'] = []

      // Inject script context as a system message if provided
      if (opts?.scriptContext) {
        let systemContent = `你是影视剧本创作助手。以下是当前剧本全文：\n---\n${opts.scriptContext}\n---\n`
        if (opts.selectionContext) {
          systemContent += `用户选中了以下段落请你重点关注：\n${opts.selectionContext}\n\n`
        }
        systemContent += '请根据用户的指令修改剧本。回复时直接给出修改后的完整段落（或完整剧本），用 ```script 代码块包裹修改内容。'
        chatMessages.push({ role: 'system', content: systemContent })
      }

      // Include recent chat history
      for (const msg of messages.slice(-6)) {
        chatMessages.push({ role: msg.role, content: msg.content })
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
        () => {
          isStreamingRef.current = false
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            const completed = { ...last, status: 'complete' as const }
            // Notify parent that the assistant message is complete
            onMessageCompleteRef.current?.(completed.id, completed.content)
            return [
              ...prev.slice(0, -1),
              completed,
            ]
          })
        },
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
    [messages, model, requestHeaders, sendStreamRequest]
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
