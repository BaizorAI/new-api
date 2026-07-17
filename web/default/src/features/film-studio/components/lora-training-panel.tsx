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

For commercial licensing, please contact support@quantumnous.com.
*/
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  FlaskConical,
  Loader2,
  Plus,
  Save,
  Upload,
  Wand2,
  X,
} from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Slider } from '@/components/ui/slider'
import { cn } from '@/lib/utils'

/** A LoRA training run. */
type LoraTrainingState = 'idle' | 'uploading' | 'training' | 'completed' | 'failed'

type LoraTrainingPanelProps = {
  className?: string
}

/**
 * LoRA fine-tuning panel for Film Studio.
 *
 * Enterprise users can upload character reference images and fine-tune
 * a LoRA model that ensures visual consistency across all generated
 * shots and scenes.
 */
export function LoraTrainingPanel({ className }: LoraTrainingPanelProps) {
  const { t } = useTranslation()
  const [images, setImages] = useState<string[]>([])
  const [trainingState, setTrainingState] = useState<LoraTrainingState>('idle')
  const [trainingProgress, setTrainingProgress] = useState(0)
  const [trainingSteps, setTrainingSteps] = useState(2000)
  const [modelName, setModelName] = useState('')

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const readers: Promise<string>[] = []
    for (const file of files) {
      readers.push(
        new Promise((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.readAsDataURL(file)
        })
      )
    }
    Promise.all(readers).then((urls) => {
      setImages((prev) => [...prev, ...urls].slice(0, 20))
    })
    e.target.value = ''
  }, [])

  const handleStartTraining = useCallback(() => {
    if (images.length === 0 || !modelName.trim()) return
    setTrainingState('training')
    setTrainingProgress(0)

    // Simulate training progress
    const interval = setInterval(() => {
      setTrainingProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval)
          setTrainingState('completed')
          return 100
        }
        return prev + Math.random() * 8
      })
    }, 600)
  }, [images.length, modelName])

  const handleSaveModel = useCallback(() => {
    setTrainingState('idle')
    setTrainingProgress(0)
    setImages([])
    setModelName('')
  }, [])

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className='flex items-center justify-between border-b px-3 py-2.5'>
        <div className='flex items-center gap-2'>
          <Brain className='size-3.5 text-violet-500' aria-hidden='true' />
          <span className='text-xs font-semibold'>{t('LoRA Fine-tuning')}</span>
        </div>
        {trainingState === 'completed' ? (
          <span className='rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-500'>
            {t('Ready')}
          </span>
        ) : trainingState === 'training' ? (
          <span className='rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary'>
            {t('Training...')}
          </span>
        ) : null}
      </div>

      <ScrollArea className='flex-1'>
        <div className='space-y-4 p-3'>
          {/* Model name */}
          <div>
            <label className='text-[11px] font-medium'>
              {t('Model Name')}
            </label>
            <input
              type='text'
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder={t('e.g. hero-character-v2')}
              className='mt-1 h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring'
              disabled={trainingState === 'training'}
            />
          </div>

          {/* Training steps slider */}
          <div>
            <div className='flex items-center justify-between'>
              <label className='text-[11px] font-medium'>
                {t('Training Steps')}
              </label>
              <span className='text-[11px] tabular-nums text-muted-foreground'>
                {trainingSteps.toLocaleString()}
              </span>
            </div>
            <Slider
              value={[trainingSteps]}
              onValueChange={([v]) => setTrainingSteps(v!)}
              min={500}
              max={5000}
              step={100}
              className='mt-1'
              disabled={trainingState === 'training'}
            />
            <div className='mt-0.5 flex justify-between text-[10px] text-muted-foreground'>
              <span>500</span>
              <span>5,000</span>
            </div>
          </div>

          {/* Image upload */}
          <div>
            <div className='flex items-center justify-between'>
              <label className='text-[11px] font-medium'>
                {t('Reference Images')}
              </label>
              <span className='text-[10px] text-muted-foreground'>
                {images.length}/20
              </span>
            </div>
            <p className='text-[10px] text-muted-foreground'>
              {t('Upload 5-20 images of the same character from different angles and expressions.')}
            </p>

            <div className='mt-2 grid grid-cols-4 gap-2'>
              {images.map((url, i) => (
                <div key={i} className='group relative aspect-square overflow-hidden rounded-lg border'>
                  <img
                    src={url}
                    alt={`Reference ${i + 1}`}
                    className='size-full object-cover'
                  />
                  <Button
                    variant='ghost'
                    size='icon'
                    className='absolute right-0.5 top-0.5 size-5 rounded-full bg-black/40 opacity-0 hover:bg-black/60 group-hover:opacity-100'
                    onClick={() =>
                      setImages((prev) => prev.filter((_, j) => j !== i))
                    }
                    disabled={trainingState === 'training'}
                  >
                    <X className='size-3 text-white' />
                  </Button>
                </div>
              ))}
              {images.length < 20 && trainingState !== 'training' ? (
                <label className='flex aspect-square cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-border bg-muted/50 transition-colors hover:border-primary/40 hover:bg-accent'>
                  <Plus className='size-5 text-muted-foreground' />
                  <input
                    type='file'
                    accept='image/*'
                    multiple
                    className='hidden'
                    onChange={handleFile}
                  />
                </label>
              ) : null}
            </div>
          </div>

          {/* Training progress */}
          {trainingState === 'training' || trainingState === 'completed' ? (
            <div className='space-y-2 rounded-lg border bg-muted/30 p-3'>
              <div className='flex items-center justify-between'>
                <span className='text-[11px] font-medium'>
                  {trainingState === 'completed'
                    ? t('Training complete')
                    : t('Training in progress...')}
                </span>
                <span className='text-[11px] tabular-nums text-muted-foreground'>
                  {Math.round(trainingProgress)}%
                </span>
              </div>
              <Progress
                value={trainingProgress}
                className={
                  trainingState === 'completed' ? 'text-emerald-500' : ''
                }
              />
              {trainingState === 'training' ? (
                <div className='flex items-center gap-2 text-[10px] text-muted-foreground'>
                  <Loader2 className='size-3 animate-spin' />
                  <span>
                    {t('Step {{current}} / {{total}}', {
                      current: Math.round((trainingProgress / 100) * trainingSteps),
                      total: trainingSteps,
                    })}
                  </span>
                </div>
              ) : null}
              {trainingState === 'completed' ? (
                <div className='flex items-center gap-2 text-[10px] text-emerald-500'>
                  <CheckCircle2 className='size-3' />
                  <span>{t('Model ready for use')}</span>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Error state */}
          {trainingState === 'failed' ? (
            <div className='flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-[11px] text-destructive'>
              <AlertCircle className='size-3.5 shrink-0' />
              <span>{t('Training failed. Check your images and try again.')}</span>
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* Action buttons */}
      <div className='border-t p-3'>
        {trainingState === 'idle' ? (
          <Button
            size='sm'
            className='h-7 w-full text-xs'
            onClick={handleStartTraining}
            disabled={images.length < 5 || !modelName.trim()}
          >
            <Wand2 className='mr-1 size-3.5' />
            {t('Start Training')}
          </Button>
        ) : trainingState === 'completed' ? (
          <Button
            size='sm'
            variant='secondary'
            className='h-7 w-full text-xs'
            onClick={handleSaveModel}
          >
            <Save className='mr-1 size-3.5' />
            {t('Save Model')}
          </Button>
        ) : trainingState === 'training' ? (
          <Button
            size='sm'
            variant='outline'
            className='h-7 w-full text-xs'
            disabled
          >
            <Loader2 className='mr-1 size-3.5 animate-spin' />
            {t('Training...')}
          </Button>
        ) : null}

        {images.length < 5 && trainingState === 'idle' ? (
          <p className='mt-1.5 text-center text-[10px] text-muted-foreground'>
            {t('Upload at least 5 reference images to start.')}
          </p>
        ) : null}
      </div>
    </div>
  )
}
