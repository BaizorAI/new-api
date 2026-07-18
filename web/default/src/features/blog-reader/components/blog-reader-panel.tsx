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
import { RotateCcw, Send, Sparkles, Square } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { Textarea } from '@/components/ui/textarea'

import type { BlogArticle } from '@/features/blog-hall/types'

import { useBlogReaderChat, type ReaderChatMessage } from '../hooks/use-blog-reader-chat'

interface BlogReaderPanelProps {
  article: BlogArticle
}

export function BlogReaderPanel({ article }: BlogReaderPanelProps) {
  const { t } = useTranslation()
  const [input, setInput] = useState('')
  const { messages, sendMessage, runPreset, clearChat, stopStream } = useBlogReaderChat({
    articleId: article.id,
    articleGuid: article.guid,
    title: article.title,
    summary: article.summary,
    content: article.content,
  })

  const isStreaming = messages.some(
    (m) => m.status === 'streaming' || m.status === 'loading'
  )

  const handleSend = () => {
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <section
      className='bg-card border-border rounded-lg border p-4 shadow-sm'
      aria-label={t('AI Reading Assistant')}
    >
      <div className='mb-4 flex items-center justify-between gap-2'>
        <h2 className='flex items-center gap-2 text-base font-semibold'>
          <Sparkles className='text-primary h-4 w-4' />
          {t('AI Reading Assistant')}
        </h2>
        {messages.length > 0 && (
          <Button
            variant='ghost'
            size='icon-xs'
            onClick={clearChat}
            title={t('New chat')}
          >
            <RotateCcw className='h-3.5 w-3.5' />
          </Button>
        )}
      </div>

      <div className='flex flex-col gap-3'>
        {messages.length === 0 && (
          <div className='space-y-3'>
            <p className='text-muted-foreground text-sm'>
              {t('The AI assistant can summarize, explain, and answer questions about this article.')}
            </p>
            <div className='flex flex-wrap gap-2'>
              <Button
                variant='outline'
                size='xs'
                onClick={() => runPreset('summarize')}
              >
                {t('Summarize')}
              </Button>
              <Button
                variant='outline'
                size='xs'
                onClick={() => runPreset('simplify')}
              >
                {t('Simplify')}
              </Button>
              <Button
                variant='outline'
                size='xs'
                onClick={() => runPreset('takeaways')}
              >
                {t('Key takeaways')}
              </Button>
              <Button
                variant='outline'
                size='xs'
                onClick={() => runPreset('related')}
              >
                {t('Related reading')}
              </Button>
            </div>
          </div>
        )}

        <div className='max-h-96 min-h-[120px] overflow-y-auto space-y-3 pr-1'>
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
        </div>

        <div className='flex items-end gap-2 pt-2'>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('Ask anything about this article...')}
            className='min-h-10 resize-none py-2 text-sm'
            rows={1}
            disabled={isStreaming}
          />
          {isStreaming ? (
            <Button
              variant='secondary'
              size='icon'
              onClick={stopStream}
              title={t('Stop')}
            >
              <Square className='h-4 w-4 fill-current' />
            </Button>
          ) : (
            <Button
              size='icon'
              onClick={handleSend}
              disabled={!input.trim()}
              title={t('Send')}
            >
              <Send className='h-4 w-4' />
            </Button>
          )}
        </div>
      </div>
    </section>
  )
}

function MessageBubble({ message }: { message: ReaderChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div
        className={`max-w-[92%] rounded-lg px-3 py-2 text-sm ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-foreground'
        }`}
      >
        {isUser ? (
          <p className='whitespace-pre-wrap'>{message.content}</p>
        ) : (
          <Markdown className='prose prose-sm prose-neutral dark:prose-invert'>
            {message.content || (message.status === 'loading' ? '...' : '')}
          </Markdown>
        )}
      </div>
    </div>
  )
}
