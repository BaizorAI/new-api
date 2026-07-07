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
import { Check, Loader2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

import { Markdown } from '@/components/ui/markdown'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

import type { BlogChatMessage } from '../hooks/use-blog-article-chat'
import { extractRevisedParagraph } from '../lib/paragraph-utils'

interface BlogWorkspaceChatMessagesProps {
  messages: BlogChatMessage[]
  onApplyRevision?: (paragraphIndex: number, revisedText: string) => void
}

export function BlogWorkspaceChatMessages({
  messages,
  onApplyRevision,
}: BlogWorkspaceChatMessagesProps) {
  const { t } = useTranslation()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  if (messages.length === 0) return null

  return (
    <div
      ref={scrollRef}
      className='max-h-48 flex-1 overflow-y-auto border-t px-4 py-2'
    >
      {messages.map((message) => (
        <div
          key={message.id}
          className={cn(
            'mb-2 last:mb-0',
            message.role === 'user' ? 'text-right' : 'text-left'
          )}
        >
          {message.role === 'user' ? (
            <div className='inline-block rounded-lg bg-primary/10 px-3 py-1.5 text-left text-sm'>
              {message.paragraphIndex !== null && (
                <span className='text-muted-foreground mb-0.5 block text-xs'>
                  {t('¶ {{n}}', { n: message.paragraphIndex + 1 })}
                </span>
              )}
              {message.content}
            </div>
          ) : (
            <div className='text-sm'>
              {message.status === 'loading' && (
                <Loader2 className='text-muted-foreground size-4 animate-spin' />
              )}
              {message.status === 'error' && (
                <span className='text-destructive text-xs'>
                  {message.content}
                </span>
              )}
              {(message.status === 'streaming' ||
                message.status === 'complete') &&
                message.content && (
                  <>
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
                  </>
                )}
            </div>
          )}
        </div>
      ))}
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
      className='mt-1 h-7 gap-1 text-xs'
      onClick={() => onApply(paragraphIndex, revised)}
    >
      <Check className='size-3' aria-hidden='true' />
      {t('Apply to paragraph {{n}}', { n: paragraphIndex + 1 })}
    </Button>
  )
}
