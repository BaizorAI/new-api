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
import { Check, Eye, PenLine } from 'lucide-react'
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { useDebounce } from '@/hooks/use-debounce'

import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { Textarea } from '@/components/ui/textarea'

import { updateStudioStage } from '../api'
import { STUDIO_QUERY_KEYS } from '../constants'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'dirty'

export interface ScriptEditorHandle {
  getText: () => string
  setText: (text: string) => void
  getSelection: () => { start: number; end: number; text: string } | null
  replaceRange: (start: number, end: number, replacement: string) => void
}

interface StudioScriptEditorProps {
  projectId: number
  stageKey: string
  initialContent: string
  onSelectionChange?: (
    selection: { start: number; end: number; text: string } | null
  ) => void
}

export const StudioScriptEditor = forwardRef<
  ScriptEditorHandle,
  StudioScriptEditorProps
>(function StudioScriptEditor({
  projectId,
  stageKey,
  initialContent,
  onSelectionChange,
}, ref) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [text, setText] = useState(initialContent)
  const [mode, setMode] = useState<'edit' | 'preview'>('edit')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')

  // Track whether the component has been initialized to avoid
  // triggering a save from the initial content load
  const initializedRef = useRef(false)
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const debouncedText = useDebounce(text, 1500)

  // Expose imperative API for parent to read/write text and selection
  useImperativeHandle(ref, () => ({
    getText: () => text,
    setText: (newText: string) => {
      setText(newText)
      if (initializedRef.current) {
        setSaveStatus('dirty')
      }
    },
    getSelection: () => {
      const el = textareaRef.current
      if (!el) return null
      const { selectionStart, selectionEnd } = el
      if (selectionStart === selectionEnd) return null
      return {
        start: selectionStart,
        end: selectionEnd,
        text: text.slice(selectionStart, selectionEnd),
      }
    },
    replaceRange: (start: number, end: number, replacement: string) => {
      const before = text.slice(0, start)
      const after = text.slice(end)
      const newText = before + replacement + after
      setText(newText)
      if (initializedRef.current) {
        setSaveStatus('dirty')
      }
      // Restore cursor position after the replacement
      const cursorPos = start + replacement.length
      requestAnimationFrame(() => {
        const el = textareaRef.current
        if (el) {
          el.focus()
          el.setSelectionRange(cursorPos, cursorPos)
        }
      })
    },
  }), [text])

  // Sync initial content when stage data loads/changes
  useEffect(() => {
    setText(initialContent)
    initializedRef.current = true
    setSaveStatus('idle')
  }, [initialContent])

  // Mark as dirty whenever text changes (after initialization)
  const handleTextChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setText(e.target.value)
      if (initializedRef.current) {
        setSaveStatus('dirty')
      }
    },
    []
  )

  // Notify parent when the user selects text in the textarea
  const handleSelectionChange = useCallback(() => {
    if (!onSelectionChange) return
    const el = textareaRef.current
    if (!el) return
    const { selectionStart, selectionEnd } = el
    if (selectionStart === selectionEnd) {
      onSelectionChange(null)
    } else {
      onSelectionChange({
        start: selectionStart,
        end: selectionEnd,
        text: text.slice(selectionStart, selectionEnd),
      })
    }
  }, [onSelectionChange, text])

  // Auto-save when debounced text changes
  useEffect(() => {
    if (!initializedRef.current) return
    if (debouncedText === initialContent && saveStatus !== 'dirty') return

    let cancelled = false

    const doSave = async () => {
      setSaveStatus('saving')
      try {
        const result = await updateStudioStage(projectId, stageKey, {
          output_data: debouncedText,
        })
        if (cancelled) return
        if (result.success) {
          void queryClient.invalidateQueries({
            queryKey: [...STUDIO_QUERY_KEYS.stages(projectId)],
          })
          setSaveStatus('saved')
          // Clear any existing timer
          if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
          savedTimerRef.current = setTimeout(() => {
            if (!cancelled) setSaveStatus('idle')
          }, 2000)
        }
      } catch {
        if (!cancelled) {
          setSaveStatus('dirty')
          toast.error(t('Failed to save script.'))
        }
      }
    }

    void doSave()

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedText])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current)
    }
  }, [])

  const charCount = text.trim() ? text.trim().length : 0

  return (
    <div className='flex flex-col gap-3'>
      {/* Toolbar */}
      <div className='flex items-center gap-2'>
        {/* Mode toggle */}
        <div className='bg-muted flex rounded-md p-0.5'>
          <Button
            type='button'
            size='sm'
            variant={mode === 'edit' ? 'default' : 'ghost'}
            className='h-7 gap-1.5 px-2.5 text-xs'
            onClick={() => setMode('edit')}
          >
            <PenLine className='size-3.5' aria-hidden='true' />
            {t('Edit')}
          </Button>
          <Button
            type='button'
            size='sm'
            variant={mode === 'preview' ? 'default' : 'ghost'}
            className='h-7 gap-1.5 px-2.5 text-xs'
            onClick={() => setMode('preview')}
          >
            <Eye className='size-3.5' aria-hidden='true' />
            {t('Preview')}
          </Button>
        </div>

        {/* Spacer */}
        <div className='flex-1' />

        {/* Word count */}
        <span className='text-muted-foreground text-xs'>
          {charCount} {t('characters')}
        </span>

        {/* Save status */}
        <SaveStatusIndicator status={saveStatus} />
      </div>

      {/* Editor / Preview area */}
      {mode === 'edit' ? (
        <Textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onSelect={handleSelectionChange}
          onMouseUp={handleSelectionChange}
          onKeyUp={handleSelectionChange}
          placeholder={t('Write your screenplay here...')}
          className='min-h-[400px] resize-none font-mono text-sm leading-relaxed'
        />
      ) : (
        <div className='border-border min-h-[400px] rounded-lg border p-4'>
          {text.trim() ? (
            <div className='prose dark:prose-invert prose-sm max-w-none'>
              <Markdown>{text}</Markdown>
            </div>
          ) : (
            <p className='text-muted-foreground text-sm'>
              {t('Nothing to preview yet.')}
            </p>
          )}
        </div>
      )}
    </div>
  )
})

function SaveStatusIndicator(props: { status: SaveStatus }) {
  const { t } = useTranslation()
  const { status } = props

  switch (status) {
    case 'saving':
      return (
        <span className='text-muted-foreground animate-pulse text-xs'>
          {t('Saving...')}
        </span>
      )
    case 'saved':
      return (
        <span className='text-xs text-green-600 dark:text-green-400'>
          <Check className='mr-0.5 inline size-3' aria-hidden='true' />
          {t('Saved')}
        </span>
      )
    case 'dirty':
      return (
        <span className='text-muted-foreground text-xs'>
          {t('Unsaved changes')}
        </span>
      )
    default:
      return null
  }
}
