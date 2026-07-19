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
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Loader2,
  Pencil,
  Save,
  SquareIcon,
  Trash2,
  Wand2,
} from 'lucide-react'
import { nanoid } from 'nanoid'
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
import { useStreamRequest } from '@/features/playground/hooks/use-stream-request'
import { getOrCreatePlaygroundSessionId } from '@/features/playground/lib/storage'
import type { ChatCompletionRequest } from '@/features/playground/types'
import { useAuthStore } from '@/stores/auth-store'

import { createBlogArticle } from '@/features/blog-hall/api'
import {
  extractFullArticle,
  extractTitle,
  extractSummary,
} from '@/features/blog-hall/lib/paragraph-utils'
import { BlogArticleEditor } from '@/features/blog-hall/components/blog-article-editor'

export const Route = createFileRoute('/_authenticated/blog-hall/new/')({
  component: BlogArticleCreate,
})

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

export function BlogArticleCreate() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { sendStreamRequest, stopStream } = useStreamRequest()

  // Article state
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [savedArticleId, setSavedArticleId] = useState<number | null>(null)
  const [generatingField, setGeneratingField] = useState<'title' | 'summary' | null>(null)

  // Chat state
  const [messages, setMessages] = useState<CreateChatMessage[]>([])
  const isStreamingRef = useRef(false)
  const accumulatedRef = useRef('')
  const messagesRef = useRef(messages)
  messagesRef.current = messages

  const hermesSessionId = useMemo(() => {
    const userId = useAuthStore.getState().auth.user?.id ?? 'anon'
    return getOrCreatePlaygroundSessionId(`skill_blog_new_u${userId}`)
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

  // ── Send message ─────────────────────────────────────────────────
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
      accumulatedRef.current = ''

      const payload: ChatCompletionRequest = {
        model: 'huayu-v2',
        messages: [{ role: 'user', content: text }],
        stream: true,
      }

      sendStreamRequest(
        payload,
        requestHeaders,
        (_type, chunk) => {
          accumulatedRef.current += chunk
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
          const finalContent = accumulatedRef.current
          setMessages((prev) => {
            const last = prev[prev.length - 1]
            if (!last || last.role !== 'assistant') return prev
            return [
              ...prev.slice(0, -1),
              { ...last, status: 'complete' },
            ]
          })

          // Auto-extract article content when AI finishes
          const article = extractFullArticle(finalContent)
          if (article) {
            setContent(article)
            const tTitle = extractTitle(finalContent)
            const tSummary = extractSummary(finalContent)
            if (tTitle) setTitle(tTitle)
            if (tSummary) setSummary(tSummary)
          } else if (finalContent.trim().length > 100) {
            // No code block but substantial — treat as article body
            setContent(finalContent)
            const tTitle = extractTitle(finalContent)
            if (tTitle) setTitle(tTitle)
            const tSummary = extractSummary(finalContent)
            if (tSummary) setSummary(tSummary)
          }
          setGeneratingField(null)

          void queryClient.invalidateQueries({
            queryKey: ['blog-articles-sidebar'],
          })
        },
        () => {
          isStreamingRef.current = false
          setGeneratingField(null)
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
    [isStreaming, queryClient, requestHeaders, sendStreamRequest, setViewMode]
  )

  const handleStop = useCallback(() => {
    stopStream()
    isStreamingRef.current = false
    setGeneratingField(null)
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (!last || last.role !== 'assistant') return prev
      return [{ ...last, status: 'complete' }]
    })
  }, [stopStream])

  const handleClear = useCallback(() => {
    setMessages([])
    setContent('')
    setTitle('')
    setSummary('')
    setSavedArticleId(null)
  }, [])

  // ── Apply from chat bubble ───────────────────────────────────────
  const handleApplyArticle = useCallback((articleContent: string) => {
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

  // ── AI generate title / summary via the chat panel ─────────────────
  const requestGenTitle = useCallback(() => {
    setGeneratingField('title')
    handleSubmit({ text: '请为文章生成 3 个候选标题。' } as PromptInputMessage)
  }, [handleSubmit])

  const requestGenSummary = useCallback(() => {
    setGeneratingField('summary')
    handleSubmit({ text: '请为文章生成一段简洁的摘要。' } as PromptInputMessage)
  }, [handleSubmit])

  // ── Save as draft ────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    if (!content.trim() || isSaving) return
    setIsSaving(true)
    try {
      if (savedArticleId) {
        // Update existing
        const { updateBlogArticle } = await import('@/features/blog-hall/api')
        await updateBlogArticle(savedArticleId, {
          title: title || t('Untitled article'),
          summary,
          content,
        })
        toast.success(t('Article updated.'))
      } else {
        // Create new
        const result = await createBlogArticle({
          title: title || t('Untitled article'),
          summary,
          content,
          tags: [],
          status: 'draft',
        })
        if (result.success && result.data) {
          setSavedArticleId(result.data.id)
          toast.success(t('Article saved.'))
          void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
        }
      }
    } catch {
      toast.error(t('Failed to save article.'))
    } finally {
      setIsSaving(false)
    }
  }, [content, title, summary, savedArticleId, isSaving, t, queryClient])

  // ── Open in editor ───────────────────────────────────────────────
  const handleOpenEditor = useCallback(async () => {
    // Save first if not yet saved
    if (!savedArticleId) {
      if (!content.trim()) return
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
    } else {
      await navigate({
        to: '/blog-hall/$articleId',
        params: { articleId: String(savedArticleId) },
      })
    }
  }, [content, title, summary, savedArticleId, t, queryClient, navigate])

  return (
    <ResizablePanelGroup orientation='horizontal' className='h-full'>
      {/* ─── Left: Article preview ─────────────────────────────── */}
      <ResizablePanel defaultSize={55} minSize={30} className='flex flex-col'>
        {/* Toolbar */}
        <div className='border-border flex shrink-0 items-center gap-2 border-b px-4 py-2'>
          <h2 className='text-sm font-medium'>{t('New Article')}</h2>
          <div className='flex-1' />
          {(title || content) && (
            <>
              <Button
                size='sm'
                variant='outline'
                disabled={isSaving}
                onClick={() => void handleSave()}
              >
                <Save className='mr-1.5 size-3.5' />
                {isSaving ? t('Saving...') : t('Save')}
              </Button>
              <Button
                size='sm'
                disabled={isSaving || !content.trim()}
                onClick={() => void handleOpenEditor()}
              >
                <Pencil className='mr-1.5 size-3.5' />
                {t('Open editor')}
              </Button>
            </>
          )}
        </div>

        <BlogArticleEditor
          content={content}
          setContent={setContent}
          title={title}
          setTitle={setTitle}
          summary={summary}
          setSummary={setSummary}
          initialMode='edit'
          generatingField={generatingField}
          onGenerateTitle={requestGenTitle}
          onGenerateSummary={requestGenSummary}
        />
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* ─── Right: AI Chat ────────────────────────────────────── */}
      <ResizablePanel defaultSize={45} minSize={25} className='flex flex-col'>
        <div className='flex h-full flex-col'>
          {/* Skill indicator */}
          <div className='border-border flex items-center gap-2 border-b border-l px-4 py-2'>
            <span className='flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400'>
              <Wand2 className='size-3' />
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
                onClick={handleClear}
                disabled={isStreaming}
              >
                <Trash2 className='size-3 text-red-500' />
                {t('Clear all')}
              </Button>
            )}
          </div>

          {/* Messages */}
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
                    onApplyArticle={handleApplyArticle}
                    onUseTitle={handleUseTitle}
                    onUseSummary={handleUseSummary}
                  />
                ))
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Input */}
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
// Chat Bubble
// ============================================================================

