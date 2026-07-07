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
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'

import { splitMarkdownIntoParagraphs } from '../lib/paragraph-utils'
import { useBlogWorkspace } from './blog-workspace-provider'

export function BlogArticleContent() {
  const { t } = useTranslation()
  const { content, selectedParagraphIndex, selectParagraph } = useBlogWorkspace()

  const paragraphs = useMemo(
    () => splitMarkdownIntoParagraphs(content),
    [content]
  )

  if (!content.trim()) {
    return (
      <div className='flex h-full items-center justify-center'>
        <p className='text-muted-foreground text-sm italic'>
          {t('No content yet. Use the chat bar below to start writing.')}
        </p>
      </div>
    )
  }

  return (
    <div className='mx-auto max-w-3xl space-y-1 px-8 py-6'>
      {paragraphs.map((block, index) => (
        <div
          key={index}
          className={cn(
            '-mx-3 cursor-pointer rounded-md px-3 py-1 transition-colors',
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
  )
}
