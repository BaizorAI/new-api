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
import { Eye, Loader2, MousePointerClick, PenLine, Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { splitMarkdownIntoParagraphs } from '../lib/paragraph-utils'
import { BlogAiEditToolbar } from './blog-ai-edit-toolbar'
import { BlogAiInlineToolbar } from './blog-ai-inline-toolbar'

// ============================================================================
// Types
// ============================================================================

type EditorMode = 'edit' | 'select' | 'preview'

export interface BlogArticleEditorProps {
  content: string
  setContent: (content: string) => void
  title: string
  setTitle: (title: string) => void
  summary: string
  setSummary: (summary: string) => void
  coverImage?: string
  articleId?: number
  initialMode?: EditorMode
  selectedParagraphIndex?: number | null
  onSelectParagraph?: (index: number | null) => void
  generatingField?: 'title' | 'summary' | null
  onGenerateTitle?: () => void
  onGenerateSummary?: () => void
}

// ============================================================================
// Component
// ============================================================================

export function BlogArticleEditor({
  content,
  setContent,
  title,
  setTitle,
  summary,
  setSummary,
  coverImage,
  articleId,
  initialMode = 'preview',
  selectedParagraphIndex: externalSelectedIndex = null,
  onSelectParagraph,
  generatingField,
  onGenerateTitle,
  onGenerateSummary,
}: BlogArticleEditorProps) {
  const { t } = useTranslation()

  const [mode, setMode] = useState<EditorMode>(initialMode)
  const [editingField, setEditingField] = useState<'title' | 'summary' | null>(null)
  const [internalSelectedIndex, setInternalSelectedIndex] = useState<number | null>(null)

  const selectedParagraphIndex =
    externalSelectedIndex !== undefined ? externalSelectedIndex : internalSelectedIndex

  const selectParagraph = (index: number | null) => {
    if (onSelectParagraph) {
      onSelectParagraph(index)
    } else {
      setInternalSelectedIndex(index)
    }
  }

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const paragraphs = useMemo(
    () => splitMarkdownIntoParagraphs(content),
    [content]
  )

  // ── Word / character count ───────────────────────────────────────
  const trimmedContent = content.trim()
  const charCount = trimmedContent.length
  // Chinese word count approximation: all characters
  const wordCount = useMemo(() => {
    if (!trimmedContent) return 0
    // Count Chinese characters + words (CJK range + Latin words)
    const cjk = (trimmedContent.match(/[一-鿿㐀-䶿]/g) || []).length
    const latin = (trimmedContent.match(/[a-zA-Z0-9]+/g) || []).length
    return cjk + latin
  }, [trimmedContent])

  // ── Paragraph selection ──────────────────────────────────────────
  const handleSelectParagraph = (index: number) => {
    selectParagraph(index)
  }

  // Reset selection when switching away from select mode
  useEffect(() => {
    if (mode !== 'select') {
      selectParagraph(null)
    }
  }, [mode])

  return (
    <div className='flex min-h-0 flex-1 flex-col gap-3 px-6 pt-6'>
      {/* ── Cover image ─────────────────────────────────────────── */}
      {coverImage && (
        <div className='shrink-0'>
          <img
            src={coverImage}
            alt={title || t('Cover preview')}
            className='w-full rounded-lg object-cover'
            style={{ maxHeight: '200px' }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        </div>
      )}

      {/* ── Title ───────────────────────────────────────────────── */}
      <div className='group relative shrink-0'>
        {editingField === 'title' ? (
          <input
            type='text'
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') {
                e.preventDefault()
                setEditingField(null)
              }
            }}
            className='w-full border-none bg-transparent px-0 text-2xl font-bold leading-tight shadow-none outline-none focus-visible:ring-0'
            placeholder={t('Article title...')}
            autoFocus
          />
        ) : (
          <h1
            className={cn(
              'cursor-text text-2xl font-bold leading-tight transition-colors',
              title ? 'text-foreground' : 'text-muted-foreground/50 italic'
            )}
            onClick={() => setEditingField('title')}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setEditingField('title')
              }
            }}
            aria-label={t('Edit title')}
          >
            {title || t('Article title...')}
          </h1>
        )}

        {/* AI Generate title button */}
        {onGenerateTitle && (
          <button
            type='button'
            className={cn(
              'absolute -right-1 top-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100',
              generatingField === 'title'
                ? 'opacity-100 text-amber-500'
                : 'text-muted-foreground hover:text-amber-500'
            )}
            onClick={(e) => {
              e.stopPropagation()
              onGenerateTitle()
            }}
            disabled={generatingField !== null}
            aria-label={t('Generate title')}
            title={t('Generate title')}
          >
            {generatingField === 'title' ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Sparkles className='size-4' />
            )}
          </button>
        )}
      </div>

      {/* ── Summary ─────────────────────────────────────────────── */}
      <div className='group relative shrink-0'>
        {editingField === 'summary' ? (
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            onBlur={() => setEditingField(null)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                e.preventDefault()
                setEditingField(null)
              }
            }}
            className='text-muted-foreground border-l-primary/40 w-full resize-none border-l-2 bg-transparent pl-4 text-sm italic outline-none focus-visible:ring-0'
            placeholder={t('Brief description of the article')}
            rows={3}
            autoFocus
          />
        ) : (
          <div
            className={cn(
              'text-muted-foreground border-l-primary/40 min-h-[1.2em] cursor-text border-l-2 pl-4 text-sm transition-colors',
              summary ? 'italic' : 'italic opacity-50'
            )}
            onClick={() => setEditingField('summary')}
            role='button'
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                setEditingField('summary')
              }
            }}
            aria-label={t('Edit summary')}
          >
            {summary || t('Brief description of the article')}
          </div>
        )}

        {/* AI Generate summary button */}
        {onGenerateSummary && (
          <button
            type='button'
            className={cn(
              'absolute -right-1 top-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100',
              generatingField === 'summary'
                ? 'opacity-100 text-amber-500'
                : 'text-muted-foreground hover:text-amber-500'
            )}
            onClick={(e) => {
              e.stopPropagation()
              onGenerateSummary()
            }}
            disabled={generatingField !== null}
            aria-label={t('Generate summary')}
            title={t('Generate summary')}
          >
            {generatingField === 'summary' ? (
              <Loader2 className='size-4 animate-spin' />
            ) : (
              <Sparkles className='size-4' />
            )}
          </button>
        )}
      </div>

      {/* ── Separator ───────────────────────────────────────────── */}
      <hr className='border-border shrink-0' />

      {/* ── Toolbar: mode tabs + stats ──────────────────────────── */}
      <div className='flex shrink-0 items-center gap-2'>
        {/* Mode toggle — three modes: Edit / Select / Preview */}
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
            variant={mode === 'select' ? 'default' : 'ghost'}
            className='h-7 gap-1.5 px-2.5 text-xs'
            onClick={() => setMode('select')}
          >
            <MousePointerClick className='size-3.5' aria-hidden='true' />
            {t('Select')}
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

        {/* Character / word count */}
        <span className='text-muted-foreground text-xs'>
          {wordCount} {t('words')} · {charCount} {t('characters')}
        </span>
      </div>

      {/* ── Tip ─────────────────────────────────────────────────── */}
      {mode !== 'preview' && trimmedContent ? (
        <p className='text-muted-foreground shrink-0 text-xs'>
          {t('Tip: double-click a paragraph to select it, then use the AI panel to modify.')}
        </p>
      ) : null}

      {/* ── Content area ────────────────────────────────────────── */}
      {mode === 'edit' ? (
        <div className='flex min-h-0 flex-1 flex-col gap-3'>
          <BlogAiEditToolbar
            textareaRef={textareaRef}
            content={content}
            setContent={setContent}
            title={title}
            summary={summary}
            articleId={articleId}
          />
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t('Write your article content here (Markdown supported)')}
            className='min-h-0 flex-1 resize-none font-mono text-sm leading-relaxed max-h-none'
          />
          <BlogAiInlineToolbar
            textareaRef={textareaRef}
            content={content}
            setContent={setContent}
            title={title}
            summary={summary}
            articleId={articleId}
          />
        </div>
      ) : mode === 'select' ? (
        <div className='min-h-0 flex-1 overflow-hidden rounded-lg border'>
          {trimmedContent ? (
            <ScrollArea className='h-full'>
              <div className='space-y-2 p-4'>
                {paragraphs.map((para, index) => {
                  const isSelected = selectedParagraphIndex === index
                  return (
                    <div
                      key={index}
                      role='button'
                      tabIndex={0}
                      className={cn(
                        'rounded-lg border px-4 py-3 text-sm leading-relaxed transition-all cursor-pointer outline-none',
                        isSelected
                          ? 'border-primary/40 bg-primary/5 shadow-sm ring-1 ring-primary/20'
                          : 'border-border/50 hover:border-accent hover:bg-accent/10 hover:shadow-sm'
                      )}
                      onClick={() => {
                        isSelected
                          ? selectParagraph(null)
                          : handleSelectParagraph(index)
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          handleSelectParagraph(index)
                        }
                      }}
                    >
                      <span className='text-muted-foreground mr-2 text-[11px] font-medium tabular-nums select-none opacity-60'>
                        {index + 1}
                      </span>
                      <Markdown>{para}</Markdown>
                    </div>
                  )
                })}
              </div>
            </ScrollArea>
          ) : (
            <div className='flex h-full items-center justify-center'>
              <p className='text-muted-foreground text-sm'>
                {t('Nothing to preview yet.')}
              </p>
            </div>
          )}
        </div>
      ) : trimmedContent ? (
        /* Preview mode */
        <ScrollArea className='min-h-0 flex-1'>
          <div className='prose dark:prose-invert prose-sm max-w-none p-1'>
            <Markdown>{trimmedContent}</Markdown>
          </div>
        </ScrollArea>
      ) : (
        <div className='border-border flex min-h-0 flex-1 items-center justify-center rounded-lg border'>
          <p className='text-muted-foreground text-sm'>
            {t('Nothing to preview yet.')}
          </p>
        </div>
      )}
    </div>
  )
}
