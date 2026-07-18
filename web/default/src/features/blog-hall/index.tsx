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
import { BookOpen, Save } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useStreamRequest } from '@/features/playground/hooks/use-stream-request'
import { getOrCreatePlaygroundSessionId } from '@/features/playground/lib/storage'
import type { ChatCompletionRequest } from '@/features/playground/types'
import { useAuthStore } from '@/stores/auth-store'

import { createBlogArticle } from './api'

export function BlogHall() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { sendStreamRequest } = useStreamRequest()
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const hermesSessionId = useMemo(() => {
    const userId = useAuthStore.getState().auth.user?.id ?? 'anon'
    return getOrCreatePlaygroundSessionId(`skill_blog_user_${userId}`)
  }, [])

  const requestHeaders = useMemo<Record<string, string>>(
    () => ({
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Session': hermesSessionId,
      'X-Baizor-Hermes-Workspace': 'skill_blog',
      'X-Baizor-Hermes-Skill-Activate': '/magicalbrush',
    }),
    [hermesSessionId]
  )

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = (message.text ?? '').trim()
      if (!text || isStreaming) return

      setStreamingContent('')
      setIsStreaming(true)

      const payload: ChatCompletionRequest = {
        model: 'huayu-v2',
        messages: [{ role: 'user', content: text }],
        stream: true,
      }

      sendStreamRequest(
        payload,
        requestHeaders,
        (_type, chunk) => {
          setStreamingContent((prev) => prev + chunk)
        },
        () => {
          setIsStreaming(false)
          void queryClient.invalidateQueries({
            queryKey: ['blog-articles-sidebar'],
          })
        },
        () => {
          setIsStreaming(false)
        }
      )
    },
    [isStreaming, queryClient, requestHeaders, sendStreamRequest]
  )

  const handleSaveAsArticle = useCallback(async () => {
    if (!streamingContent.trim() || isSaving) return
    setIsSaving(true)
    try {
      const result = await createBlogArticle({
        title: t('Untitled article'),
        summary: '',
        content: streamingContent,
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
  }, [streamingContent, isSaving, t, queryClient, navigate])

  return (
    <div className='flex h-full flex-col'>
      {/* Content area */}
      <ScrollArea className='flex-1'>
        {streamingContent ? (
          <div className='space-y-4'>
            <div className='prose dark:prose-invert mx-auto max-w-3xl p-6 pb-0'>
              <Markdown content={streamingContent} />
            </div>
            {/* Save button — only shown when not streaming */}
            {!isStreaming && (
              <div className='flex justify-center pb-6'>
                <Button
                  onClick={() => void handleSaveAsArticle()}
                  disabled={isSaving}
                  size='sm'
                >
                  <Save className='mr-1.5 size-4' aria-hidden='true' />
                  {isSaving ? t('Saving...') : t('Save as Article')}
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className='flex h-full flex-col items-center justify-center gap-4 text-center'>
            <BookOpen
              className='text-muted-foreground/40 size-12'
              aria-hidden='true'
            />
            <p className='text-muted-foreground text-sm'>
              {t('Enter a topic below to create a new article.')}
            </p>
          </div>
        )}
      </ScrollArea>

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
            <PromptInputSubmit className='size-7' />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
