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
  Minimize2,
  RefreshCw,
  Sparkles,
  SquareIcon,
  XIcon,
} from 'lucide-react'
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

import { useBlogArticleChat, type BlogModificationType } from '../hooks/use-blog-article-chat'
import { replaceParagraph } from '../lib/paragraph-utils'
import { useBlogWorkspace } from './blog-workspace-provider'
import { BlogWorkspaceChatMessages } from './blog-workspace-chat-messages'

// Pre-defined AI modification types with labels and icons
const MODIFICATION_TYPES: {
  key: BlogModificationType
  labelKey: string
  icon: typeof Sparkles
  colorClass: string
}[] = [
  {
    key: 'polish',
    labelKey: 'Polish',
    icon: Sparkles,
    colorClass: 'text-amber-500',
  },
  {
    key: 'expand',
    labelKey: 'Expand',
    icon: Expand,
    colorClass: 'text-blue-500',
  },
  {
    key: 'shorten',
    labelKey: 'Shorten',
    icon: Minimize2,
    colorClass: 'text-blue-500',
  },
  {
    key: 'rewrite',
    labelKey: 'Rewrite',
    icon: RefreshCw,
    colorClass: 'text-amber-500',
  },
]

export function BlogWorkspaceChatBar() {
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
    (responseContent: string) => {
      // Only auto-replace full content when generating a new article
      // (not editing a specific paragraph — those use the Apply button)
      if (responseContent.trim() && selectedParagraphIndex === null) {
        setContent(responseContent)
      }
      setIsAnalyzing(false)
      setAnalyzing(false)
      void queryClient.invalidateQueries({ queryKey: ['blog-articles-sidebar'] })
    },
    [queryClient, setContent, selectedParagraphIndex, setAnalyzing]
  )

  const {
    messages,
    sendMessage,
    stopGeneration,
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

  const handleModificationClick = useCallback(
    (modType: BlogModificationType) => {
      if (!selectedParagraphText || isStreaming) return

      // Build user-facing label for the user message
      const labelMap: Record<string, string> = {
        polish: t('Polish'),
        expand: t('Expand'),
        shorten: t('Shorten'),
        rewrite: t('Rewrite'),
      }
      const label = labelMap[modType] ?? modType

      // Send with a clear user-visible message
      sendMessage(`${t(label)}: ${t('paragraph {{n}}', { n: (selectedParagraphIndex ?? 0) + 1 })}`, {
        modificationType: modType,
      })
    },
    [selectedParagraphText, selectedParagraphIndex, isStreaming, sendMessage, t]
  )

  // AI Analyze handler — triggered from toolbar via workspace context
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

  const handleApplyRevision = useCallback(
    (paragraphIndex: number, revisedText: string) => {
      const newContent = replaceParagraph(content, paragraphIndex, revisedText)
      setContent(newContent)
    },
    [content, setContent]
  )

  return (
    <div className='border-border shrink-0 border-t'>
      {/* Chat messages */}
      <BlogWorkspaceChatMessages
        messages={messages}
        onApplyRevision={handleApplyRevision}
      />

      {/* Selected paragraph indicator */}
      {selectedParagraphIndex !== null && (
        <div className='flex items-center gap-1.5 px-4 pt-2'>
          <Badge variant='secondary' className='gap-1 text-xs'>
            {t('Editing ¶ {{n}}', { n: selectedParagraphIndex + 1 })}
            <button
              type='button'
              className='hover:text-foreground ml-0.5'
              onClick={() => selectParagraph(null)}
              aria-label={t('Deselect paragraph')}
            >
              <XIcon className='size-3' aria-hidden='true' />
            </button>
          </Badge>
        </div>
      )}

      {/* Quick modification buttons — shown when a paragraph is selected */}
      {selectedParagraphIndex !== null && (
        <div className='flex items-center gap-1 px-3 pt-1.5'>
          {MODIFICATION_TYPES.map((mt) => {
            const Icon = mt.icon
            return (
              <Button
                key={mt.key}
                size='sm'
                variant='outline'
                className='h-7 gap-1 px-2 text-xs'
                disabled={isStreaming}
                onClick={() => handleModificationClick(mt.key)}
                title={t(mt.labelKey)}
              >
                <Icon className={`size-3.5 ${mt.colorClass}`} aria-hidden='true' />
                {t(mt.labelKey)}
              </Button>
            )
          })}
        </div>
      )}

      {/* Input */}
      <div className='p-3'>
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
                <SquareIcon className='size-4' aria-hidden='true' />
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
