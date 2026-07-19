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
import { Check, CornerDownRight, Loader2, X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { extractContinue } from '@/features/blog-hall/lib/paragraph-utils'
import { useInlineWritingAssistant } from '@/features/blog-hall/hooks/use-inline-writing-assistant'

interface BlogAiEditToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  content: string
  setContent: (content: string) => void
  title: string
  summary: string
  articleId?: number
}

export function BlogAiEditToolbar({
  textareaRef,
  content,
  setContent,
  title,
  summary,
  articleId,
}: BlogAiEditToolbarProps) {
  const { t } = useTranslation()
  const { runAction, stopAction } = useInlineWritingAssistant()
  const busyRef = useRef(false)

  const [preview, setPreview] = useState<{
    text: string
    isStreaming: boolean
  } | null>(null)

  const handleContinue = useCallback(() => {
    if (busyRef.current) return
    busyRef.current = true

    setPreview({ text: '', isStreaming: true })
    let accumulated = ''

    runAction({
      action: 'continue',
      context: { articleId, title, summary, content },
      onDelta: (chunk) => {
        accumulated += chunk
        const continued = extractContinue(accumulated)
        setPreview((prev) =>
          prev
            ? { ...prev, text: continued ?? accumulated, isStreaming: true }
            : null
        )
      },
      onComplete: () => {
        busyRef.current = false
        const continued = extractContinue(accumulated)
        const final = continued ?? accumulated
        setPreview((prev) =>
          prev ? { ...prev, text: final, isStreaming: false } : null
        )
      },
      onError: () => {
        busyRef.current = false
        setPreview((prev) => (prev ? { ...prev, isStreaming: false } : null))
      },
    })
  }, [runAction, articleId, title, summary, content])

  const handleAccept = useCallback(() => {
    if (!preview || preview.isStreaming) return
    const insertion = preview.text.trim()
    if (!insertion) return

    const trimmed = content.trimEnd()
    const separator = trimmed.length === 0 ? '' : '\n\n'
    setContent(trimmed + separator + insertion + '\n')
    setPreview(null)

    // Restore focus to the end of the textarea
    const textarea = textareaRef.current
    if (textarea) {
      requestAnimationFrame(() => {
        textarea.focus()
        textarea.selectionStart = textarea.value.length
        textarea.selectionEnd = textarea.value.length
      })
    }
  }, [preview, content, setContent, textareaRef])

  const handleReject = useCallback(() => {
    stopAction()
    setPreview(null)
  }, [stopAction])

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between'>
        <Button
          type='button'
          size='sm'
          variant='outline'
          onClick={handleContinue}
          disabled={preview?.isStreaming ?? false}
          className='gap-1.5'
        >
          {preview?.isStreaming ? (
            <Loader2 className='size-3.5 animate-spin' />
          ) : (
            <CornerDownRight className='size-3.5 text-primary' />
          )}
          {preview?.isStreaming ? t('Writing...') : t('Continue writing')}
        </Button>

        <p className='text-muted-foreground text-xs'>
          {t('Tip: select text to polish, expand, shorten, or rewrite.')}
        </p>
      </div>

      {preview && (
        <div className='bg-popover border-border rounded-lg border p-3 shadow-sm'>
          <div className='text-muted-foreground mb-1.5 flex items-center justify-between text-xs'>
            <span className='font-medium'>{t('Continue writing')}</span>
            {preview.isStreaming && (
              <span className='text-primary animate-pulse'>{t('Writing...')}</span>
            )}
          </div>
          <div className='bg-muted max-h-48 overflow-y-auto rounded-md p-2 text-sm whitespace-pre-wrap'>
            {preview.text}
          </div>
          <div className='mt-2 flex justify-end gap-1.5'>
            <Button
              type='button'
              size='xs'
              variant='ghost'
              onClick={handleReject}
              disabled={preview.isStreaming}
            >
              <X className='mr-1 size-3' />
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              size='xs'
              onClick={handleAccept}
              disabled={preview.isStreaming}
            >
              <Check className='mr-1 size-3' />
              {t('Accept')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
