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
import { useCallback, useState } from 'react'
import { toast } from 'sonner'

import {
  createHermesExecutionTask,
  getHermesExecutionTask,
  type HermesExecutionTask,
} from '@/features/hermes-playground/api'

import { sendChatCompletion } from '../api'
import { MESSAGE_STATUS, ERROR_MESSAGES } from '../constants'
import {
  buildChatCompletionPayload,
  updateAssistantMessageWithError,
  updateLastAssistantMessage,
  processStreamingContent,
  finalizeMessage,
} from '../lib'
import type { Message, PlaygroundConfig, ParameterEnabled } from '../types'
import { useStreamRequest } from './use-stream-request'

interface HermesExecutionTaskContext {
  workspaceMode: string
  conversationId: string
  storageScope: string
  hermesSessionId: string
  teamId?: number
  teamName?: string
  title?: string
  onTaskCreated?: (task: HermesExecutionTask) => void
  onTaskSettled?: (task: HermesExecutionTask) => void
}

interface UseChatHandlerOptions {
  config: PlaygroundConfig
  parameterEnabled: ParameterEnabled
  onMessageUpdate: (updater: (prev: Message[]) => Message[]) => void
  requestHeaders?: Record<string, string>
  executionTaskContext?: HermesExecutionTaskContext
}

type PlaygroundErrorData = {
  message?: string
  error?: {
    message?: string
    code?: unknown
  }
}

function extractChatError(error: unknown): {
  message: string
  code?: string
} {
  const err = error as {
    response?: { data?: PlaygroundErrorData }
    message?: string
  }
  const data = err?.response?.data
  const errorCode = data?.error?.code

  let code: string | undefined
  if (typeof errorCode === 'string') {
    code = errorCode
  } else if (errorCode != null) {
    code = String(errorCode)
  }

  return {
    message:
      data?.error?.message?.trim() ||
      data?.message?.trim() ||
      err?.message ||
      ERROR_MESSAGES.API_REQUEST_ERROR,
    code,
  }
}

/**
 * Hook for handling chat message sending and receiving
 */
