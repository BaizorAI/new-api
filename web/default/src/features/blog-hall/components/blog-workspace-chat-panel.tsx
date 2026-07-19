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
  Check,
  Expand,
  ImagePlus,
  Loader2,
  MessageSquareQuote,
  Minimize2,
  Pencil,
  RefreshCw,
  Sparkles,
  SquareIcon,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
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
import { toast } from 'sonner'

import {
  getImageHistory,
  submitImageGeneration,
} from '@/features/image-playground/api'
import { IMAGE_STATUS } from '@/features/image-playground/types'

import { updateBlogArticle } from '../api'
import { useBlogArticleChat, type BlogModificationType } from '../hooks/use-blog-article-chat'
import {
  extractFullArticle,
  extractImagePrompt,
  extractRevisedParagraph,
  extractSummary,
  extractTags,
  extractTitles,
  getChatActions,
  insertImageIntoContent,
  replaceParagraph,
} from '../lib/paragraph-utils'
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
    setTitle,
    setSummary,
    setTags,
    coverImage,
    tags,
    setStatus,
    selectedParagraphIndex,
    selectedParagraphText,
    selectParagraph,
    analyzeRequested,
    setAnalyzing,
    genTitleRequested,
    genSummaryRequested,
    setGeneratingField,
    isSaving,
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
    (
      message: PromptInputMessage,
      secondArg?: FormEvent<HTMLFormElement> | BlogModificationType
    ) => {
      const text = (message.text ?? '').trim()
      if (!text || isStreaming) return

      const modificationType =
        typeof secondArg === 'string' ? secondArg : undefined
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

  // Apply full article content (from AI generation/rewrite)
  const handleApplyFullArticle = useCallback(
    (articleContent: string) => {
      setContent(articleContent)
    },
    [setContent]
  )

  // Use AI-suggested title
  const handleUseTitle = useCallback(
    (newTitle: string) => {
      setTitle(newTitle)
      setGeneratingField(null)
      toast.success(t('Title updated.'))
    },
    [setTitle, setGeneratingField, t]
  )

  // Use AI-suggested summary
  const handleUseSummary = useCallback(
    (newSummary: string) => {
      setSummary(newSummary)
      setGeneratingField(null)
      toast.success(t('Summary updated.'))
    },
    [setSummary, setGeneratingField, t]
  )

  // Set tags from AI suggestion
  const handleSetTags = useCallback(
    (newTags: string) => {
      setTags(newTags)
      toast.success(t('Tags updated.'))
    },
    [setTags, t]
  )

  // Rewrite from analysis — ask AI to improve based on suggestions
  const handleRewriteFromAnalysis = useCallback(() => {
    if (isStreaming) return
    sendMessage('请根据以上分析建议，重写完整文章。保留所有改进点。', {
      modificationType: 'rewrite',
    })
  }, [isStreaming, sendMessage])

  // Publish article when AI analysis says it's ready
  const handlePublish = useCallback(async () => {
    if (!article || isSaving) return
    const parsedTags = tags
      ? tags.split(',').map((tag) => tag.trim()).filter(Boolean)
      : []
    const result = await updateBlogArticle(article.id, {
      title,
      summary,
      content,
      cover_image: coverImage,
      tags: parsedTags,
      status: 'published',
    })
    if (result.success) {
      setStatus('published')
      toast.success(t('Article published.'))
      void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
      void queryClient.invalidateQueries({ queryKey: ['blog-article', article.id] })
    }
  }, [article, content, coverImage, isSaving, queryClient, setStatus, summary, tags, title, t])

  // Image generation — submit prompt, poll, then show result in chat
  const [, setGeneratingImage] = useState(false)
  const generatingRef = useRef(false)
  const handleGenerateImage = useCallback(
    async (prompt: string, paragraphIndex: number | null) => {
      if (generatingRef.current) return
      generatingRef.current = true
      setGeneratingImage(true)

      // Show "generating" message in chat
      addAssistantMessage('🎨 正在生成配图...')

      try {
        const pending = await submitImageGeneration({
          prompt,
          model: 'huayu-drama-4',
          size: '1024x1024',
          quality: 'standard',
          group: 'default',
        })
        // Poll for result
        let polls = 0
        const MAX_POLLS = 40
        const poll = async (): Promise<void> => {
          polls++
          if (polls > MAX_POLLS) {
            generatingRef.current = false
            setGeneratingImage(false)
            addAssistantMessage('❌ 配图生成超时，请重试。')
            return
          }
          try {
            const history = await getImageHistory(1, 10)
            const record = history.items.find((h) => h.id === pending.id)
            if (!record || record.status === IMAGE_STATUS.PENDING) {
              setTimeout(() => { void poll() }, 3000)
              return
            }
            generatingRef.current = false
            setGeneratingImage(false)
            if (record.status === IMAGE_STATUS.COMPLETED && record.image_url) {
              // Insert image into article content
              const altText = prompt.slice(0, 60)
              const newContent = insertImageIntoContent(
                content,
                record.image_url,
                altText,
                paragraphIndex
              )
              setContent(newContent)
              // Show result in chat as a message
              addAssistantMessage(
                `✅ 配图已生成并插入文章：\n\n![${altText}](${record.image_url})`
              )
            } else {
              addAssistantMessage(
                `❌ 配图生成失败：${record.error_message || t('Image generation failed.')}`
              )
            }
          } catch {
            generatingRef.current = false
            setGeneratingImage(false)
            addAssistantMessage(`❌ ${t('Image generation failed.')}`)
          }
        }
        setTimeout(() => { void poll() }, 3000)
      } catch {
        generatingRef.current = false
        setGeneratingImage(false)
        addAssistantMessage(`❌ ${t('Image generation failed.')}`)
      }
    },
    [content, setContent, addAssistantMessage, t]
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

  // AI Generate Title handler
  const handleGenTitle = useCallback(() => {
    if (isStreaming) return
    setGeneratingField('title')
    sendMessage('请为文章生成 3 个候选标题。', {
      modificationType: 'generate_title',
    })
  }, [isStreaming, sendMessage, setGeneratingField])

  const genTitleRef = useRef(genTitleRequested)
  useEffect(() => {
    if (genTitleRequested !== genTitleRef.current) {
      genTitleRef.current = genTitleRequested
      handleGenTitle()
    }
  }, [genTitleRequested, handleGenTitle])

  // AI Generate Summary handler
  const handleGenSummary = useCallback(() => {
    if (isStreaming) return
    setGeneratingField('summary')
    sendMessage('请为文章生成一段简洁的摘要。', {
      modificationType: 'generate_summary',
    })
  }, [isStreaming, sendMessage, setGeneratingField])

  const genSummaryRef = useRef(genSummaryRequested)
  useEffect(() => {
    if (genSummaryRequested !== genSummaryRef.current) {
      genSummaryRef.current = genSummaryRequested
      handleGenSummary()
    }
  }, [genSummaryRequested, handleGenSummary])

  // Clear generating field when streaming completes
  useEffect(() => {
    if (!isStreaming) {
      // Small delay to let the "Use as title/summary" button appear
      const timer = setTimeout(() => setGeneratingField(null), 500)
      return () => clearTimeout(timer)
    }
  }, [isStreaming, setGeneratingField])

  return (
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
                'AI powered by blog-v1 will help you write and edit your article.'
              )}
              icon={<Wand2 className='size-8 text-purple-500' />}
            />
          ) : (
            messages.map((msg) => (
              <BlogChatBubble
                key={msg.id}
                message={msg}
                onApplyRevision={handleApplyRevision}
                onApplyFullArticle={handleApplyFullArticle}
                onUseTitle={handleUseTitle}
                onUseSummary={handleUseSummary}
                onSetTags={handleSetTags}
                onGenerateImage={handleGenerateImage}
                onRewriteFromAnalysis={handleRewriteFromAnalysis}
                onPublish={handlePublish}
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
      ) : (
        /* Quick actions for whole-article operations (no paragraph selected) */
        content.trim() ? (
          <div className='border-border flex flex-wrap items-center gap-1 border-t px-3 py-2'>
            <span className='text-muted-foreground mr-1 text-[10px] uppercase tracking-wider'>
              {t('Generate title')}
            </span>
            <Button
              size='sm'
              variant='outline'
              className='h-6 gap-1 px-2 text-[11px]'
              disabled={isStreaming}
              onClick={handleGenTitle}
            >
              <Sparkles className='size-3 text-amber-500' />
              {t('Generate title')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='h-6 gap-1 px-2 text-[11px]'
              disabled={isStreaming}
              onClick={handleGenSummary}
            >
              <Sparkles className='size-3 text-sky-500' />
              {t('Generate summary')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='h-6 gap-1 px-2 text-[11px]'
              disabled={isStreaming}
              onClick={() => {
                handleSubmit(
                  { text: '请为此文章生成一张配图的 prompt。' } as PromptInputMessage,
                  'image_prompt'
                )
              }}
            >
              <ImagePlus className='size-3 text-pink-500' />
              {t('Generate image prompt')}
            </Button>
            <Button
              size='sm'
              variant='outline'
              className='h-6 gap-1 px-2 text-[11px]'
              disabled={isStreaming}
              onClick={() => {
                handleSubmit(
                  { text: '请为此文章进行智能排版优化。' } as PromptInputMessage,
                  'format'
                )
              }}
            >
              <Wand2 className='size-3 text-emerald-500' />
              {t('Smart Format')}
            </Button>
          </div>
        ) : null
      )}

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
  onApplyFullArticle?: (content: string) => void
  onUseTitle?: (title: string) => void
  onUseSummary?: (summary: string) => void
  onSetTags?: (tags: string) => void
  onGenerateImage?: (prompt: string, paragraphIndex: number | null) => void
  onRewriteFromAnalysis?: () => void
  onPublish?: () => void
  paragraphText?: string | null
}

function BlogChatBubble({
  message,
  onApplyRevision,
  onApplyFullArticle,
  onUseTitle,
  onUseSummary,
  onSetTags,
  onGenerateImage,
  onRewriteFromAnalysis,
  onPublish,
}: BlogChatBubbleProps) {
  const { t } = useTranslation()
  const [applied, setApplied] = useState(false)

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
  const actions = isComplete ? getChatActions(message.content) : []
  const revisedPara = extractRevisedParagraph(message.content)
  const fullArticle = extractFullArticle(message.content)
  const titles = extractTitles(message.content)
  const summary = extractSummary(message.content)
  const tags = extractTags(message.content)
  const imagePrompt = extractImagePrompt(message.content)

  return (
    <div className='flex justify-start'>
      <div className='bg-muted max-w-[85%] rounded-lg px-3 py-2 text-sm'>
        <div className='prose prose-sm dark:prose-invert max-w-none'>
          <Markdown>{message.content}</Markdown>
        </div>

        {/* ── Action buttons ─────────────────────────────────────── */}
        {isComplete && actions.length > 0 && (
          <div className='mt-2 flex flex-wrap items-center gap-1.5 border-t pt-2'>
            {actions.includes('revised-paragraph') && onApplyRevision && (
              <Button
                size='sm'
                variant={applied ? 'ghost' : 'outline'}
                className='h-7 gap-1 px-2 text-xs'
                disabled={applied}
                onClick={() => {
                  if (revisedPara) {
                    onApplyRevision(message.paragraphIndex ?? 0, revisedPara)
                    setApplied(true)
                  }
                }}
              >
                <Check className='size-3 text-emerald-500' />
                {applied
                  ? t('Applied')
                  : message.paragraphIndex != null
                    ? t('Apply to paragraph {{n}}', { n: message.paragraphIndex + 1 })
                    : t('Apply to article')}
              </Button>
            )}

            {actions.includes('full-article') && onApplyFullArticle && (
              <Button
                size='sm'
                variant={applied ? 'ghost' : 'outline'}
                className='h-7 gap-1 px-2 text-xs'
                disabled={applied}
                onClick={() => {
                  onApplyFullArticle(fullArticle ?? message.content)
                  setApplied(true)
                }}
              >
                <Check className='size-3 text-emerald-500' />
                {applied ? t('Applied') : t('Apply full article')}
              </Button>
            )}

            {actions.includes('title') &&
              onUseTitle &&
              titles.map((title) => (
                <Button
                  key={title}
                  size='sm'
                  variant='outline'
                  className='h-7 gap-1 px-2 text-xs'
                  onClick={() => onUseTitle(title)}
                  title={title}
                >
                  <Pencil className='size-3 text-amber-500' />
                  {t('Use as title')}
                </Button>
              ))}

            {actions.includes('summary') && onUseSummary && summary && (
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

            {actions.includes('tags') && onSetTags && tags && (
              <Button
                size='sm'
                variant='outline'
                className='h-7 gap-1 px-2 text-xs'
                onClick={() => onSetTags(tags)}
              >
                <Check className='size-3 text-violet-500' />
                {t('Set tags')}
              </Button>
            )}

            {actions.includes('image-prompt') && onGenerateImage && imagePrompt && (
              <Button
                size='sm'
                variant='outline'
                className='h-7 gap-1 px-2 text-xs'
                onClick={() =>
                  onGenerateImage(imagePrompt, message.paragraphIndex)
                }
              >
                <ImagePlus className='size-3 text-pink-500' />
                {t('Generate image')}
              </Button>
            )}

            {actions.includes('analysis-pass') && onPublish && (
              <Button
                size='sm'
                variant='outline'
                className='h-7 gap-1 px-2 text-xs'
                onClick={onPublish}
              >
                <Check className='size-3 text-emerald-500' />
                {t('Publish')}
              </Button>
            )}

            {actions.includes('analysis-suggest') && onRewriteFromAnalysis && (
              <Button
                size='sm'
                variant='outline'
                className='h-7 gap-1 px-2 text-xs'
                onClick={onRewriteFromAnalysis}
              >
                <RefreshCw className='size-3 text-amber-500' />
                {t('Modify according to suggestions')}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
