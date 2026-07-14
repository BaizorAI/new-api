import { useQuery } from '@tanstack/react-query'
import { ImageIcon, Loader2, Download, AlertCircle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import {
  getUserImageModels,
  getUserGroups,
  generateImage,
  type ImageModelOption,
  type ImageGenerationResponse,
} from './api'

const SIZE_OPTIONS = ['1024x1024', '1024x1792', '1792x1024'] as const
const QUALITY_OPTIONS = ['standard', 'hd'] as const

interface ImagePlaygroundProps {
  defaultModel?: string
}

interface GeneratedImage {
  url?: string
  b64_json?: string
  revised_prompt?: string
  model: string
  prompt: string
  size: string
  quality: string
  timestamp: number
}

export function ImagePlayground({
  defaultModel = 'huayu-drama-4',
}: ImagePlaygroundProps) {
  const { t } = useTranslation()

  const [model, setModel] = useState(defaultModel)
  const [group, setGroup] = useState('default')
  const [prompt, setPrompt] = useState('')
  const [size, setSize] = useState<string>(SIZE_OPTIONS[0])
  const [quality, setQuality] = useState<string>(QUALITY_OPTIONS[0])
  const [isGenerating, setIsGenerating] = useState(false)
  const [images, setImages] = useState<GeneratedImage[]>([])
  const [error, setError] = useState<string | null>(null)

  const { data: models = [] } = useQuery<ImageModelOption[]>({
    queryKey: ['image-playground-models'],
    queryFn: getUserImageModels,
    staleTime: 60_000,
  })

  const { data: groups = [] } = useQuery({
    queryKey: ['image-playground-groups'],
    queryFn: getUserGroups,
    staleTime: 60_000,
  })

  // If the default model isn't available, pick the first one
  const effectiveModel = useMemo(() => {
    if (models.length === 0) return model
    if (models.some((m) => m.value === model)) return model
    return models[0].value
  }, [model, models])

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      toast.error(t('Prompt is required'))
      return
    }

    setIsGenerating(true)
    setError(null)

    try {
      const response: ImageGenerationResponse = await generateImage(
        {
          model: effectiveModel,
          prompt: prompt.trim(),
          size,
          quality,
          n: 1,
        },
        group
      )

      if (response.data && response.data.length > 0) {
        const newImages: GeneratedImage[] = response.data.map((d) => ({
          url: d.url,
          b64_json: d.b64_json,
          revised_prompt: d.revised_prompt,
          model: effectiveModel,
          prompt: prompt.trim(),
          size,
          quality,
          timestamp: Date.now(),
        }))
        setImages((prev) => [...newImages, ...prev])
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('Failed to generate image')
      setError(message)
      toast.error(message)
    } finally {
      setIsGenerating(false)
    }
  }, [prompt, effectiveModel, size, quality, group, t])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isGenerating) {
        e.preventDefault()
        handleGenerate()
      }
    },
    [handleGenerate, isGenerating]
  )

  const handleDownload = useCallback((image: GeneratedImage) => {
    const url = image.url || (image.b64_json ? `data:image/png;base64,${image.b64_json}` : null)
    if (!url) return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `image-${image.timestamp}.png`
    anchor.click()
  }, [])

  return (
    <div className='flex h-full flex-col'>
      {/* Controls bar */}
      <div className='border-b bg-background px-4 py-3'>
        <div className='flex flex-wrap items-center gap-3'>
          {/* Model selector */}
          <div className='flex items-center gap-2'>
            <label className='text-sm font-medium text-muted-foreground'>
              {t('Model')}
            </label>
            <select
              value={effectiveModel}
              onChange={(e) => setModel(e.target.value)}
              className='h-8 rounded-md border bg-background px-2 text-sm'
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
              {models.length === 0 && (
                <option value={model}>{model}</option>
              )}
            </select>
          </div>

          {/* Group selector */}
          {groups.length > 1 && (
            <div className='flex items-center gap-2'>
              <label className='text-sm font-medium text-muted-foreground'>
                {t('Group')}
              </label>
              <select
                value={group}
                onChange={(e) => setGroup(e.target.value)}
                className='h-8 rounded-md border bg-background px-2 text-sm'
              >
                {groups.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Size selector */}
          <div className='flex items-center gap-2'>
            <label className='text-sm font-medium text-muted-foreground'>
              {t('Size:')}
            </label>
            <select
              value={size}
              onChange={(e) => setSize(e.target.value)}
              className='h-8 rounded-md border bg-background px-2 text-sm'
            >
              {SIZE_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Quality selector */}
          <div className='flex items-center gap-2'>
            <label className='text-sm font-medium text-muted-foreground'>
              {t('Quality')}
            </label>
            <select
              value={quality}
              onChange={(e) => setQuality(e.target.value)}
              className='h-8 rounded-md border bg-background px-2 text-sm'
            >
              {QUALITY_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Main content area */}
      <div className='flex flex-1 flex-col overflow-hidden'>
        {/* Image gallery */}
        <div className='flex-1 overflow-y-auto p-4'>
          {images.length === 0 && !isGenerating && !error && (
            <div className='flex h-full flex-col items-center justify-center text-muted-foreground'>
              <ImageIcon className='mb-4 size-16 opacity-20' />
              <p className='text-lg font-medium'>{t('Image Model')}</p>
              <p className='mt-1 text-sm'>
                {t('Describe the image you want to generate...')}
              </p>
            </div>
          )}

          {error && (
            <div className='mb-4 flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive'>
              <AlertCircle className='size-4 shrink-0' />
              <span>{error}</span>
            </div>
          )}

          {isGenerating && (
            <div className='mb-4 flex items-center justify-center rounded-lg border border-dashed p-8'>
              <Loader2 className='mr-2 size-5 animate-spin text-muted-foreground' />
              <span className='text-muted-foreground'>
                {t('Generating...')}
              </span>
            </div>
          )}

          <div className='grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3'>
            {images.map((image, index) => {
              const imgSrc =
                image.url ||
                (image.b64_json
                  ? `data:image/png;base64,${image.b64_json}`
                  : null)
              return (
                <div
                  key={`${image.timestamp}-${index}`}
                  className='group relative overflow-hidden rounded-lg border bg-muted/30'
                >
                  {imgSrc && (
                    <img
                      src={imgSrc}
                      alt={image.prompt}
                      className='aspect-square w-full object-cover'
                    />
                  )}
                  <div className='absolute inset-0 flex items-end bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100'>
                    <div className='flex w-full items-end justify-between p-3'>
                      <div className='min-w-0 flex-1'>
                        <p className='truncate text-xs text-white/90'>
                          {image.prompt}
                        </p>
                        <p className='mt-0.5 text-xs text-white/60'>
                          {image.model} · {image.size} · {image.quality}
                        </p>
                      </div>
                      <Button
                        variant='ghost'
                        size='icon'
                        className='ml-2 size-7 shrink-0 text-white hover:bg-white/20 hover:text-white'
                        onClick={() => handleDownload(image)}
                      >
                        <Download className='size-4' />
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Input area */}
        <div className='border-t bg-background p-4'>
          <div className='flex gap-2'>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t(
                'Describe the image you want to generate...'
              )}
              rows={2}
              className='flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
              disabled={isGenerating}
            />
            <Button
              onClick={handleGenerate}
              disabled={isGenerating || !prompt.trim()}
              className='self-end'
            >
              {isGenerating ? (
                <>
                  <Loader2 className='mr-2 size-4 animate-spin' />
                  {t('Generating...')}
                </>
              ) : (
                t('Generate Image')
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
