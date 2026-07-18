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
import { Check, RefreshCw, UserPlus, X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'

import type { StageChatMessage } from '../hooks/use-studio-stage-chat'

// ============================================================================
// Script block extraction
// ============================================================================

export function extractScriptBlock(content: string): string | null {
  const paraMatch = content.match(/```revised-paragraph\s*\n([\s\S]*?)```/)
  if (paraMatch?.[1]?.trimEnd()) return paraMatch[1].trimEnd()
  const scriptMatch = content.match(/```script\s*\n([\s\S]*?)```/)
  return scriptMatch?.[1]?.trimEnd() ?? null
}

// ============================================================================
// Character block extraction
// ============================================================================

export interface ExtractedCharacter {
  name: string
  description?: string
  visual_prompt?: string
}

/** Extract character JSON from AI analysis response. */
export function extractCharacterJson(content: string): ExtractedCharacter[] | null {
  const jsonMatch = content.match(/\[[\s\S]*?\{[\s\S]*?"name"[\s\S]*?\}[\s\S]*?\]/)
  if (!jsonMatch) return null
  try {
    const parsed = JSON.parse(jsonMatch[0])
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    return parsed
      .filter((c: Record<string, unknown>) => typeof c.name === 'string' && c.name.trim())
      .map((c: Record<string, unknown>) => ({
        name: String(c.name).trim(),
        description: typeof c.description === 'string' ? c.description.trim() : '',
        visual_prompt: typeof c.visual_prompt === 'string' ? c.visual_prompt.trim() : '',
      }))
  } catch {
    return null
  }
}

export function isAnalysisMessage(content: string): boolean {
  if (extractScriptBlock(content)) return false
  return /✅|⚠️/.test(content)
}

// ============================================================================
// ScriptChatBubble — shared chat bubble with Apply/Rewrite/Complete actions
// ============================================================================

export function ScriptChatBubble(props: {
  message: StageChatMessage
  onApply?: (content: string) => void
  onRewrite?: (analysisContent: string) => void
  onComplete?: () => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const { message, onApply, onRewrite, onComplete, onDelete } = props
  const isUser = message.role === 'user'
  const [applied, setApplied] = useState(false)
  const [completed, setCompleted] = useState(false)

  const isComplete = !isUser && message.status === 'complete'
  const scriptBlock = isComplete ? extractScriptBlock(message.content) : null
  const isAnalysis = isComplete && isAnalysisMessage(message.content)
  const analysisPassed = isAnalysis && message.content.includes('✅')

  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div
        className={`group relative max-w-[80%] ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm'
            : 'text-sm'
        }`}
      >
        {isUser ? (
          message.content
        ) : message.status === 'loading' ? (
          <span className='text-muted-foreground animate-pulse text-xs'>···</span>
        ) : message.status === 'error' ? (
          <span className='text-destructive text-xs'>{t(message.content)}</span>
        ) : (
          <div className='prose dark:prose-invert prose-sm'>
            <Markdown>{message.content}</Markdown>
          </div>
        )}
        {onDelete ? (
          <button
            type='button'
            className='text-muted-foreground hover:text-destructive absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100'
            onClick={onDelete}
            aria-label={t('Delete')}
          >
            <X className='size-3 text-red-400' />
          </button>
        ) : null}
      </div>
      {scriptBlock && onApply && !isAnalysis ? (
        <div className='mt-1 flex items-center gap-1.5'>
          <Button size='sm' variant={applied ? 'ghost' : 'outline'} className='h-7 gap-1 px-2 text-xs' disabled={applied}
            onClick={() => { onApply(scriptBlock); setApplied(true) }}>
            <Check className='size-3 text-emerald-500' />
            {applied ? t('Applied') : t('Apply to Script')}
          </Button>
          {onComplete ? (
            <Button size='sm' variant={completed ? 'ghost' : 'default'} className='h-7 gap-1 px-2 text-xs' disabled={completed}
              onClick={() => { onComplete(); setCompleted(true) }}>
              <Check className='size-3 text-emerald-500' />
              {completed ? t('Done') : t('Complete Stage')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {isAnalysis && onRewrite ? (
        <div className='mt-1 flex items-center gap-1.5'>
          <Button size='sm' variant={applied ? 'ghost' : 'outline'} className='h-7 gap-1 px-2 text-xs' disabled={applied}
            onClick={() => { onRewrite(message.content); setApplied(true) }}>
            <RefreshCw className='size-3 text-amber-500' />
            {applied ? t('Rewriting...') : t('Rewrite with Suggestions')}
          </Button>
          {analysisPassed && onComplete ? (
            <Button size='sm' variant={completed ? 'ghost' : 'default'} className='h-7 gap-1 px-2 text-xs' disabled={completed}
              onClick={() => { onComplete(); setCompleted(true) }}>
              <Check className='size-3 text-emerald-500' />
              {completed ? t('Done') : t('Complete Stage')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

// ============================================================================
// CharacterChatBubble — for character stage with Apply/Complete actions
// ============================================================================

export function CharacterChatBubble(props: {
  message: StageChatMessage
  onApplyCharacters?: (characters: ExtractedCharacter[]) => void
  onComplete?: () => void
  onDelete?: () => void
}) {
  const { t } = useTranslation()
  const { message, onApplyCharacters, onComplete, onDelete } = props
  const isUser = message.role === 'user'
  const [applied, setApplied] = useState(false)
  const [completed, setCompleted] = useState(false)

  const isComplete = !isUser && message.status === 'complete'
  const charBlock = isComplete ? extractCharacterJson(message.content) : null
  const isAnalysis = isComplete && /✅|⚠️/.test(message.content) && !charBlock
  const analysisPassed = isAnalysis && message.content.includes('✅')

  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div
        className={`group relative max-w-[80%] ${
          isUser
            ? 'bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm'
            : 'text-sm'
        }`}
      >
        {isUser ? (
          message.content
        ) : message.status === 'loading' ? (
          <span className='text-muted-foreground animate-pulse text-xs'>···</span>
        ) : message.status === 'error' ? (
          <span className='text-destructive text-xs'>{t(message.content)}</span>
        ) : (
          <div className='prose dark:prose-invert prose-sm'>
            <Markdown>{message.content}</Markdown>
          </div>
        )}
        {onDelete ? (
          <button
            type='button'
            className='text-muted-foreground hover:text-destructive absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100'
            onClick={onDelete}
            aria-label={t('Delete')}
          >
            <X className='size-3 text-red-400' />
          </button>
        ) : null}
      </div>
      {charBlock && onApplyCharacters ? (
        <div className='mt-1 flex items-center gap-1.5'>
          <Button size='sm' variant={applied ? 'ghost' : 'default'} className='h-7 gap-1 px-2 text-xs' disabled={applied}
            onClick={() => { onApplyCharacters(charBlock); setApplied(true) }}>
            <UserPlus className='size-3 text-emerald-500' />
            {applied ? t('Characters added') : t('Add {{count}} characters', { count: charBlock.length })}
          </Button>
          {onComplete ? (
            <Button size='sm' variant={completed ? 'ghost' : 'outline'} className='h-7 gap-1 px-2 text-xs' disabled={completed}
              onClick={() => { onComplete(); setCompleted(true) }}>
              <Check className='size-3 text-emerald-500' />
              {completed ? t('Done') : t('Complete Stage')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {isAnalysis ? (
        <div className='mt-1 flex items-center gap-1.5'>
          {analysisPassed && onComplete ? (
            <Button size='sm' variant={completed ? 'ghost' : 'default'} className='h-7 gap-1 px-2 text-xs' disabled={completed}
              onClick={() => { onComplete(); setCompleted(true) }}>
              <Check className='size-3 text-emerald-500' />
              {completed ? t('Done') : t('Complete Stage')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
