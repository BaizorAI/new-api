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
import {
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  FileCheck2Icon,
  FileIcon,
  ImageIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Branch,
  BranchMessages,
  BranchNext,
  BranchPage,
  BranchPrevious,
  BranchSelector,
} from '@/components/ai-elements/branch'
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageContent } from '@/components/ai-elements/message'
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Response } from '@/components/ai-elements/response'
import { Shimmer } from '@/components/ai-elements/shimmer'
import {
  Source,
  Sources,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { MESSAGE_ROLES } from '../constants'
import {
  extractHermesFileArtifacts,
  renderHermesDataPathsAsLinks,
  type HermesFileArtifact,
} from '../lib/hermes-file-links'
import { getMessageContentStyles } from '../lib/message-styles'
import { parseThinkTags } from '../lib/message-utils'
import type { Message as MessageType } from '../types'
import { MessageActions } from './message-actions'
import { MessageError } from './message-error'

function MessageAttachments({
  attachments,
}: {
  attachments: NonNullable<MessageType['attachments']>
}) {
  const { t } = useTranslation()

  return (
    <div className='space-y-2'>
      <div className='text-muted-foreground text-xs font-medium'>
        {t('Attachments')}
      </div>
      <div className='grid gap-2 sm:grid-cols-2'>
        {attachments.map((attachment, index) => {
          const isImage = attachment.mediaType?.startsWith('image/')
          const filename = attachment.filename || t(isImage ? 'Image' : 'File')

          return (
            <FileCard
              href={attachment.url}
              isImage={isImage}
              key={`${filename}-${index}`}
              mediaType={attachment.mediaType}
              previewUrl={isImage ? attachment.url : undefined}
              size={attachment.size}
              title={filename}
              unavailableLabel={t('Preview unavailable')}
            />
          )
        })}
      </div>
    </div>
  )
}

function HermesArtifactCards({
  artifacts,
}: {
  artifacts: HermesFileArtifact[]
}) {
  const { t } = useTranslation()

  if (artifacts.length === 0) return null

  return (
    <div className='space-y-2'>
      <div className='text-muted-foreground flex items-center gap-1.5 text-xs font-medium'>
        <FileCheck2Icon className='size-3.5' />
        {t('Results')}
      </div>
      <div className='grid gap-2 sm:grid-cols-2'>
        {artifacts.map((artifact) => (
          <FileCard
            href={artifact.href}
            key={artifact.href}
            title={artifact.filename || artifact.label}
          />
        ))}
      </div>
    </div>
  )
}

function FileCard({
  href,
  isImage = false,
  mediaType,
  previewUrl,
  size,
  title,
  unavailableLabel,
}: {
  href?: string
  isImage?: boolean
  mediaType?: string
  previewUrl?: string
  size?: number
  title: string
  unavailableLabel?: string
}) {
  const { t } = useTranslation()
  const hasUrl = !!href
  const description = [mediaType, formatFileSize(size)]
    .filter(Boolean)
    .join(' / ')

  return (
    <div
      className={cn(
        'border-border bg-background/80 flex min-w-0 items-center gap-2 rounded-md border p-2 text-xs',
        !hasUrl && 'opacity-70'
      )}
    >
      {isImage && previewUrl ? (
        <img
          alt={title}
          className='size-10 shrink-0 rounded object-cover'
          src={previewUrl}
        />
      ) : (
        <div className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded'>
          {isImage ? (
            <ImageIcon className='size-4' />
          ) : (
            <FileIcon className='size-4' />
          )}
        </div>
      )}
      <div className='min-w-0 flex-1'>
        <div className='truncate font-medium'>{title}</div>
        <div className='text-muted-foreground truncate'>
          {description || unavailableLabel || t('File')}
        </div>
      </div>
      <div className='flex shrink-0 items-center gap-1'>
        {hasUrl ? (
          <>
            <a
              aria-label={t('Open')}
              className='hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors'
              href={href}
              rel='noreferrer'
              target='_blank'
            >
              <ExternalLinkIcon className='size-3.5' />
            </a>
            <a
              aria-label={t('Download')}
              className='hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors'
              download={title}
              href={href}
            >
              <DownloadIcon className='size-3.5' />
            </a>
            <button
              aria-label={t('Copy link')}
              className='hover:bg-muted text-muted-foreground hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors'
              onClick={() => copyFileLink(href, t('Copied to clipboard'))}
              type='button'
            >
              <CopyIcon className='size-3.5' />
            </button>
          </>
        ) : null}
      </div>
    </div>
  )
}

function formatFileSize(size?: number): string {
  if (!size || size <= 0) return ''
  if (size < 1024) return `${size} B`
  const units = ['KB', 'MB', 'GB']
  let value = size / 1024
  let unitIndex = 0
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex += 1
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`
}

function copyFileLink(href: string, successMessage: string) {
  const absoluteUrl = new URL(href, window.location.origin).toString()
  void navigator.clipboard.writeText(absoluteUrl).then(() => {
    toast.success(successMessage)
  })
}
interface PlaygroundChatProps {
  messages: MessageType[]
  onCopyMessage?: (message: MessageType) => void
  onRegenerateMessage?: (message: MessageType) => void
  onEditMessage?: (message: MessageType) => void
  onDeleteMessage?: (message: MessageType) => void
  isGenerating?: boolean
  editingKey?: string | null
  onSaveEdit?: (newContent: string) => void
  onCancelEdit?: (open: boolean) => void
  onSaveEditAndSubmit?: (newContent: string) => void
}

export function PlaygroundChat({
  messages,
  onCopyMessage,
  onRegenerateMessage,
  onEditMessage,
  onDeleteMessage,
  isGenerating = false,
  editingKey,
  onSaveEdit,
  onCancelEdit,
  onSaveEditAndSubmit,
}: PlaygroundChatProps) {
  const [editText, setEditText] = useState('')
  const [originalText, setOriginalText] = useState('')

  useEffect(() => {
    if (!editingKey) return
    const message = messages.find((m) => m.key === editingKey)
    const content = message?.versions?.[0]?.content || ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditText(content)

    setOriginalText(content)
  }, [editingKey, messages])

  const isEditing = (key: string) => editingKey === key
  const isEmpty = useMemo(() => !editText.trim(), [editText])
  const isChanged = useMemo(
    () => editText !== originalText,
    [editText, originalText]
  )
  return (
    <Conversation>
      {/* Remove outer padding; apply padding to inner centered container to align with input */}
      <ConversationContent className='p-0'>
        <div className='mx-auto w-full max-w-4xl px-4 py-4'>
          {messages.map((message, messageIndex) => {
            const { versions = [] } = message
            const isLastAssistantMessage =
              messageIndex === messages.length - 1 &&
              message.from === MESSAGE_ROLES.ASSISTANT
            return (
              <Branch defaultBranch={0} key={message.key}>
                <BranchMessages>
                  {versions.map((version, versionIndex) => (
                    <Message
                      className='group flex-row-reverse'
                      from={message.from}
                      key={`${message.key}-${version.id}-${versionIndex}`}
                    >
                      <div className='w-full min-w-0 flex-1 basis-full py-1'>
                        {isEditing(message.key) ? (
                          <div className='space-y-2'>
                            <Textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className='font-mono text-sm'
                              rows={8}
                            />
                            <div className='flex gap-2'>
                              {/* Save & Submit only makes sense for user messages */}
                              {message.from === MESSAGE_ROLES.USER && (
                                <Button
                                  size='sm'
                                  onClick={() =>
                                    onSaveEditAndSubmit?.(editText)
                                  }
                                  disabled={isEmpty || !isChanged}
                                >
                                  Save & Submit
                                </Button>
                              )}
                              <Button
                                size='sm'
                                onClick={() => onSaveEdit?.(editText)}
                                disabled={isEmpty || !isChanged}
                              >
                                Save
                              </Button>
                              <Button
                                size='sm'
                                variant='outline'
                                onClick={() => onCancelEdit?.(false)}
                              >
                                Cancel
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            {(() => {
                              const isAssistant =
                                message.from === MESSAGE_ROLES.ASSISTANT
                              const hasSources = !!message.sources?.length
                              const showReasoning =
                                isAssistant && !!message.reasoning?.content
                              const hasAttachments =
                                (message.attachments?.length ?? 0) > 0
                              const showLoader =
                                isAssistant &&
                                !message.isReasoningStreaming &&
                                (message.status === 'loading' ||
                                  (message.status === 'streaming' &&
                                    !version.content))
                              const showMessageContent =
                                (message.from === MESSAGE_ROLES.USER ||
                                  !message.isReasoningStreaming) &&
                                (!!version.content || hasAttachments)

                              // Extract visible content (remove <think> tags for assistant messages)
                              const displayContent = isAssistant
                                ? renderHermesDataPathsAsLinks(
                                    parseThinkTags(version.content)
                                      .visibleContent
                                  )
                                : version.content
                              const artifacts = isAssistant
                                ? extractHermesFileArtifacts(displayContent)
                                : []

                              const actions = (
                                <MessageActions
                                  message={message}
                                  onCopy={onCopyMessage}
                                  onRegenerate={onRegenerateMessage}
                                  onEdit={onEditMessage}
                                  onDelete={onDeleteMessage}
                                  isGenerating={isGenerating}
                                  alwaysVisible={isLastAssistantMessage}
                                  className='mt-1'
                                />
                              )

                              return (
                                <>
                                  {/* Sources */}
                                  {hasSources && (
                                    <Sources>
                                      <SourcesTrigger
                                        count={message.sources!.length}
                                      />
                                      <SourcesContent>
                                        {message.sources!.map(
                                          (source, sourceIndex) => (
                                            <Source
                                              href={source.href}
                                              key={`${message.key}-source-${sourceIndex}`}
                                              title={source.title}
                                            />
                                          )
                                        )}
                                      </SourcesContent>
                                    </Sources>
                                  )}

                                  {/* Reasoning */}
                                  {showReasoning && (
                                    <Reasoning
                                      defaultOpen={true}
                                      isStreaming={message.isReasoningStreaming}
                                    >
                                      <ReasoningTrigger />
                                      <ReasoningContent>
                                        {message.reasoning!.content}
                                      </ReasoningContent>
                                    </Reasoning>
                                  )}

                                  {/* Loader */}
                                  {showLoader && (
                                    <div className='flex items-center gap-2 py-2'>
                                      <Loader />
                                      <Shimmer className='text-sm' duration={1}>
                                        Responding...
                                      </Shimmer>
                                    </div>
                                  )}

                                  {/* Error or Content */}
                                  {message.status === 'error' ? (
                                    <>
                                      <MessageError
                                        message={message}
                                        className='mb-2'
                                      />
                                      {actions}
                                    </>
                                  ) : (
                                    showMessageContent && (
                                      <>
                                        <MessageContent
                                          variant='flat'
                                          className={cn(
                                            getMessageContentStyles()
                                          )}
                                        >
                                          {displayContent ? (
                                            <Response>
                                              {displayContent}
                                            </Response>
                                          ) : null}
                                          {message.attachments?.length ? (
                                            <MessageAttachments
                                              attachments={message.attachments}
                                            />
                                          ) : null}
                                          {artifacts.length ? (
                                            <HermesArtifactCards
                                              artifacts={artifacts}
                                            />
                                          ) : null}
                                        </MessageContent>
                                        {actions}
                                      </>
                                    )
                                  )}
                                </>
                              )
                            })()}
                          </>
                        )}
                      </div>
                    </Message>
                  ))}
                </BranchMessages>

                {/* Branch selector for multiple versions */}
                {versions.length > 1 && (
                  <BranchSelector className='px-0' from={message.from}>
                    <BranchPrevious />
                    <BranchPage />
                    <BranchNext />
                  </BranchSelector>
                )}
              </Branch>
            )
          })}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
