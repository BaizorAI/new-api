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
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import {
  Expand,
  Loader2,
  MessageSquareQuote,
  Minimize2,
  RefreshCw,
  Save,
  Sparkles,
  SquareIcon,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStreamRequest } from '@/features/playground/hooks/use-stream-request'
import { getOrCreatePlaygroundSessionId } from '@/features/playground/lib/storage'
import type { ChatCompletionRequest } from '@/features/playground/types'
import { useAuthStore } from '@/stores/auth-store'
import { nanoid } from 'nanoid'

import { createBlogArticle } from './api'
import { extractTitle, extractSummary, extractFullArticle } from './lib/paragraph-utils'

// ============================================================================
// Types
// ============================================================================

interface CreateChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  status: 'complete' | 'streaming' | 'loading' | 'error'
}

// ============================================================================
// Component
// ============================================================================

export function BlogHall() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { sendStreamRequest, stopStream } = useStreamRequest()

  // Article state (for the left panel preview)
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  // Chat state
  const [messages, setMessages] = useState<CreateChatMessage[]>([])
  const isStreamingRef = useRef(false)
  const accumulatedContent = useRef('')
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const hermesSessionId = useMemo(() => {
    const userId = useAuthStore.getState().auth.user?.id ?? 'anon'
    return getOrCreatePlaygroundSessionId(`skill_blog_create_u${userId}`)
  }, [])

  const requestHeaders = useMemo<Record<string, string>>(
    () => ({
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': hermesSessionId,
      'X-Baizor-Hermes-Workspace': 'skill_blog',
      'X-Baizor-Hermes-Skill-Activate': '/blog-v1',
    }),
    [hermesSessionId]
  )

  const isStreaming = messages.some(
    (m) => m.status === 'loading' || m.status === 'streaming'
  )

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = (message.text ?? '').trim()
      if (!text || isStreaming) return

      const userMsg: CreateChatMessage = {
        id: nanoid(),
        role: 'user',
        content: text,
        status: 'complete',
      }
      const assistantMsg: CreateChatMessage = {
        id: nanoid(),
        role: 'assistant',
        content: '',
        status: 'loading',
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      isStreamingRef.current = true
      accumulatedContent.current = ''

      const payload: ChatCompletionRequest = {
        model: 'huayu-v2',
        messages: [{ role: 'user', content: text }],
        stream: true,
      }

      sendStreamRequest(
        payload,
        requestHeaders,
        (_type, chunk) => {
          accumulatedContent.current += chunk
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
          const finalContent = accumulatedContent.current
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              { ...last, status: 'complete' },
            ]
          })
          // Auto-extract title/summary/content from AI response
          const extractedArticle = extractFullArticle(finalContent)
          const articleBody = extractedArticle ?? finalContent
          const extractedTitle = extractTitle(finalContent)
          const extractedSummary = extractSummary(finalContent)

          if (extractedTitle) setTitle(extractedTitle)
          if (extractedSummary) setSummary(extractedSummary)
          setContent(articleBody)

          void queryClient.invalidateQueries({
            queryKey: ['blog-articles-sidebar'],
          })
        },
        () => {
          isStreamingRef.current = false
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              { ...last, content: 'An error occurred', status: 'error' },
            ]
          })
        }
      )
    },
    [isStreaming, queryClient, requestHeaders, sendStreamRequest]
  )

  const handleStop = useCallback(() => {
    stopStream()
    isStreamingRef.current = false
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [{ ...last, status: 'complete' }]
    })
  }, [stopStream])

  const handleClearMessages = useCallback(() => {
    setMessages([])
  }, [])

  const handleSaveAsArticle = useCallback(async () => {
    if (!content.trim() || isSaving) return
    setIsSaving(true)
    try {
      const result = await createBlogArticle({
        title: title || t('Untitled article'),
        summary,
        content,
        tags: [],
        status: 'draft',
      })
      if (result.success && result.data) {
        toast.success(t('Article saved.'))
        void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
        await navigate({
          to: '/blog-hall/$articleId',
          params: { articleId: String(result.data.id) },
        })
      }
    } catch {
      toast.error(t('Failed to save article.'))
    } finally {
      setIsSaving(false)
    }
  }, [content, title, summary, isSaving, t, queryClient, navigate])

  // Accept an apply-full-article action from the chat bubble
  const handleApplyFullArticle = useCallback((articleContent: string) => {
    setContent(articleContent)
    const tTitle = extractTitle(articleContent)
    const tSummary = extractSummary(articleContent)
    if (tTitle) setTitle(tTitle)
    if (tSummary) setSummary(tSummary)
  }, [])

  const handleUseTitle = useCallback((tTitle: string) => {
    setTitle(tTitle)
    toast.success(t('Title updated.'))
  }, [t])

  const handleUseSummary = useCallback((s: string) => {
    setSummary(s)
    toast.success(t('Summary updated.'))
  }, [t])

  return (
    <ResizablePanelGroup orientation='horizontal' className='h-full'>
      {/* ─── Left: Article preview ─────────────────────────────────── */}
      <ResizablePanel defaultSize={55} minSize={30} className='flex flex-col'>
        {/* Toolbar */}
        <div className='border-border flex shrink-0 items-center gap-3 border-b px-4 py-2'>
          <h2 className='text-sm font-medium'>{t('New Article')}</h2>
          <div className='flex-1' />
          {content && (
            <Button
              size='sm'
              disabled={isSaving}
              onClick={() => void handleSaveAsArticle()}
            >
              <Save className='mr-1.5 size-4' />
              {isSaving ? t('Saving...') : t('Save as Article')}
            </Button>
          )}
        </div>

        {/* Preview area */}
        <ScrollArea className='min-h-0 flex-1'>
          {content ? (
            <div className='mx-auto max-w-3xl px-6 py-8'>
              {/* Title */}
              <h1 className='mb-4 text-3xl font-bold leading-tight'>
                {title || t('Untitled article')}
              </h1>

              {/* Summary */}
              {summary && (
                <p className='text-muted-foreground border-l-primary/40 mb-6 border-l-2 pl-4 text-base italic'>
                  {summary}
                </p>
              )}

              <hr className='border-border mb-6' />

              {/* Body */}
              <Markdown>{content}</Markdown>
            </div>
          ) : (
            <div className='flex h-full flex-col items-center justify-center gap-3 text-center'>
              <Wand2 className='text-muted-foreground/30 size-10' aria-hidden='true' />
              <div>
                <p className='text-muted-foreground text-sm font-medium'>
                  {t('Enter a topic in the chat panel to create a new article.')}
                </p>
                <p className='text-muted-foreground/60 mt-1 text-xs'>
                  {t('Your article preview will appear here as AI writes.')}
                </p>
              </div>
            </div>
          )}
        </ScrollArea>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* ─── Right: AI Chat ────────────────────────────────────────── */}
      <ResizablePanel defaultSize={45} minSize={25} className='flex flex-col'>
        <div className='flex h-full flex-col'>
          {/* Skill indicator */}
          <div className='border-border flex items-center gap-2 border-b border-l px-4 py-2'>
            <span className='flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400'>
              <Wand2 className='size-3' aria-hidden='true' />
              {t('blog-v1')}
            </span>
            <span className='text-muted-foreground text-xs'>
              {t('Skill active: blog-v1')}
            </span>
          </div>

          {/* Chat header */}
          <div className='border-border flex shrink-0 items-center justify-between border-b border-l px-4 py-1.5'>
            <span className='text-muted-foreground text-[11px]'>
              {t('Chat History')}
            </span>
            {messages.length > 0 && (
              <Button
                size='sm'
                variant='ghost'
                className='text-muted-foreground hover:text-destructive h-6 gap-1 px-1.5 text-[11px]'
                onClick={handleClearMessages}
                disabled={isStreaming}
              >
                <Trash2 className='size-3 text-red-500' />
                {t('Clear all')}
              </Button>
            )}
          </div>

          {/* Chat messages */}
          <Conversation className='min-h-0 flex-1'>
            <ConversationContent className='space-y-4'>
              {messages.length === 0 ? (
                <ConversationEmptyState
                  title={t('Blog Assistant')}
                  description={t(
                    'AI powered by blog-v1 will help you write and edit your article.'
                  )}
                  icon={<Wand2 className='size-8 text-purple-500' />}
                />
              ) : (
                messages.map((msg) => (
                  <CreateChatBubble
                    key={msg.id}
                    message={msg}
                    onApplyFullArticle={handleApplyFullArticle}
                    onUseTitle={handleUseTitle}
                    onUseSummary={handleUseSummary}
                  />
                ))
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Chat input */}
          <div className='border-border shrink-0 border-t p-3'>
            <PromptInput
              onSubmit={handleSubmit}
              className='rounded-lg border shadow-sm'
            >
              <PromptInputTextarea
                placeholder={t('Enter a topic to create an article...')}
                className='min-h-[40px] resize-none text-sm'
              />
              <PromptInputFooter className='justify-end p-1'>
                {isStreaming ? (
                  <Button
                    type='button'
                    size='icon'
                    variant='ghost'
                    className='size-7'
                    onClick={handleStop}
                    aria-label={t('Stop')}
                  >
                    <SquareIcon className='size-4 text-red-500' />
                  </Button>
                ) : (
                  <PromptInputSubmit className='size-7' />
                )}
              </PromptInputFooter>
            </PromptInput>
          </div>
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

// ============================================================================
// CreateChatBubble — message bubble with action buttons for new article flow
// ============================================================================

function CreateChatBubble({
  message,
  onApplyFullArticle,
  onUseTitle,
  onUseSummary,
}: {
  message: CreateChatMessage
  onApplyFullArticle?: (content: string) => void
  onUseTitle?: (title: string) => void
  onUseSummary?: (summary: string) => void
}) {
  const { t } = useTranslation()
  const [applied, setApplied] = useState(false)

  if (message.role === 'user') {
    return (
      <div className='flex justify-end'>
        <div className='bg-primary/10 max-w-[85%] rounded-lg px-3 py-2 text-sm'>
          {message.content}
        </div>
      </div>
    )
  }

  if (message.status === 'loading') {
    return (
      <div className='flex justify-start'>
        <div className='bg-muted max-w-[85%] rounded-lg px-3 py-2'>
          <Loader2 className='text-muted-foreground size-4 animate-spin' />
        </div>
      </div>
    )
  }

  if (message.status === 'error') {
    return (
      <div className='flex justify-start'>
        <div className='bg-destructive/10 max-w-[85%] rounded-lg px-3 py-2'>
          <span className='text-destructive text-xs'>{message.content}</span>
        </div>
      </div>
    )
  }

  if (!message.content) return null

  const isComplete = message.status === 'complete'
  const fullArticle = extractFullArticle(message.content)
  const title = extractTitle(message.content)
  const summary = extractSummary(message.content)

  return (
    <div className='flex justify-start'>
      <div className='bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm'>
        <div className='prose prose-sm dark:prose-invert max-w-none'>
          <Markdown>{message.content}</Markdown>
        </div>

        {isComplete && (
          <div className='mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2'>
            {fullArticle && onApplyFullArticle && (
              <Button
                size='sm'
                variant={applied ? 'ghost' : 'outline'}
                className='h-7 gap-1 px-2 text-xs'
                disabled={applied}
                onClick={() => {
                  onApplyFullArticle(fullArticle)
                  setApplied(true)
                }}
              >
                <Sparkles className='size-3 text-emerald-500' />
                {applied ? t('Applied') : t('Apply full article')}
              </Button>
            )}
            {/* If no code block, treat substantial content as full article */}
            {!fullArticle && message.content.trim().length > 200 && onApplyFullArticle && (
              <Button
                size='sm'
                variant={applied ? 'ghost' : 'outline'}
                className='h-7 gap-1 px-2 text-xs'
                disabled={applied}
                onClick={() => {
                  onApplyFullArticle(message.content)
                  setApplied(true)
                }}
              >
                <Sparkles className='size-3 text-emerald-500' />
                {applied ? t('Applied') : t('Apply as article')}
              </Button>
            )}
            {title && onUseTitle && (
              <Button
                size='sm'
                variant='outline'
                className='h-7 gap-1 px-2 text-xs'
                onClick={() => onUseTitle(title)}
              >
                <MessageSquareQuote className='size-3 text-amber-500' />
                {t('Use as title')}
              </Button>
            )}
            {summary && onUseSummary && (
              <Button
                size='sm'
                variant='outline'
                className='h-7 gap-1 px-2 text-xs'
                onClick={() => onUseSummary(summary)}
              >
                <MessageSquareQuote className='size-3 text-sky-500' />
                {t('Use as summary')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
