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
import {
  Expand,
  Loader2,
  MessageSquareQuote,
  Minimize2,
  RefreshCw,
  Sparkles,
  SquareIcon,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

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

import { useBlogArticleChat, type BlogModificationType } from '../hooks/use-blog-article-chat'
import { extractRevisedParagraph, replaceParagraph } from '../lib/paragraph-utils'
import { useBlogWorkspace } from './blog-workspace-provider'

// Pre-defined AI modification types with labels and icons
const MODIFICATION_TYPES: {
  key: BlogModificationType
  labelKey: string
  icon: typeof Sparkles
  colorClass: string
  prompt: string
}[] = [
  {
    key: 'polish',
    labelKey: 'Polish',
    icon: Sparkles,
    colorClass: 'text-amber-500',
    prompt: '请润色以下段落，使其更加流畅优美：',
  },
  {
    key: 'expand',
    labelKey: 'Expand',
    icon: Expand,
    colorClass: 'text-blue-500',
    prompt: '请扩写以下段落，增加更多细节和描写：',
  },
  {
    key: 'shorten',
    labelKey: 'Shorten',
    icon: Minimize2,
    colorClass: 'text-blue-500',
    prompt: '请精简以下段落，保留核心内容：',
  },
  {
    key: 'rewrite',
    labelKey: 'Rewrite',
    icon: RefreshCw,
    colorClass: 'text-amber-500',
    prompt: '请用不同的方式改写以下段落：',
  },
]

export function BlogWorkspaceChatPanel() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const {
    article,
    content,
    setContent,
    title,
    summary,
    selectedParagraphIndex,
    selectedParagraphText,
    selectParagraph,
    analyzeRequested,
    setAnalyzing,
  } = useBlogWorkspace()

  const [isAnalyzing, setIsAnalyzing] = useState(false)

  const handleStreamComplete = useCallback(
    (_responseContent: string) => {
      setIsAnalyzing(false)
      setAnalyzing(false)
      void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
    },
    [queryClient, setAnalyzing]
  )

  const {
    messages,
    loadingHistory,
    sendMessage,
    stopGeneration,
    clearMessages,
    addAssistantMessage,
    isStreaming,
  } = useBlogArticleChat({
    articleId: article?.id ?? 0,
    content,
    selectedParagraphIndex,
    selectedParagraphText,
    onComplete: handleStreamComplete,
    title,
    summary,
  })

  const handleSubmit = useCallback(
    (message: PromptInputMessage, modificationType?: BlogModificationType) => {
      const text = (message.text ?? '').trim()
      if (!text || isStreaming) return

      if (modificationType === 'analyze') {
        setIsAnalyzing(true)
        addAssistantMessage('🔍 正在分析文章质量...')
      }

      sendMessage(text, { modificationType })
    },
    [isStreaming, sendMessage, addAssistantMessage]
  )

  const handleApplyRevision = useCallback(
    (paragraphIndex: number, revisedText: string) => {
      const newContent = replaceParagraph(content, paragraphIndex, revisedText)
      setContent(newContent)
    },
    [content, setContent]
  )

  // AI Analyze handler triggered from toolbar via workspace context
  const handleAnalyze = useCallback(() => {
    if (isStreaming || isAnalyzing) return
    setIsAnalyzing(true)
    setAnalyzing(true)
    addAssistantMessage('🔍 正在分析文章质量...')
    sendMessage('请分析这篇文章的质量和发布就绪度。', {
      modificationType: 'analyze',
    })
  }, [isStreaming, isAnalyzing, sendMessage, addAssistantMessage, setAnalyzing])

  // Watch for analyze trigger from toolbar
  const analyzeRequestedRef = useRef(analyzeRequested)
  useEffect(() => {
    if (analyzeRequested !== analyzeRequestedRef.current) {
      analyzeRequestedRef.current = analyzeRequested
      handleAnalyze()
    }
  }, [analyzeRequested, handleAnalyze])

  return (
    <div className='flex h-full flex-col'>
      {/* Skill indicator */}
      <div className='border-border flex items-center gap-2 border-b border-l px-4 py-2'>
        <span className='flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400'>
          <Wand2 className='size-3' aria-hidden='true' />
          MagicalBrush
        </span>
        <span className='text-muted-foreground text-xs'>
          {t('Skill active: MagicalBrush')}
        </span>
      </div>

      {/* Chat header */}
      <div className='border-border flex shrink-0 items-center justify-between border-b border-l px-4 py-1.5'>
        <span className='text-muted-foreground text-[11px]'>
          {t('Chat History')}
        </span>
        {messages.length > 0 ? (
          <Button
            size='sm'
            variant='ghost'
            className='text-muted-foreground hover:text-destructive h-6 gap-1 px-1.5 text-[11px]'
            onClick={() => clearMessages()}
            disabled={isStreaming}
          >
            <Trash2 className='size-3 text-red-500' aria-hidden='true' />
            {t('Clear all')}
          </Button>
        ) : null}
      </div>

      {/* Chat messages */}
      <Conversation className='min-h-0 flex-1'>
        <ConversationContent className='space-y-4'>
          {loadingHistory ? (
            <ConversationEmptyState
              title={t('Loading...')}
              description=''
              icon={<Loader2 className='size-8 animate-spin' />}
            />
          ) : messages.length === 0 ? (
            <ConversationEmptyState
              title={t('Blog Assistant')}
              description={t(
                'AI powered by MagicalBrush will help you write and edit your article.'
              )}
              icon={<Wand2 className='size-8 text-purple-500' />}
            />
          ) : (
            messages.map((msg) => (
              <BlogChatBubble
                key={msg.id}
                message={msg}
                onApplyRevision={handleApplyRevision}
              />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {/* Selection banner with modification quick-actions */}
      {selectedParagraphIndex !== null && selectedParagraphText ? (
        <>
          <div className='bg-muted/50 flex items-center gap-2 border-t px-3 py-1.5'>
            <MessageSquareQuote className='text-amber-500 size-3.5 shrink-0' />
            <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
              {t('Selected paragraph {{index}}', {
                index: selectedParagraphIndex + 1,
              })}
            </span>
            <Button
              size='sm'
              variant='ghost'
              className='size-6 shrink-0 p-0'
              onClick={() => selectParagraph(null)}
              aria-label={t('Clear selection')}
            >
              <X className='size-3 text-red-400' />
            </Button>
          </div>
          <div className='border-border flex flex-wrap items-center gap-1 border-t px-3 py-2'>
            <span className='text-muted-foreground mr-1 text-[10px] uppercase tracking-wider'>
              {t('Modify with AI')}
            </span>
            {MODIFICATION_TYPES.map((mt) => {
              const Icon = mt.icon
              return (
                <Button
                  key={mt.key}
                  size='sm'
                  variant='outline'
                  className='h-6 gap-1 px-2 text-[11px]'
                  disabled={isStreaming}
                  onClick={() => {
                    const promptText = `${mt.prompt}\n\n${selectedParagraphText}`
                    handleSubmit({ text: promptText } as PromptInputMessage, mt.key)
                  }}
                >
                  <Icon className={`size-3 ${mt.colorClass}`} aria-hidden='true' />
                  {t(mt.labelKey)}
                </Button>
              )
            })}
          </div>
        </>
      ) : null}

      {/* Chat input */}
      <div className='border-border shrink-0 border-t p-3'>
        <PromptInput
          onSubmit={handleSubmit}
          className='rounded-lg border shadow-sm'
        >
          <PromptInputTextarea
            placeholder={
              selectedParagraphIndex !== null
                ? t('Ask AI to edit paragraph {{n}}...', {
                    n: selectedParagraphIndex + 1,
                  })
                : t('Enter a topic to create or edit an article...')
            }
            className='min-h-[40px] resize-none text-sm'
          />
          <PromptInputFooter className='justify-end p-1'>
            {isStreaming ? (
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='size-7'
                onClick={stopGeneration}
                aria-label={t('Stop')}
              >
                <SquareIcon className='size-4 text-red-500' aria-hidden='true' />
              </Button>
            ) : (
              <PromptInputSubmit className='size-7' />
            )}
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}

// ============================================================================
// BlogChatBubble — renders a single chat message with Apply button
// ============================================================================

interface BlogChatBubbleProps {
  message: {
    id: string
    role: 'user' | 'assistant'
    content: string
    status: 'complete' | 'streaming' | 'loading' | 'error'
    paragraphIndex: number | null
  }
  onApplyRevision?: (paragraphIndex: number, revisedText: string) => void
}

function BlogChatBubble({ message, onApplyRevision }: BlogChatBubbleProps) {
  const { t } = useTranslation()

  if (message.role === 'user') {
    return (
      <div className='flex justify-end'>
        <div className='bg-primary/10 max-w-[85%] rounded-lg px-3 py-2 text-sm'>
          {message.paragraphIndex !== null && (
            <span className='text-muted-foreground mb-0.5 block text-[10px]'>
              {t('¶ {{n}}', { n: message.paragraphIndex + 1 })}
            </span>
          )}
          {message.content}
        </div>
      </div>
    )
  }

  // Assistant message
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

  return (
    <div className='flex justify-start'>
      <div className='bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm'>
        <div className='prose prose-sm dark:prose-invert max-w-none'>
          <Markdown>{message.content}</Markdown>
        </div>
        {message.status === 'complete' &&
          message.paragraphIndex !== null &&
          onApplyRevision && (
            <ApplyRevisionButton
              content={message.content}
              paragraphIndex={message.paragraphIndex}
              onApply={onApplyRevision}
            />
          )}
      </div>
    </div>
  )
}

function ApplyRevisionButton({
  content,
  paragraphIndex,
  onApply,
}: {
  content: string
  paragraphIndex: number
  onApply: (index: number, text: string) => void
}) {
  const { t } = useTranslation()
  const revised = extractRevisedParagraph(content)
  if (!revised) return null

  return (
    <Button
      size='sm'
      variant='outline'
      className='mt-2 h-7 gap-1 text-xs'
      onClick={() => onApply(paragraphIndex, revised)}
    >
      <Sparkles className='size-3' aria-hidden='true' />
      {t('Apply to paragraph {{n}}', { n: paragraphIndex + 1 })}
    </Button>
  )
}
