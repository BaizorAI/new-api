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
import {
  Check,
  Expand,
  Minimize2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { extractRevisedParagraph } from '@/features/blog-hall/lib/paragraph-utils'
import {
  type InlineWritingAction,
  useInlineWritingAssistant,
} from '@/features/blog-hall/hooks/use-inline-writing-assistant'

interface BlogAiInlineToolbarProps {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  content: string
  setContent: (content: string) => void
  title: string
  summary: string
  articleId?: number
}

interface TextSelection {
  text: string
  start: number
  end: number
  x: number
  y: number
}

interface AiAction {
  key: InlineWritingAction
  label: string
  icon: React.ElementType
}

export function BlogAiInlineToolbar({
  textareaRef,
  content,
  setContent,
  title,
  summary,
  articleId,
}: BlogAiInlineToolbarProps) {
  const { t } = useTranslation()
  const { runAction, stopAction, isStreaming } = useInlineWritingAssistant()
  const toolbarRef = useRef<HTMLDivElement>(null)

  const [selection, setSelection] = useState<TextSelection | null>(null)
  const [preview, setPreview] = useState<{
    action: InlineWritingAction
    text: string
    isStreaming: boolean
  } | null>(null)

  const actions: AiAction[] = [
    { key: 'polish', label: t('Polish'), icon: Sparkles },
    { key: 'expand', label: t('Expand'), icon: Expand },
    { key: 'shorten', label: t('Shorten'), icon: Minimize2 },
    { key: 'rewrite', label: t('Rewrite'), icon: RefreshCw },
  ]

  const clear = useCallback(() => {
    setSelection(null)
    setPreview(null)
  }, [])

  // Listen to text selection inside the textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return

    function handleMouseUp(event: MouseEvent) {
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      if (start === end) {
        if (!previewRef.current) setSelection(null)
        return
      }

      const selectedText = content.slice(start, end)
      if (!selectedText.trim()) {
        if (!previewRef.current) setSelection(null)
        return
      }

      setSelection({
        text: selectedText,
        start,
        end,
        x: event.clientX,
        y: event.clientY,
      })
      setPreview(null)
    }

    textarea.addEventListener('mouseup', handleMouseUp)
    return () => textarea.removeEventListener('mouseup', handleMouseUp)
  }, [content, textareaRef])

  // Keep a ref to preview so the mouseup listener can read the latest state
  // without re-binding the native event handler on every keystroke.
  const previewRef = useRef(preview)
  useEffect(() => {
    previewRef.current = preview
  }, [preview])

  // Hide toolbar when clicking outside
  useEffect(() => {
    function handleMouseDown(event: MouseEvent) {
      const target = event.target as Node
      const toolbar = toolbarRef.current
      const textarea = textareaRef.current
      if (
        toolbar?.contains(target) ||
        textarea === target ||
        textarea?.contains(target)
      ) {
        return
      }
      clear()
    }

    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [clear, textareaRef])



  const handleAction = useCallback(
    (action: InlineWritingAction) => {
      if (!selection || isStreaming) return

      setPreview({ action, text: '', isStreaming: true })

      let accumulated = ''
      runAction({
        action,
        context: {
          articleId,
          title,
          summary,
          content,
          selectedText: selection.text,
        },
        onDelta: (chunk) => {
          accumulated += chunk
          const revised = extractRevisedParagraph(accumulated)
          setPreview((prev) =>
            prev
              ? {
                  ...prev,
                  text: revised ?? accumulated,
                  isStreaming: true,
                }
              : null
          )
        },
        onComplete: () => {
          const revised = extractRevisedParagraph(accumulated)
          const final = revised ?? accumulated
          setPreview((prev) =>
            prev
              ? {
                  ...prev,
                  text: final,
                  isStreaming: false,
                }
              : null
          )
        },
        onError: () => {
          setPreview((prev) =>
            prev ? { ...prev, isStreaming: false } : null
          )
        },
      })
    },
    [selection, isStreaming, runAction, articleId, title, summary, content]
  )

  const handleAccept = useCallback(() => {
    if (!selection || !preview) return
    const before = content.slice(0, selection.start)
    const after = content.slice(selection.end)
    const replacement = preview.text.trim()
    setContent(before + replacement + after)
    clear()
  }, [selection, preview, content, setContent, clear])

  const handleReject = useCallback(() => {
    stopAction()
    clear()
  }, [stopAction, clear])

  if (!selection) return null

  return (
    <div
      ref={toolbarRef}
      className='fixed z-50'
      style={{
        left: selection.x,
        top: selection.y + 12,
        transform: 'translateX(-50%)',
      }}
    >
      {preview ? (
        <div className='bg-popover border-border w-80 rounded-lg border p-3 shadow-lg'>
          <div className='text-muted-foreground mb-1.5 flex items-center justify-between text-xs'>
            <span className='font-medium'>
              {actions.find((a) => a.key === preview.action)?.label ??
                t('AI result')}
            </span>
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
      ) : (
        <div className='bg-popover border-border flex items-center gap-0.5 rounded-lg border p-1 shadow-lg'>
          {actions.map((action) => {
            const Icon = action.icon
            return (
              <Button
                key={action.key}
                type='button'
                size='xs'
                variant='ghost'
                className='h-7 gap-1 px-2 text-xs'
                onClick={() => handleAction(action.key)}
              >
                <Icon className='size-3.5 text-primary' />
                {action.label}
              </Button>
            )
          })}
        </div>
      )}
    </div>
  )
}
