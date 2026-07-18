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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, ImagePlus, Loader2, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { sendChatCompletion } from '@/features/playground/api'
import { getImageHistory, submitImageGeneration } from '@/features/image-playground/api'
import { IMAGE_STATUS } from '@/features/image-playground/types'
import { getOrCreatePlaygroundSessionId } from '@/features/playground/lib/storage'
import { useAuthStore } from '@/stores/auth-store'

import {
  createStudioCharacter,
  deleteStudioCharacter,
  getStudioCharacters,
  getStudioProject,
  updateStudioCharacter,
} from '../api'
import { STUDIO_QUERY_KEYS } from '../constants'
import type { StudioCharacter, StudioProject } from '../types'
import { CharacterChatPanel } from './character-chat-panel'
import type { StageChatMessage } from '../hooks/use-studio-stage-chat'
import type { ExtractedCharacter } from './chat-bubble'
import type { PromptInputMessage } from '@/components/ai-elements/prompt-input'

interface CharactersStageProps {
  projectId: number
  stageKey: string
  scriptText: string
  project?: StudioProject
  messages: StageChatMessage[]
  loadingHistory: boolean
  isStreaming: boolean
  isExtractingChars: boolean
  placeholder: string
  onClearMessages: () => void
  onDeleteMessage: (id: string) => void
  onSubmit: (message: PromptInputMessage) => void
  onStopGeneration: () => void
  onExtractCharacters: () => void
  onApplyCharacters?: (characters: ExtractedCharacter[]) => void
  onCompleteStage?: () => void
}