function CreateChatBubble({
  message,
  onApplyArticle,
  onUseTitle,
  onUseSummary,
}: {
  message: CreateChatMessage
  onApplyArticle?: (content: string) => void
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

  if (!message.content || message.status !== 'complete') return null

  const fullArticle = extractFullArticle(message.content)
  const title = extractTitle(message.content)
  const summary = extractSummary(message.content)
  // Show actions if AI returned anything substantial
  const isArticle = !!fullArticle || message.content.trim().length > 100

  return (
    <div className='flex justify-start'>
      <div className='bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm'>
        <div className='prose prose-sm dark:prose-invert max-w-none'>
          <Markdown>{message.content}</Markdown>
        </div>
        {(isArticle || title || summary) && (
          <div className='mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2'>
            {isArticle && onApplyArticle && (
              <Button
                size='sm'
                variant={applied ? 'ghost' : 'default'}
                className='h-7 gap-1 px-2 text-xs'
                disabled={applied}
                onClick={() => {
                  onApplyArticle(fullArticle ?? message.content)
                  setApplied(true)
                }}
              >
                <Wand2 className='size-3 text-emerald-500' />
                {applied ? t('Applied') : t('Apply to article')}
              </Button>
            )}
            {title && onUseTitle && (
              <Button
                size='sm'
                variant='outline'
                className='h-7 gap-1 px-2 text-xs'
                onClick={() => onUseTitle(title)}
              >
                <Pencil className='size-3 text-amber-500' />
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
                <Pencil className='size-3 text-sky-500' />
                {t('Use as summary')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
