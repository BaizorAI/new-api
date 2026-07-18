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
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { Check, Loader2, SquareIcon, Trash2, UserPlus, Wand2 } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { StageChatMessage } from '../hooks/use-studio-stage-chat'

// ============================================================================
// Types
// ============================================================================

export interface ExtractedCharacter {
  name: string
  description?: string
  visual_prompt?: string
}

// ============================================================================
// CharacterChatBubble (inline — no separate file to avoid TDZ in build)
// ============================================================================

function extractCharacterJson(content: string): ExtractedCharacter[] | null {
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

function ChatBubble(props: {
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
      <div className={`group relative max-w-[80%] ${isUser ? 'bg-primary text-primary-foreground rounded-lg px-3 py-2 text-sm' : 'text-sm'}`}>
        {isUser ? message.content
        : message.status === 'loading' ? <span className='text-muted-foreground animate-pulse text-xs'>···</span>
        : message.status === 'error' ? <span className='text-destructive text-xs'>{t(message.content)}</span>
        : <div className='prose dark:prose-invert prose-sm'><Markdown>{message.content}</Markdown></div>}
        {onDelete ? (
          <button type='button' className='text-muted-foreground hover:text-destructive absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100' onClick={onDelete} aria-label={t('Delete')}>✕</button>
        ) : null}
      </div>
      {charBlock && onApplyCharacters ? (
        <div className='mt-1 flex items-center gap-1.5'>
          <Button size='sm' variant={applied ? 'ghost' : 'default'} className='h-7 gap-1 px-2 text-xs' disabled={applied} onClick={() => { onApplyCharacters(charBlock); setApplied(true) }}>
            <UserPlus className='size-3 text-emerald-500' />
            {applied ? t('Characters added') : t('Add {{count}} characters', { count: charBlock.length })}
          </Button>
          {onComplete ? <Button size='sm' variant={completed ? 'ghost' : 'outline'} className='h-7 gap-1 px-2 text-xs' disabled={completed} onClick={() => { onComplete(); setCompleted(true) }}>
            <Check className='size-3 text-emerald-500' />{completed ? t('Done') : t('Complete Stage')}
          </Button> : null}
        </div>
      ) : null}
      {isAnalysis && analysisPassed && onComplete ? (
        <div className='mt-1 flex items-center gap-1.5'>
          <Button size='sm' variant={completed ? 'ghost' : 'default'} className='h-7 gap-1 px-2 text-xs' disabled={completed} onClick={() => { onComplete(); setCompleted(true) }}>
            <Check className='size-3 text-emerald-500' />{completed ? t('Done') : t('Complete Stage')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

// ============================================================================
// CharacterChatPanel
// ============================================================================

interface CharacterChatPanelProps {
  messages: StageChatMessage[]
  loadingHistory: boolean
  isStreaming: boolean
  placeholder: string
  onClearMessages: () => void
  onDeleteMessage: (id: string) => void
  onSubmit: (message: PromptInputMessage) => void
  onStopGeneration: () => void
  onApplyCharacters?: (characters: ExtractedCharacter[]) => void
  onCompleteStage?: () => void
}

export function CharacterChatPanel({
  messages, loadingHistory, isStreaming, placeholder,
  onClearMessages, onDeleteMessage, onSubmit, onStopGeneration,
  onApplyCharacters, onCompleteStage,
}: CharacterChatPanelProps) {
  const { t } = useTranslation()
  return (
    <div className='border-border flex h-full flex-col border-l'>
      <div className='border-border flex items-center gap-2 border-b px-4 py-2'>
        <span className='flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400'>
          <Wand2 className='size-3' />MagicalBrush
        </span>
        <span className='text-muted-foreground text-xs'>{t('Skill active: MagicalBrush')}</span>
      </div>
      <div className='flex items-center justify-between border-b px-4 py-1.5'>
        <span className='text-muted-foreground text-[11px]'>{t('Chat History')}</span>
        <Button size='sm' variant='ghost' className='text-muted-foreground hover:text-destructive h-6 gap-1 px-1.5 text-[11px]' onClick={onClearMessages}>
          <Trash2 className='size-3' />{t('Clear all')}
        </Button>
      </div>
      <Conversation className='min-h-0 flex-1'>
        <ConversationContent className='space-y-4 p-4'>
          {loadingHistory ? (
            <ConversationEmptyState title={t('Loading...')} description='' icon={<Loader2 className='size-8 animate-spin' />} />
          ) : messages.length === 0 ? (
            <ConversationEmptyState title={t('Character Assistant')} description={t('AI will help design character details.')} icon={<Wand2 className='size-8' />} />
          ) : (
            messages.map((msg) => (
              <ChatBubble
                key={msg.id}
                message={msg}
                onApplyCharacters={onApplyCharacters}
                onComplete={onCompleteStage}
                onDelete={() => onDeleteMessage(msg.id)}
              />
            ))
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>
      <div className='border-t p-3'>
        <PromptInput onSubmit={onSubmit} className='rounded-lg border shadow-sm'>
          <PromptInputTextarea placeholder={t(placeholder)} className='min-h-[40px] resize-none text-sm' />
          <PromptInputFooter className='justify-end p-1'>
            {isStreaming ? (
              <Button type='button' size='icon' variant='ghost' className='size-7' onClick={onStopGeneration} aria-label={t('Stop')}><SquareIcon className='size-4' /></Button>
            ) : (
              <PromptInputSubmit className='size-7' />
            )}
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