export function useChatHandler({
  config,
  parameterEnabled,
  onMessageUpdate,
  requestHeaders,
  executionTaskContext,
}: UseChatHandlerOptions) {
  const { sendStreamRequest, stopStream, isStreaming } = useStreamRequest()
  const [isExecutionTaskRunning, setIsExecutionTaskRunning] = useState(false)

  // Handle stream update
  const handleStreamUpdate = useCallback(
    (type: 'reasoning' | 'content', chunk: string) => {
      onMessageUpdate((prev) =>
        updateLastAssistantMessage(prev, (message) => {
          if (message.status === MESSAGE_STATUS.ERROR) return message

          if (type === 'reasoning') {
            // Direct API reasoning_content
            return {
              ...message,
              reasoning: {
                content: (message.reasoning?.content || '') + chunk,
                duration: 0,
              },
              isReasoningStreaming: true,
              status: MESSAGE_STATUS.STREAMING,
            }
          }

          // Content streaming: handle <think> tags
          return {
            ...processStreamingContent(message, chunk),
            status: MESSAGE_STATUS.STREAMING,
          }
        })
      )
    },
    [onMessageUpdate]
  )

  // Handle stream complete
  const handleStreamComplete = useCallback(() => {
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) =>
        message.status === MESSAGE_STATUS.COMPLETE ||
        message.status === MESSAGE_STATUS.ERROR
          ? message
          : { ...finalizeMessage(message), status: MESSAGE_STATUS.COMPLETE }
      )
    )
  }, [onMessageUpdate])

  // Handle stream error
  const handleStreamError = useCallback(
    (error: string, errorCode?: string) => {
      toast.error(error)
      onMessageUpdate((prev) =>
        updateAssistantMessageWithError(prev, error, errorCode)
      )
    },
    [onMessageUpdate]
  )

  // Send streaming chat request
  const sendStreamingChat = useCallback(
    (messages: Message[]) => {
      const payload = buildChatCompletionPayload(
        messages,
        config,
        parameterEnabled
      )
      sendStreamRequest(
        payload,
        requestHeaders,
        handleStreamUpdate,
        handleStreamComplete,
        handleStreamError
      )
    },
    [
      config,
      parameterEnabled,
      requestHeaders,
      sendStreamRequest,
      handleStreamUpdate,
      handleStreamComplete,
      handleStreamError,
    ]
  )

  // Send non-streaming chat request
  const sendNonStreamingChat = useCallback(
    async (messages: Message[]) => {
      const payload = buildChatCompletionPayload(
        messages,
        config,
        parameterEnabled
      )

      try {
        const response = await sendChatCompletion(payload, requestHeaders)
        const choice = response.choices?.[0]
        if (!choice) return

        onMessageUpdate((prev) =>
          updateLastAssistantMessage(prev, (message) => ({
            ...finalizeMessage(
              {
                ...message,
                versions: [
                  {
                    ...message.versions[0],
                    content: choice.message?.content || '',
                  },
                ],
              },
              choice.message?.reasoning_content
            ),
            status: MESSAGE_STATUS.COMPLETE,
          }))
        )
      } catch (error: unknown) {
        const { message, code } = extractChatError(error)
        handleStreamError(message, code)
      }
    },
    [
      config,
      parameterEnabled,
      requestHeaders,
      onMessageUpdate,
      handleStreamError,
    ]
  )

  const sendExecutionTaskChat = useCallback(
    async (messages: Message[]) => {
      if (!executionTaskContext) return

      const payload = {
        ...buildChatCompletionPayload(messages, config, parameterEnabled),
        stream: false,
      }

      setIsExecutionTaskRunning(true)
      let createdTask: HermesExecutionTask | null = null
      try {
        let task = await createHermesExecutionTask(
          {
            title: executionTaskContext.title,
            workspaceMode: executionTaskContext.workspaceMode,
            conversationId: executionTaskContext.conversationId,
            storageScope: executionTaskContext.storageScope,
            hermesSessionId: executionTaskContext.hermesSessionId,
            teamId: executionTaskContext.teamId,
            payload,
          },
          {
            teamId: executionTaskContext.teamId,
            teamName: executionTaskContext.teamName,
          }
        )
        createdTask = task

        executionTaskContext.onTaskCreated?.(task)
        onMessageUpdate((prev) =>
          updateLastAssistantMessage(prev, (message) => ({
            ...message,
            executionTaskId: task.taskId,
          }))
        )

        while (task.status === 'queued' || task.status === 'running') {
          await sleep(2000)
          task = await getHermesExecutionTask(task.taskId)
        }

        executionTaskContext.onTaskSettled?.(task)

        if (task.status !== 'succeeded') {
          handleStreamError(task.error || ERROR_MESSAGES.API_REQUEST_ERROR)
          return
        }

        const result = extractExecutionTaskAssistantResult(task.responsePayload)
        onMessageUpdate((prev) =>
          updateLastAssistantMessage(prev, (message) => ({
            ...finalizeMessage(
              {
                ...message,
                versions: [
                  {
                    ...message.versions[0],
                    content: result.content,
                  },
                ],
              },
              result.reasoningContent
            ),
            status: MESSAGE_STATUS.COMPLETE,
          }))
        )
      } catch (error: unknown) {
        if (createdTask) {
          return
        }
        const { message, code } = extractChatError(error)
        handleStreamError(message, code)
      } finally {
        setIsExecutionTaskRunning(false)
      }
    },
    [
      config,
      executionTaskContext,
      handleStreamError,
      onMessageUpdate,
      parameterEnabled,
    ]
  )

  // Send chat request (stream or non-stream based on config)
  const sendChat = useCallback(
    (messages: Message[]) => {
      if (executionTaskContext) {
        void sendExecutionTaskChat(messages)
        return
      }

      if (config.stream) {
        sendStreamingChat(messages)
      } else {
        sendNonStreamingChat(messages)
      }
    },
    [
      config.stream,
      executionTaskContext,
      sendExecutionTaskChat,
      sendStreamingChat,
      sendNonStreamingChat,
    ]
  )

  // Stop generation
  const stopGeneration = useCallback(() => {
    stopStream()
    onMessageUpdate((prev) =>
      updateLastAssistantMessage(prev, (message) =>
        message.status === MESSAGE_STATUS.LOADING ||
        message.status === MESSAGE_STATUS.STREAMING
          ? { ...finalizeMessage(message), status: MESSAGE_STATUS.COMPLETE }
          : message
      )
    )
  }, [stopStream, onMessageUpdate])

  return {
    sendChat,
    stopGeneration,
    isGenerating: isStreaming || isExecutionTaskRunning,
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function extractExecutionTaskAssistantResult(payload: unknown): {
  content: string
  reasoningContent?: string
} {
  const record = asRecord(payload)
  const choices = Array.isArray(record.choices) ? record.choices : []
  const firstChoice = asRecord(choices[0])
  const message = asRecord(firstChoice.message)
  return {
    content: stringFromUnknown(message.content),
    reasoningContent: stringFromUnknown(message.reasoning_content) || undefined,
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

function stringFromUnknown(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
