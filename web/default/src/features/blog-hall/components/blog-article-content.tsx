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
import { Loader2, Pencil, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

import { splitMarkdownIntoParagraphs } from '../lib/paragraph-utils'
import { useBlogWorkspace } from './blog-workspace-provider'

export function BlogArticleContent() {
  const { t } = useTranslation()
  const {
    content,
    setContent,
    title,
    setTitle,
    summary,
    setSummary,
    coverImage,
    editMode,
    setEditMode,
    selectedParagraphIndex,
    selectParagraph,
    generatingField,
    requestGenTitle,
    requestGenSummary,
  } = useBlogWorkspace()

  const [editingField, setEditingField] = useState<'title' | 'summary' | null>(null)

  const paragraphs = useMemo(
    () => splitMarkdownIntoParagraphs(content),
    [content]
  )

  return (
    <ScrollArea className='min-h-0 flex-1'>
      <div className='mx-auto max-w-3xl px-6 py-8'>
        {/* ── Cover image ─────────────────────────────────────────── */}
        {coverImage && (
          <img
            src={coverImage}
            alt={title || t('Cover preview')}
            className='mb-6 w-full rounded-lg object-cover'
            style={{ maxHeight: '300px' }}
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.display = 'none'
            }}
          />
        )}

        {/* ── Title ───────────────────────────────────────────────── */}
        <div className='group relative'>
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
              className='mb-4 w-full border-none bg-transparent px-0 text-3xl font-bold leading-tight shadow-none outline-none focus-visible:ring-0'
              placeholder={t('Article title...')}
              autoFocus
            />
          ) : (
            <h1
              className={cn(
                'mb-4 cursor-text text-3xl font-bold leading-tight transition-colors',
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
          <button
            type='button'
            className={cn(
              'absolute right-0 top-1 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100',
              generatingField === 'title'
                ? 'opacity-100 text-amber-500'
                : 'text-muted-foreground hover:text-amber-500'
            )}
            onClick={(e) => {
              e.stopPropagation()
              requestGenTitle()
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
        </div>

        {/* ── Summary ─────────────────────────────────────────────── */}
        <div className='group relative'>
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
              className='text-muted-foreground border-l-primary/40 mb-6 w-full resize-none border-l-2 bg-transparent pl-4 text-base italic outline-none focus-visible:ring-0'
              placeholder={t('Brief description of the article')}
              rows={3}
              autoFocus
            />
          ) : (
            <div
              className={cn(
                'text-muted-foreground border-l-primary/40 mb-6 min-h-[1.2em] cursor-text border-l-2 pl-4 text-base transition-colors',
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
          <button
            type='button'
            className={cn(
              'absolute right-0 top-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100',
              generatingField === 'summary'
                ? 'opacity-100 text-amber-500'
                : 'text-muted-foreground hover:text-amber-500'
            )}
            onClick={(e) => {
              e.stopPropagation()
              requestGenSummary()
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
        </div>

        {/* ── Divider ─────────────────────────────────────────────── */}
        <hr className='border-border mb-4' />

        {/* ── Edit / Preview toggle ───────────────────────────────── */}
        <div className='mb-4 flex items-center justify-end'>
          <button
            type='button'
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
              editMode === 'edit'
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() =>
              setEditMode(editMode === 'edit' ? 'preview' : 'edit')
            }
          >
            <Pencil className='size-3.5' />
            {editMode === 'edit' ? t('Preview') : t('Edit')}
          </button>
        </div>

        {/* ── Article content ─────────────────────────────────────── */}
        {editMode === 'edit' ? (
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className='min-h-[400px] resize-y font-mono text-sm'
            placeholder={t('Write your article content here (Markdown supported)')}
          />
        ) : paragraphs.length === 0 ? (
          <div className='py-8 text-center'>
            <p className='text-muted-foreground text-sm'>
              {t('No content yet. Use the chat bar below to start writing.')}
            </p>
          </div>
        ) : (
          <div className='space-y-1'>
            {paragraphs.map((block, index) => (
              <div
                key={index}
                className={cn(
                  '-mx-2 cursor-pointer rounded-md px-2 py-1 transition-colors',
                  selectedParagraphIndex === index
                    ? 'ring-primary bg-primary/5 ring-2'
                    : 'hover:bg-muted/50'
                )}
                onClick={() => selectParagraph(index)}
                role='button'
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    selectParagraph(index)
                  }
                }}
                aria-label={t('Select paragraph {{n}}', { n: index + 1 })}
                aria-pressed={selectedParagraphIndex === index}
              >
                <Markdown>{block}</Markdown>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  )
}