export function CharactersStage({
  projectId, stageKey, scriptText, project,
  messages, loadingHistory, isStreaming, isExtractingChars, placeholder,
  onClearMessages, onDeleteMessage, onSubmit, onStopGeneration,
  onExtractCharacters, onApplyCharacters, onCompleteStage,
}: CharactersStageProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [selectedCharId, setSelectedCharId] = useState<number | null>(null)
  const [charForm, setCharForm] = useState({ name: '', description: '', visual_prompt: '', reference_url: '', lora_params: '' })
  const [styleContext, setStyleContext] = useState('')
  const [charImageGenIds, setCharImageGenIds] = useState<Set<number>>(() => new Set())
  const [generatingFields, setGeneratingFields] = useState<Set<string>>(() => new Set())
  const charImagePollRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const { data: charsData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)],
    queryFn: () => getStudioCharacters(projectId),
    enabled: projectId > 0,
  })
  const characters = charsData?.data ?? []
  const selectedChar = characters.find(c => c.id === selectedCharId) ?? null

  useEffect(() => {
    const dna = project?.style_dna?.trim()
    if (dna && !styleContext) setStyleContext(dna)
  }, [project?.style_dna]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (selectedChar) setCharForm({ name: selectedChar.name || '', description: selectedChar.description || '', visual_prompt: selectedChar.visual_prompt || '', reference_url: selectedChar.reference_url || '', lora_params: selectedChar.lora_params || '' })
  }, [selectedCharId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveChar = useCallback(async () => {
    if (!selectedCharId || !charForm.name.trim()) return
    const oldName = selectedChar?.name ?? ''
    try {
      await updateStudioCharacter(projectId, selectedCharId, charForm)
      void queryClient.invalidateQueries({ queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)] })
      if (oldName !== '' && charForm.name.trim() !== oldName && scriptText.trim()) {
        toast.warning(t('Character name changed. Review script references.'))
      } else {
        toast.success(t('Character saved.'))
      }
    } catch { toast.error(t('Failed to save character.')) }
  }, [projectId, selectedCharId, charForm, selectedChar, scriptText, queryClient, t])

  const handleDeleteChar = useCallback(async () => {
    if (!selectedCharId) return
    try {
      await deleteStudioCharacter(projectId, selectedCharId)
      setSelectedCharId(null)
      void queryClient.invalidateQueries({ queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)] })
      toast.success(t('Character deleted.'))
    } catch { toast.error(t('Failed to delete character.')) }
  }, [projectId, selectedCharId, queryClient, t])

  const handleCreateChar = useCallback(async () => {
    try {
      await createStudioCharacter(projectId, { name: t('New Character'), description: '', visual_prompt: '', reference_url: '', lora_params: '' })
      void queryClient.invalidateQueries({ queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)] })
      toast.success(t('Character created.'))
    } catch { toast.error(t('Failed to create character.')) }
  }, [projectId, queryClient, t])

  // AI generate a character field
  const handleGenerateCharField = useCallback(async (char: StudioCharacter, field: 'visual_prompt' | 'reference_url' | 'lora_params') => {
    const key = `${char.id}_${field}`
    setGeneratingFields(prev => new Set(prev).add(key))
    const prompts: Record<string, string> = {
      visual_prompt: `You are a visual design AI for film production. Context: Genre: ${project?.genre ?? 'unknown'}, Style: ${project?.style_dna ?? 'not specified'}. Based on the character name and description, generate a high-quality English visual prompt for AI image generation. Include: appearance, clothing style, expression, lighting. Output ONLY the prompt, under 200 characters.`,
      reference_url: `You are a visual design AI for film production. Context: Genre: ${project?.genre ?? 'unknown'}, Style: ${project?.style_dna ?? 'not specified'}. Describe a reference keyframe image: composition, setting, color palette, mood. Output ONLY the description, under 150 characters.`,
      lora_params: `You are a visual design AI for film production. Context: Genre: ${project?.genre ?? 'unknown'}, Style: ${project?.style_dna ?? 'not specified'}. Suggest LoRA parameters for consistent AI character generation. Format: lora_name:0.8. Keep under 100 characters.`,
    }
    try {
      const result = await sendChatCompletion({
        model: 'huayu-drama-4',
        messages: [{ role: 'system', content: prompts[field] }, { role: 'user', content: `Character: ${char.name}\nDescription: ${char.description || 'None'}` }],
        stream: false, temperature: 0.4,
      }, { 'X-Baizor-Playground': 'hermes', 'X-Baizor-Hermes-Skill-Activate': '/magicalbrush' })
      const content = result?.choices?.[0]?.message?.content?.trim()
      if (content) {
        await updateStudioCharacter(projectId, char.id, { [field]: content } as Record<string, string>)
        void queryClient.invalidateQueries({ queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)] })
        setCharForm(f => ({ ...f, [field]: content }))
      }
    } catch { /* silent */ }
    finally { setGeneratingFields(prev => { const n = new Set(prev); n.delete(key); return n }) }
  }, [projectId, project?.genre, project?.style_dna, queryClient])

  const handleGenerateCharImage = useCallback(async (char: StudioCharacter) => {
    const prompt = charForm.visual_prompt?.trim() || char.visual_prompt?.trim() || char.description?.trim()
    if (!prompt) { toast.warning(t('Add a visual prompt or description first.')); return }
    if (charImageGenIds.has(char.id)) return
    const key = `${char.id}_reference_url`
    setGeneratingFields(prev => new Set(prev).add(key))
    setCharImageGenIds(prev => new Set(prev).add(char.id))
    try {
      const pending = await submitImageGeneration({ prompt: `${styleContext ? styleContext + '. ' : ''}${prompt}`, model: 'huayu-drama-4', size: '1024x1024', quality: 'standard', group: 'default' })
      let polls = 0
      const poll = async () => {
        polls++
        if (polls > 40) {
          setCharImageGenIds(p => { const n = new Set(p); n.delete(char.id); return n })
          setGeneratingFields(p => { const n = new Set(p); n.delete(key); return n })
          toast.error(t('Image generation timed out.')); return
        }
        try {
          const hist = await getImageHistory(1, 10)
          const rec = hist.items.find(h => h.id === pending.id)
          if (!rec || rec.status === IMAGE_STATUS.PENDING) { charImagePollRef.current = setTimeout(() => void poll(), 3000); return }
          setCharImageGenIds(p => { const n = new Set(p); n.delete(char.id); return n })
          setGeneratingFields(p => { const n = new Set(p); n.delete(key); return n })
          if (rec.status === IMAGE_STATUS.COMPLETED && rec.image_url) {
            await updateStudioCharacter(projectId, char.id, { reference_url: rec.image_url } as Record<string, string>)
            void queryClient.invalidateQueries({ queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)] })
            setCharForm(f => ({ ...f, reference_url: rec.image_url! }))
            toast.success(t('Reference image generated.'))
          } else { toast.error(rec.error_message || t('Image generation failed.')) }
        } catch { /* retry */ charImagePollRef.current = setTimeout(() => void poll(), 3000) }
      }
      charImagePollRef.current = setTimeout(() => void poll(), 3000)
    } catch {
      setCharImageGenIds(p => { const n = new Set(p); n.delete(char.id); return n })
      setGeneratingFields(p => { const n = new Set(p); n.delete(key); return n })
      toast.error(t('Image generation failed.'))
    }
  }, [projectId, charForm.visual_prompt, styleContext, queryClient, t])

  return (
    <div className='flex min-h-0 flex-1'>
      {/* Left sidebar — character list */}
      <div className='border-border w-[260px] shrink-0 space-y-1 overflow-auto border-r p-4'>
        <div className='flex items-center justify-between'>
          <h2 className='text-sm font-medium'>{t('Characters')} ({characters.length})</h2>
        </div>
        <div className='flex flex-wrap items-center gap-2 pb-2'>
          <Button size='sm' variant='outline' disabled={!scriptText.trim() || isExtractingChars} onClick={onExtractCharacters}>
            {isExtractingChars ? <Loader2 className='mr-1.5 size-3.5 animate-spin' /> : <Wand2 className='mr-1.5 size-3.5 text-purple-500' />}
            {isExtractingChars ? t('Extracting...') : t('AI Extract')}
          </Button>
          <Button size='sm' variant='outline' onClick={handleCreateChar}><Plus className='mr-1.5 size-3.5' />{t('Add Character')}</Button>
        </div>
        <div className='pb-2'>
          <Input value={styleContext} onChange={e => setStyleContext(e.target.value)} placeholder={t('Image style context')} className='h-7 text-[11px]' />
        </div>
        {characters.length > 0 ? characters.map(char => (
          <div key={char.id} className={`border-border bg-card text-card-foreground rounded-lg border p-3 ${selectedCharId === char.id ? 'ring-ring ring-2' : ''}`}>
            <button type='button' onClick={() => setSelectedCharId(char.id)} className='hover:bg-muted/60 flex w-full items-center gap-3 text-left text-sm transition-colors rounded-md -m-1 p-1'>
              {char.reference_url ? <img src={char.reference_url} alt={char.name} className='bg-muted size-10 shrink-0 rounded-md object-cover' loading='lazy' /> : <span className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md text-lg font-medium'>{char.name.charAt(0)}</span>}
              <span className='min-w-0'><span className='block truncate font-medium'>{char.name}</span>{char.description ? <span className='text-muted-foreground block truncate text-[11px]'>{char.description}</span> : null}</span>
            </button>
            {selectedCharId === char.id ? (
              <div className='mt-2 flex items-center gap-1 border-t pt-2'>
                <Button size='sm' className='h-6 flex-1 gap-1 text-[11px]' onClick={handleSaveChar}><Check className='size-3' />{t('Save')}</Button>
                <Button size='sm' variant='outline' className='text-destructive h-6 gap-1 text-[11px]' onClick={handleDeleteChar}><Trash2 className='size-3' />{t('Delete')}</Button>
              </div>
            ) : null}
          </div>
        )) : <p className='text-muted-foreground px-1 text-xs'>{t('No characters found in the script.')}</p>}
      </div>

      {/* Center: detail editing */}
      <div className='min-w-0 flex-1 overflow-auto p-6'>
        {selectedChar ? (
          <div className='mx-auto max-w-xl space-y-5'>
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <Label className='text-xs font-medium'>{t('Reference Image')}</Label>
                <div className='flex items-center gap-2'>
                  <Input value={charForm.reference_url} onChange={e => setCharForm(f => ({ ...f, reference_url: e.target.value }))} placeholder='https://...' className='h-7 w-48 text-xs' />
                  <Button size='sm' className='h-7 gap-1 text-xs' disabled={charImageGenIds.has(selectedChar.id)} onClick={() => void handleGenerateCharImage(selectedChar)}>
                    {charImageGenIds.has(selectedChar.id) ? <Loader2 className='size-3 animate-spin' /> : <ImagePlus className='size-3' />}
                    {charImageGenIds.has(selectedChar.id) ? t('Generating...') : t('Generate')}
                  </Button>
                </div>
              </div>
              <div className='bg-muted border-border flex aspect-square items-center justify-center overflow-hidden rounded-lg border'>
                {charForm.reference_url || selectedChar.reference_url ? <img src={charForm.reference_url || selectedChar.reference_url} alt={selectedChar.name} className='size-full object-contain' /> : <div className='flex flex-col items-center gap-3 text-center'><ImagePlus className='text-muted-foreground size-10' /><p className='text-muted-foreground text-xs'>{t('Upload a reference image or generate one')}</p></div>}
              </div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div><Label htmlFor='char-name' className='text-xs font-medium'>{t('Character Name')}</Label><Input id='char-name' value={charForm.name} onChange={e => setCharForm(f => ({ ...f, name: e.target.value }))} className='mt-1' /></div>
              <div><Label htmlFor='char-desc' className='text-xs font-medium'>{t('Description')}</Label><Textarea id='char-desc' value={charForm.description} onChange={e => setCharForm(f => ({ ...f, description: e.target.value }))} placeholder={t('Describe the character...')} className='mt-1 h-[68px] resize-y text-sm' /></div>
            </div>
            <div className='grid grid-cols-2 gap-4'>
              <div>
                <div className='flex items-center justify-between'><Label className='text-xs font-medium'>{t('Visual Prompt')}</Label>
                  <Button size='sm' variant='ghost' className='h-6 gap-1 text-[11px]' disabled={generatingFields.has(`${selectedChar.id}_visual_prompt`)} onClick={() => handleGenerateCharField(selectedChar, 'visual_prompt')}>
                    {generatingFields.has(`${selectedChar.id}_visual_prompt`) ? <Loader2 className='size-3 animate-spin' /> : <Sparkles className='size-3' />}
                    {generatingFields.has(`${selectedChar.id}_visual_prompt`) ? t('Generating...') : t('AI generate')}
                  </Button>
                </div>
                <Textarea value={charForm.visual_prompt} onChange={e => setCharForm(f => ({ ...f, visual_prompt: e.target.value }))} className='mt-1 h-20 resize-y text-xs' />
              </div>
              <div>
                <div className='flex items-center justify-between'><Label className='text-xs font-medium'>{t('LoRA Parameters')}</Label>
                  <Button size='sm' variant='ghost' className='h-6 gap-1 text-[11px]' disabled={generatingFields.has(`${selectedChar.id}_lora_params`)} onClick={() => handleGenerateCharField(selectedChar, 'lora_params')}>
                    {generatingFields.has(`${selectedChar.id}_lora_params`) ? <Loader2 className='size-3 animate-spin' /> : <Sparkles className='size-3' />}
                    {generatingFields.has(`${selectedChar.id}_lora_params`) ? t('Generating...') : t('AI generate')}
                  </Button>
                </div>
                <Input value={charForm.lora_params} onChange={e => setCharForm(f => ({ ...f, lora_params: e.target.value }))} placeholder={t('e.g. lora_name:0.8')} className='mt-1 text-xs' />
              </div>
            </div>
          </div>
        ) : (
          <div className='flex h-full items-center justify-center'><p className='text-muted-foreground text-sm'>{characters.length > 0 ? t('Select a character to view details.') : t('No characters yet.')}</p></div>
        )}
      </div>

      {/* Right: chat panel */}
      <div className='w-[340px] shrink-0'>
        <CharacterChatPanel messages={messages} loadingHistory={loadingHistory} isStreaming={isStreaming} placeholder={placeholder} onClearMessages={onClearMessages} onDeleteMessage={onDeleteMessage} onSubmit={onSubmit} onStopGeneration={onStopGeneration} onApplyCharacters={onApplyCharacters} onCompleteStage={onCompleteStage} />
      </div>
    </div>
  )
}
