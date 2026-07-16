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
  clearStudioChatMessages,
  deleteStudioChatMessage,
  getStudioAgentTask,
  getStudioChatMessages,
  saveStudioChatMessages,
} from '../api'

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
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [agentTaskId, setAgentTaskId] = useState<string | null>(null)
  const messagesRef = useRef(messages)
  messagesRef.current = messages
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
      'X-Baizor-Hermes-Skill-Activate': '/magicalbrush',
    }),
    [hermesSessionId]
  )

  const onMessageCompleteRef = useRef(onMessageComplete)
  onMessageCompleteRef.current = onMessageComplete

  // Load persisted chat history on mount
  useEffect(() => {
    let cancelled = false
    getStudioChatMessages(projectId, stageKey)
      .then((res) => {
        if (cancelled) return
        if (res.success && Array.isArray(res.data)) {
          const history: StageChatMessage[] = res.data.map((m) => ({
            id: String(m.id),
            role: m.role,
            content: m.content,
            status: 'complete' as const,
          }))
          setMessages(history)
        }
      })
      .catch(() => {
        // Silently ignore load failures — chat still works without history
      })
      .finally(() => {
        if (!cancelled) setLoadingHistory(false)
      })
    return () => { cancelled = true }
  }, [projectId, stageKey])

  // Poll agent task result when one is pending
  useEffect(() => {
    if (!agentTaskId) return
    let cancelled = false
    const poll = async () => {
      try {
        const res = await getStudioAgentTask(agentTaskId)
        if (cancelled) return
        if (!res.success || !res.data) return
        const { status, response_payload } = res.data
        if (status === 'succeeded' && response_payload) {
          // Extract assistant text from OpenAI response
          let text = ''
          try {
            const parsed = JSON.parse(response_payload)
            text = parsed?.choices?.[0]?.message?.content ?? ''
          } catch { /* ignore parse failures */ }
          if (text) {
            setMessages((prev) => [
              ...prev,
              {
                id: `agent_${agentTaskId}`,
                role: 'assistant',
                content: text,
                status: 'complete',
              },
            ])
          }
          setAgentTaskId(null)
        } else if (status === 'failed' || status === 'canceled') {
          setAgentTaskId(null)
        } else {
          // Still running — poll again in 3s
          setTimeout(() => { if (!cancelled) poll() }, 3000)
        }
      } catch {
        // Retry on network error
        setTimeout(() => { if (!cancelled) poll() }, 5000)
      }
    }
    poll()
    return () => { cancelled = true }
  }, [agentTaskId])

  const sendMessage = useCallback(
    (
      text: string,
      opts?: {
        scriptContext?: string
        selectionContext?: string
        paragraphContext?: { index: number; text: string }
        modificationType?: string
      }
    ) => {
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

      // Capture for the onComplete closure
      const userContent = text

      setMessages((prev) => [...prev, userMessage, assistantMessage])
      isStreamingRef.current = true

      const chatMessages: ChatCompletionRequest['messages'] = []

      // Inject script context as a system message if provided
      if (opts?.scriptContext) {
        let systemContent: string
        if (opts.modificationType === 'analyze') {
          // AI Analysis mode — evaluate readiness for next stage
          systemContent = `你是影视剧本创作助手，使用 MagicalBrush 技能。请对以下剧本进行全面分析。\n\n`
          systemContent += `**首先，判断剧本的时空背景：**\n`
          systemContent += `- 年代/朝代（古代/现代/未来/具体朝代）\n`
          systemContent += `- 地域/国家（中国/西方/架空世界等）\n`
          systemContent += `- 故事类型和基调\n\n`
          systemContent += `然后从以下维度评估剧本是否已准备好进入下一阶段（角色设计和分镜）：\n`
          systemContent += `1. 故事结构是否完整（起承转合）\n`
          systemContent += `2. 场景描述是否清晰具体（时间、地点、氛围）\n`
          systemContent += `3. 对话是否自然生动\n`
          systemContent += `4. 角色是否足够鲜明（外貌、性格、动机）\n`
          systemContent += `5. 是否已包含足够信息供角色设计和分镜使用\n\n`
          systemContent += `最后请明确给出结论：\n`
          systemContent += `- 如果可以通过：✅ **可以进入下一阶段**，简述理由\n`
          systemContent += `- 如果需要修改：⚠️ **建议修改**，列出需要改进的地方\n\n`
          systemContent += `**重要：将时空背景结论放在回复最前面，方便后续角色设计阶段参考。**\n\n`
          systemContent += `以下是剧本全文：\n---\n${opts.scriptContext}\n---`
        } else if (opts.modificationType === 'generate') {
          // Script generation mode — create a script from a project brief
          systemContent = `你是专业影视编剧，使用 MagicalBrush 技能。请根据项目简报生成一份完整的影视剧本。\n`
          systemContent += `使用标准剧本格式，包括场景标题（INT./EXT. 地点 - 时间）、动作描述和人物对话。\n`
          systemContent += `确保故事有清晰的开头、发展和结尾。\n`
          systemContent += `用 \`\`\`script 代码块包裹完整剧本。`
        } else if (opts.modificationType === 'rewrite_from_analysis') {
          // Rewrite script based on prior analysis suggestions
          systemContent = `你是专业影视编剧，使用 MagicalBrush 技能。\n`
          systemContent += `之前的分析已经指出了剧本的改进方向。请根据分析建议，重写以下完整剧本。\n`
          systemContent += `保留原剧本的故事核心和角色，融入所有可行的改进建议。\n`
          systemContent += `输出完整的修改后剧本，用 \`\`\`script 代码块包裹。\n\n`
          systemContent += `以下是需要修改的当前剧本：\n---\n${opts.scriptContext}\n---`
        } else {
          systemContent = `你是影视剧本创作助手，使用 MagicalBrush 技能。以下是当前剧本全文：\n---\n${opts.scriptContext}\n---\n`
          if (opts.paragraphContext) {
            systemContent += `\n用户选中了第 ${opts.paragraphContext.index + 1} 段剧本请你修改：\n段落原文：${opts.paragraphContext.text}\n`
            if (opts.selectionContext) {
              systemContent += `用户选中的具体片段：${opts.selectionContext}\n`
            }
            if (opts.modificationType) {
              systemContent += `用户希望对选中段落进行【${opts.modificationType}】操作。\n`
            }
            systemContent += '\n请只输出修改后的段落文本（不是整个剧本），用 ```revised-paragraph 代码块包裹修改内容。保持原有的格式和风格，只修改选中的段落。'
          } else if (opts.selectionContext) {
            systemContent += `用户选中了以下片段请你重点关注：\n${opts.selectionContext}\n\n`
            if (opts.modificationType) {
              systemContent += `用户希望对选中内容进行【${opts.modificationType}】操作。\n`
            }
            systemContent += '请根据用户的指令修改剧本。回复时直接给出修改后的完整段落（或完整剧本），用 ```script 代码块包裹修改内容。'
          } else {
            systemContent += '请根据用户的指令修改剧本。回复时直接给出修改后的完整段落（或完整剧本），用 ```script 代码块包裹修改内容。'
          }
        }
        chatMessages.push({ role: 'system', content: systemContent })
      }

      // Include recent chat history (use ref to avoid recreating sendMessage on every chunk)
      for (const msg of messagesRef.current.slice(-6)) {
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
            // Persist both messages to the backend
            saveStudioChatMessages(projectId, stageKey, [
              { role: 'user', content: userContent },
              { role: 'assistant', content: completed.content },
            ]).catch(() => {})
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
    [model, requestHeaders, sendStreamRequest]
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
    // Fire-and-forget: clear server-side too
    clearStudioChatMessages(projectId, stageKey).catch(() => {})
  }, [projectId, stageKey])

  const deleteMessage = useCallback(async (msgId: string) => {
    setMessages((prev) => prev.filter((m) => m.id !== msgId))
    const numericId = Number(msgId)
    if (!Number.isNaN(numericId)) {
      deleteStudioChatMessage(projectId, stageKey, numericId).catch(() => {})
    }
  }, [projectId, stageKey])

  /** Start polling an agent task. Called after creating a task. */
  const startAgentTask = useCallback((taskId: string) => {
    setAgentTaskId(taskId)
  }, [])

  /** Add a pre-completed assistant message to the chat (e.g. from Quick Analyze). */
  const addAssistantMessage = useCallback((content: string) => {
    const msg: StageChatMessage = {
      id: nanoid(),
      role: 'assistant',
      content,
      status: 'complete',
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
    deleteMessage,
    addAssistantMessage,
    startAgentTask,
    isStreaming,
  }
}
