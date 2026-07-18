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
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeftRight,
  Download,
  Loader2,
  RefreshCw,
  Sparkles,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import {
  getStudioCharacters,
  getStudioProjects,
} from '@/features/film-studio/api'
import type { StudioCharacter } from '@/features/film-studio/types'
import {
  submitImageGeneration,
  getImageHistory,
} from '@/features/image-playground/api'
import { IMAGE_STATUS } from '@/features/image-playground/types'

const SWAP_MODEL = 'huayu-drama-s2-replace'
const POLL_INTERVAL = 3000
const MAX_POLLS = 90

type SwapStatus = 'pending' | 'completed' | 'failed'

interface SwapHistoryEntry {
  id: number
  charName: string
  charImage: string | null
  refPreview: string | null
  prompt: string
  status: SwapStatus
  resultUrl: string | null
  error?: string
  recordId?: number
}

export function SwapLab() {
  const { t } = useTranslation()
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null)
  const [refImage, setRefImage] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [history, setHistory] = useState<SwapHistoryEntry[]>([])
  const pollRef = useRef<Record<number, ReturnType<typeof setTimeout>>>({})

  const { data: projectsData } = useQuery({
    queryKey: ['swap-lab', 'projects'],
    queryFn: () => getStudioProjects({ p: 1, page_size: 5 }),
    staleTime: 60_000,
  })

  const projectIds = projectsData?.data?.items?.map(p => p.id) ?? []

  const { data: allChars } = useQuery({
    queryKey: ['swap-lab', 'characters', projectIds],
    queryFn: async () => {
      const results: StudioCharacter[] = []
      for (const pid of projectIds) {
        try {
          const res = await getStudioCharacters(pid)
          const items = (res as any)?.data as StudioCharacter[] | undefined
          if (items) results.push(...items)
        } catch { /* skip */ }
      }
      return results
    },
    enabled: projectIds.length > 0,
    staleTime: 60_000,
  })

  const characters = allChars ?? []
  const selectedChar = characters.find(c => c.id === selectedCharId) ?? null

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setRefImage(reader.result as string)
    reader.readAsDataURL(file)
    e.target.value = ''
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!selectedChar) { toast.warning(t('Select a character first.')); return }
    if (!prompt.trim()) { toast.warning(t('Describe what to change.')); return }

    setIsGenerating(true)
    const entry: SwapHistoryEntry = {
      id: Date.now(),
      charName: selectedChar.name,
      charImage: selectedChar.reference_url || null,
      refPreview: refImage,
      prompt: `${prompt.trim()} — apply to reference image, preserve character identity`,
      status: 'pending',
      resultUrl: null,
    }

    setHistory(prev => [entry, ...prev])

    try {
      const pending = await submitImageGeneration({
        prompt: entry.prompt,
        model: SWAP_MODEL,
        size: '1024x1024',
        quality: 'standard',
        group: 'default',
      })

      setHistory(prev => prev.map((h, i) =>
        i === 0 ? { ...h, recordId: pending.id } : h
      ))

      let polls = 0
      const poll = async () => {
        polls++
        if (polls > MAX_POLLS) {
          setHistory(prev => prev.map((h, i) =>
            i === 0 ? { ...h, status: 'failed' as SwapStatus, error: t('Timed out') } : h
          ))
          setIsGenerating(false)
          return
        }

        try {
          const hist = await getImageHistory(1, 10)
          const record = hist.items.find(r => r.id === pending.id)

          if (!record || record.status === IMAGE_STATUS.PENDING) {
            pollRef.current[entry.id] = setTimeout(() => void poll(), POLL_INTERVAL)
            return
          }

          if (record.status === IMAGE_STATUS.COMPLETED && record.image_url) {
            setHistory(prev => prev.map(h =>
              h.id === entry.id ? { ...h, status: 'completed' as SwapStatus, resultUrl: record.image_url! } : h
            ))
          } else {
            setHistory(prev => prev.map(h =>
              h.id === entry.id ? { ...h, status: 'failed' as SwapStatus, error: record.error_message || t('Generation failed') } : h
            ))
          }
          setIsGenerating(false)
        } catch {
          pollRef.current[entry.id] = setTimeout(() => void poll(), POLL_INTERVAL)
        }
      }

      pollRef.current[entry.id] = setTimeout(() => void poll(), POLL_INTERVAL)
    } catch {
      setHistory(prev => prev.map(h =>
        h.id === entry.id ? { ...h, status: 'failed' as SwapStatus } : h
      ))
      setIsGenerating(false)
    }
  }, [selectedChar, refImage, prompt, t])

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-border flex items-center justify-between border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <ArrowLeftRight className='text-violet-500 size-5' aria-hidden='true' />
          <h1 className='text-lg font-semibold'>{t('Swap Lab')}</h1>
        </div>
        {history.length > 0 ? (
          <Button variant='ghost' size='sm' className='h-7 text-xs'
            onClick={() => { setHistory([]); for (const t of Object.values(pollRef.current)) clearTimeout(t) }}>
            <Trash2 className='mr-1 size-3.5' />{t('Clear all')}
          </Button>
        ) : null}
      </div>

      <div className='flex min-h-0 flex-1 overflow-hidden'>
        {/* Left: controls */}
        <div className='border-border flex w-[340px] shrink-0 flex-col border-r'>
          <ScrollArea className='min-h-0 flex-1'>
            <div className='space-y-5 p-4'>
              {/* Source character */}
              <div>
                <h3 className='mb-2 text-xs font-semibold'>{t('Source Character')}</h3>
                {characters.length === 0 ? (
                  <p className='text-muted-foreground py-4 text-center text-xs'>
                    {t('No characters found. Create characters in Studio projects first.')}
                  </p>
                ) : (
                  <div className='space-y-1.5'>
                    {characters.map(char => (
                      <button
                        key={char.id}
                        type='button'
                        onClick={() => setSelectedCharId(char.id)}
                        className={cn(
                          'flex w-full items-center gap-3 rounded-lg border p-2 text-left transition-colors hover:bg-accent/50',
                          selectedCharId === char.id ? 'border-primary ring-1 ring-primary' : 'border-border',
                        )}
                      >
                        {char.reference_url ? (
                          <img src={char.reference_url} alt='' className='bg-muted size-10 shrink-0 rounded object-cover' />
                        ) : (
                          <span className='bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded text-lg font-medium'>
                            {char.name.charAt(0)}
                          </span>
                        )}
                        <div className='min-w-0'>
                          <p className='truncate text-sm font-medium'>{char.name}</p>
                          {char.description ? (
                            <p className='text-muted-foreground truncate text-[10px]'>{char.description}</p>
                          ) : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Reference style */}
              <div>
                <h3 className='mb-2 text-xs font-semibold'>{t('Reference Style')}</h3>
                {refImage ? (
                  <div className='relative inline-block'>
                    <img src={refImage} alt='' className='border-border h-32 w-32 rounded-lg border object-cover' />
                    <Button variant='ghost' size='icon' className='absolute -right-2 -top-2 size-6 rounded-full bg-background shadow'
                      onClick={() => setRefImage(null)}>
                      <X className='size-3' />
                    </Button>
                  </div>
                ) : (
                  <label className='border-border bg-muted/50 hover:bg-accent flex h-32 w-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors'>
                    <Upload className='text-muted-foreground size-6' />
                    <span className='text-muted-foreground text-[10px]'>{t('Upload')}</span>
                    <input type='file' accept='image/*' className='hidden' onChange={handleFile} />
                  </label>
                )}
              </div>

              {/* Prompt */}
              <div>
                <h3 className='mb-2 text-xs font-semibold'>{t('Describe the change')}</h3>
                <textarea
                  value={prompt}
                  onChange={e => setPrompt(e.target.value)}
                  placeholder={t('e.g. Change to ancient Chinese hanfu costume, classic hairstyle...')}
                  rows={4}
                  className='w-full resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
                  disabled={isGenerating}
                />
              </div>

              <Button className='w-full' disabled={isGenerating || !selectedChar || !prompt.trim()} onClick={() => void handleGenerate()}>
                {isGenerating ? <Loader2 className='mr-2 size-4 animate-spin' /> : <Sparkles className='mr-2 size-4' />}
                {isGenerating ? t('Generating...') : t('Generate Swap')}
              </Button>
            </div>
          </ScrollArea>
        </div>

        {/* Right: results */}
        <div className='flex min-w-0 flex-1 flex-col'>
          <div className='border-border flex items-center border-b px-4 py-2.5'>
            <h3 className='text-xs font-semibold'>{t('Results')}</h3>
          </div>
          <ScrollArea className='min-h-0 flex-1'>
            {history.length === 0 ? (
              <div className='flex flex-col items-center justify-center py-16 gap-3'>
                <ArrowLeftRight className='text-muted-foreground/30 size-12' />
                <p className='text-muted-foreground text-sm'>{t('Generated results will appear here.')}</p>
              </div>
            ) : (
              <div className='grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3'>
                {history.map(entry => (
                  <div key={entry.id} className='border-border bg-card overflow-hidden rounded-lg border'>
                    {/* Before-after */}
                    <div className='grid grid-cols-2 gap-px bg-muted'>
                      <div className='bg-card flex aspect-square items-center justify-center p-2'>
                        {entry.charImage ? (
                          <img src={entry.charImage} alt='' className='max-h-full max-w-full rounded object-contain' />
                        ) : (
                          <span className='text-muted-foreground text-[10px]'>{entry.charName}</span>
                        )}
                      </div>
                      <div className='bg-card flex aspect-square items-center justify-center p-2'>
                        {entry.status === 'completed' && entry.resultUrl ? (
                          <img src={entry.resultUrl} alt='' className='max-h-full max-w-full rounded object-contain' />
                        ) : entry.status === 'pending' ? (
                          <Loader2 className='text-muted-foreground size-6 animate-spin' />
                        ) : (
                          <RefreshCw className='text-muted-foreground size-6' />
                        )}
                      </div>
                    </div>
                    {/* Info */}
                    <div className='p-2.5 space-y-1'>
                      <p className='truncate text-[11px] font-medium'>{entry.charName}</p>
                      <p className='text-muted-foreground line-clamp-2 text-[10px]'>{entry.prompt}</p>
                      <div className='flex items-center justify-between'>
                        <span className={cn(
                          'text-[9px] font-medium',
                          entry.status === 'completed' ? 'text-emerald-500' : entry.status === 'failed' ? 'text-destructive' : 'text-amber-500'
                        )}>
                          {entry.status === 'completed' ? t('Done') : entry.status === 'failed' ? t('Failed') : t('Generating...')}
                        </span>
                        {entry.status === 'completed' && entry.resultUrl ? (
                          <a href={entry.resultUrl} download target='_blank' rel='noreferrer' className='text-muted-foreground hover:text-foreground'>
                            <Download className='size-3.5' />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
