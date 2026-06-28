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
import { useQuery } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { PromptInputSubmittedFile } from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import type { HermesExecutionTask } from '@/features/hermes-playground/api'

import { getUserModels, getUserGroups } from './api'
import { PlaygroundChat } from './components/playground-chat'
import {
  PlaygroundInput,
  type PlaygroundSlashAction,
} from './components/playground-input'
import { usePlaygroundState, useChatHandler } from './hooks'
import { createUserMessage, createLoadingAssistantMessage } from './lib'
import type {
  Message as MessageType,
  ModelOption,
  PlaygroundConfig,
} from './types'

interface PlaygroundExecutionTaskContext {
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

interface PlaygroundProps {
  storageScope?: string
  defaultConfig?: PlaygroundConfig
  modelFilter?: (model: ModelOption) => boolean
  modelCapability?: 'chat'
  queryKeyPrefix?: string
  requestHeaders?: Record<string, string>
  emptyModelsMessage?: string
  onMessagesChange?: (messages: MessageType[]) => void
  enableSlashCommands?: boolean
  onNewSession?: () => void
  onSaveSession?: (messages: MessageType[]) => void
  onAddSkill?: () => void
  suggestedPrompts?: { label: string; prompt: string }[]
  quickPromptRequest?: { id: string; prompt: string }
  executionTaskContext?: PlaygroundExecutionTaskContext
}

export function Playground(props: PlaygroundProps = {}) {
  const { t } = useTranslation()
  const {
    config,
    parameterEnabled,
    messages,
    models,
    groups,
    updateMessages,
    setModels,
    setGroups,
    updateConfig,
  } = usePlaygroundState({
    storageScope: props.storageScope,
    defaultConfig: props.defaultConfig,
  })

  const updateMessagesAndNotify = useCallback(
    (updater: MessageType[] | ((prev: MessageType[]) => MessageType[])) => {
      updateMessages((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater
        props.onMessagesChange?.(next)
        return next
      })
    },
    [props, updateMessages]
  )

  const { sendChat, stopGeneration, isGenerating } = useChatHandler({
    config,
    parameterEnabled,
    onMessageUpdate: updateMessagesAndNotify,
    requestHeaders: props.requestHeaders,
    executionTaskContext: props.executionTaskContext,
  })

  // Edit dialog state
  const [editingMessageKey, setEditingMessageKey] = useState<string | null>(
    null
  )
  const handledQuickPromptIdRef = useRef<string | null>(null)

  // Load models
  const { data: modelsData, isLoading: isLoadingModels } = useQuery({
    queryKey: [
      props.queryKeyPrefix ?? 'playground',
      'models',
      props.modelCapability ?? 'all',
    ],
    queryFn: async () => {
      try {
        return await getUserModels({ capability: props.modelCapability })
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load playground models')
        )
        return []
      }
    },
  })

  const availableModels = useMemo(() => {
    if (!modelsData) return []
    if (!props.modelFilter) return modelsData
    return modelsData.filter(props.modelFilter)
  }, [modelsData, props.modelFilter])

