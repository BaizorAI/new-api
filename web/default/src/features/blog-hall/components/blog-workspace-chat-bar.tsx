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
import { SquareIcon, XIcon } from 'lucide-react'
import { useCallback } from 'react'
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

import { useBlogArticleChat } from '../hooks/use-blog-article-chat'
import { replaceParagraph } from '../lib/paragraph-utils'
import { useBlogWorkspace } from './blog-workspace-provider'
import { BlogWorkspaceChatMessages } from './blog-workspace-chat-messages'

export function BlogWorkspaceChatBar() {
  const { t } = useTranslation()
  const {
    content,
    setContent,
    selectedParagraphIndex,
    selectedParagraphText,
    selectParagraph,
  } = useBlogWorkspace()

  const { messages, sendMessage, stopGeneration, isStreaming } =
    useBlogArticleChat({
      content,
      selectedParagraphIndex,
      selectedParagraphText,
    })

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = (message.text ?? '').trim()
      if (!text || isStreaming) return
      sendMessage(text)
    },
    [isStreaming, sendMessage]
  )

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
                : t('Ask AI to help with your article...')
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