  // Load groups
  const { data: groupsData } = useQuery({
    queryKey: [props.queryKeyPrefix ?? 'playground', 'groups'],
    queryFn: async () => {
      try {
        return await getUserGroups()
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t('Failed to load playground groups')
        )
        return []
      }
    },
  })

  // Update models when data changes
  useEffect(() => {
    if (!modelsData) return

    setModels(availableModels)

    // Set default model if current model is not available
    const isCurrentModelValid = availableModels.some(
      (m) => m.value === config.model
    )
    if (availableModels.length > 0 && !isCurrentModelValid) {
      const preferredModel = props.defaultConfig?.model
      const fallbackModel =
        availableModels.find((m) => m.value === preferredModel)?.value ??
        availableModels[0].value
      updateConfig('model', fallbackModel)
    }
  }, [
    modelsData,
    availableModels,
    config.model,
    props.defaultConfig?.model,
    setModels,
    updateConfig,
  ])

  // Update groups when data changes
  useEffect(() => {
    if (!groupsData) return

    setGroups(groupsData)

    const hasCurrentGroup = groupsData.some((g) => g.value === config.group)
    if (!hasCurrentGroup && groupsData.length > 0) {
      const fallback =
        groupsData.find((g) => g.value === 'default')?.value ??
        groupsData[0].value
      updateConfig('group', fallback)
    }
  }, [groupsData, setGroups, config.group, updateConfig])

  const handleSendMessage = useCallback(
    (text: string, files?: PromptInputSubmittedFile[]) => {
      const userMessage = createUserMessage(
        text,
        files?.map((f) => ({
          url: f.url,
          mediaType: f.mediaType,
          filename: f.filename,
          size: f.size,
        }))
      )
      const assistantMessage = createLoadingAssistantMessage()

      const newMessages = [...messages, userMessage, assistantMessage]
      updateMessagesAndNotify(newMessages)

      // Send chat request
      sendChat(newMessages)
    },
    [messages, sendChat, updateMessagesAndNotify]
  )

  useEffect(() => {
    const request = props.quickPromptRequest
    if (!request || handledQuickPromptIdRef.current === request.id) return
    handledQuickPromptIdRef.current = request.id
    handleSendMessage(request.prompt)
  }, [handleSendMessage, props.quickPromptRequest])

  const handleCopyMessage = (message: MessageType) => {
    // Copy is handled in MessageActions component
    // eslint-disable-next-line no-console
    console.log('Message copied:', message.key)
  }

  const handleRegenerateMessage = (message: MessageType) => {
    // Find the message index and regenerate from there
    const messageIndex = messages.findIndex((m) => m.key === message.key)
    if (messageIndex === -1) return

    // Remove messages after this one and regenerate
    const messagesUpToHere = messages.slice(0, messageIndex)
    const loadingMessage = createLoadingAssistantMessage()
    const newMessages = [...messagesUpToHere, loadingMessage]

    updateMessagesAndNotify(newMessages)
    sendChat(newMessages)
  }

  const handleRetryLatest = useCallback(() => {
    if (isGenerating) return

    let userMessageIndex = -1
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]?.from === 'user') {
        userMessageIndex = index
        break
      }
    }

    if (userMessageIndex === -1) {
      toast.info(t('No user message to retry'))
      return
    }

    const loadingMessage = createLoadingAssistantMessage()
    const messagesToSubmit = [
      ...messages.slice(0, userMessageIndex + 1),
      loadingMessage,
    ]
    updateMessagesAndNotify(messagesToSubmit)
    sendChat(messagesToSubmit)
  }, [isGenerating, messages, sendChat, t, updateMessagesAndNotify])

  const handleSlashAction = useCallback(
    (action: PlaygroundSlashAction) => {
      switch (action) {
        case 'new':
          props.onNewSession?.()
          break
        case 'save':
          props.onSaveSession?.(messages)
          break
        case 'retry':
          handleRetryLatest()
          break
        case 'skill':
          props.onAddSkill?.()
          break
      }
    },
    [handleRetryLatest, messages, props]
  )

  const handleEditMessage = useCallback((message: MessageType) => {
    setEditingMessageKey(message.key)
  }, [])

  const handleEditOpenChange = useCallback((open: boolean) => {
    if (!open) setEditingMessageKey(null)
  }, [])

  // Apply edit and optionally re-submit from the edited user message
  const applyEdit = useCallback(
    (newContent: string, submit: boolean) => {
      if (!editingMessageKey) return
      const index = messages.findIndex((m) => m.key === editingMessageKey)
      if (index === -1) return

      const updated = messages.map((m) =>
        m.key === editingMessageKey
          ? { ...m, versions: [{ ...m.versions[0], content: newContent }] }
          : m
      )

      setEditingMessageKey(null)

      if (!submit || updated[index].from !== 'user') {
        updateMessagesAndNotify(updated)
        return
      }

      const toSubmit = [
        ...updated.slice(0, index + 1),
        createLoadingAssistantMessage(),
      ]
      updateMessagesAndNotify(toSubmit)
      sendChat(toSubmit)
    },
    [editingMessageKey, messages, updateMessagesAndNotify, sendChat]
  )

  const handleDeleteMessage = (message: MessageType) => {
    const newMessages = messages.filter((m) => m.key !== message.key)
    updateMessagesAndNotify(newMessages)
  }

  const modelUnavailable =
    Boolean(props.modelFilter) && !isLoadingModels && models.length === 0

  return (
    <div className='relative flex size-full flex-col overflow-hidden'>
      {/* Full-width scroll container: scrolling works even over side whitespace */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        <PlaygroundChat
          messages={messages}
          onCopyMessage={handleCopyMessage}
          onRegenerateMessage={handleRegenerateMessage}
          onEditMessage={handleEditMessage}
          onDeleteMessage={handleDeleteMessage}
          isGenerating={isGenerating}
          editingKey={editingMessageKey}
          onCancelEdit={handleEditOpenChange}
          onSaveEdit={(newContent) => applyEdit(newContent, false)}
          onSaveEditAndSubmit={(newContent) => applyEdit(newContent, true)}
        />
      </div>

      {/* Input area: center content and constrain to the same container width */}
      <div className='mx-auto w-full max-w-4xl'>
        {props.suggestedPrompts && props.suggestedPrompts.length > 0 && (
          <div className='mx-1 mb-3 flex flex-wrap gap-2'>
            {props.suggestedPrompts.map((item) => (
              <Button
                key={item.label}
                disabled={isGenerating || modelUnavailable}
                onClick={() => handleSendMessage(item.prompt)}
                size='sm'
                type='button'
                variant='outline'
              >
                {item.label}
              </Button>
            ))}
          </div>
        )}
        {modelUnavailable && (
          <div className='text-muted-foreground mx-1 mb-3 rounded-lg border px-3 py-2 text-sm'>
            {props.emptyModelsMessage ?? t('No available models')}
          </div>
        )}
        <PlaygroundInput
          disabled={isGenerating || modelUnavailable}
          enableSlashCommands={props.enableSlashCommands}
          groups={groups}
          groupValue={config.group}
          isGenerating={isGenerating}
          isModelLoading={isLoadingModels}
          modelValue={config.model}
          models={models}
          onGroupChange={(value) => updateConfig('group', value)}
          onModelChange={(value) => updateConfig('model', value)}
          onSlashAction={handleSlashAction}
          onStop={stopGeneration}
          onSubmit={handleSendMessage}
        />
      </div>
    </div>
  )
}
