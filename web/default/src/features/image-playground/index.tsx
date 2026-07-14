import { useQuery } from '@tanstack/react-query'
import { ImageIcon, Loader2, Download, AlertCircle, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'

import { getUserImageModels, getUserGroups } from './api'
import { SIZE_OPTIONS, QUALITY_OPTIONS, DEFAULT_GROUP } from './constants'
import { useImagePlaygroundState, useImageHandler } from './hooks'
import type {
  ImageModelOption,
  GroupOption,
  GeneratedImage,
} from './types'

interface ImagePlaygroundProps {
  defaultModel?: string
}

export function ImagePlayground({
  defaultModel = 'huayu-drama-4',
}: ImagePlaygroundProps) {
  const { t } = useTranslation()

  // ── State (mirrors playground's usePlaygroundState) ────────────
  const {
    config,
    models,
    groups,
    images,
    setModels,
    setGroups,
    updateConfig,
    updateImages,
    clearHistory,
  } = useImagePlaygroundState({
    defaultConfig: { model: defaultModel },
  })

  // ── Prompt state ──────────────────────────────────────────────
  const [prompt, setPrompt] = useState('')

  // ── Handler (mirrors playground's useChatHandler) ─────────────
  const { generate, isGenerating, error } = useImageHandler({
    config,
    onImagesUpdate: updateImages,
  })

  // ── Fetch models ──────────────────────────────────────────────
  const { data: modelsData, isLoading: isLoadingModels } = useQuery<
    ImageModelOption[]
  >({
    queryKey: ['image-playground', 'models'],
    queryFn: async () => {
      try {
        return await getUserImageModels()
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t('Failed to load playground models')
        )
        return []
      }
    },
  })

  // ── Fetch groups ──────────────────────────────────────────────
  const { data: groupsData } = useQuery<GroupOption[]>({
    queryKey: ['image-playground', 'groups'],
    queryFn: async () => {
      try {
        return await getUserGroups()
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : t('Failed to load playground groups')
        )
        return []
      }
    },
  })

  const availableModels = useMemo(() => modelsData ?? [], [modelsData])

  // ── Sync models when data arrives ─────────────────────────────
  useEffect(() => {
    if (!modelsData) return
    setModels(availableModels)

    const isCurrentValid = availableModels.some(
      (m) => m.value === config.model
    )
    if (availableModels.length > 0 && !isCurrentValid) {
      const preferred = availableModels.find((m) => m.value === defaultModel)
      updateConfig('model', preferred ? preferred.value : availableModels[0].value)
    }
  }, [modelsData, availableModels, config.model, defaultModel, setModels, updateConfig])

  // ── Sync groups when data arrives ─────────────────────────────
  useEffect(() => {
    if (!groupsData) return
    setGroups(groupsData)

    const hasCurrentGroup = groupsData.some((g) => g.value === config.group)
    if (!hasCurrentGroup && groupsData.length > 0) {
      const fallback =
        groupsData.find((g) => g.value === DEFAULT_GROUP)?.value ??
        groupsData[0].value
      updateConfig('group', fallback)
    }
  }, [groupsData, setGroups, config.group, updateConfig])

  // ── Handlers ──────────────────────────────────────────────────
  const handleGenerate = useCallback(() => {
    generate(prompt)
  }, [generate, prompt])

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
    const url =
      image.url ||
      (image.b64_json ? `data:image/png;base64,${image.b64_json}` : null)
    if (!url) return
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `image-${image.timestamp}.png`
    anchor.click()
  }, [])

  // ── Render ────────────────────────────────────────────────────
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
              value={config.model}
              onChange={(e) => updateConfig('model', e.target.value)}
              className='h-8 rounded-md border bg-background px-2 text-sm'
              disabled={isLoadingModels}
            >
              {models.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
              {models.length === 0 && (
                <option value={config.model}>{config.model}</option>
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
                value={config.group}
                onChange={(e) => updateConfig('group', e.target.value)}
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
              value={config.size}
              onChange={(e) => updateConfig('size', e.target.value)}
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
              value={config.quality}
              onChange={(e) => updateConfig('quality', e.target.value)}
              className='h-8 rounded-md border bg-background px-2 text-sm'
            >
              {QUALITY_OPTIONS.map((q) => (
                <option key={q} value={q}>
                  {q}
                </option>
              ))}
            </select>
          </div>

          {/* Spacer + Clear history */}
          {images.length > 0 && (
            <div className='ml-auto'>
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground hover:text-destructive'
                onClick={clearHistory}
              >
                <Trash2 className='mr-1 size-4' />
                {t('Clear History')}
              </Button>
            </div>
          )}
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
            {images.map((image) => {
              const imgSrc =
                image.url ||
                (image.b64_json
                  ? `data:image/png;base64,${image.b64_json}`
                  : null)
              return (
                <div
                  key={image.id}
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
          <div className='mx-auto flex max-w-4xl gap-2'>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t('Describe the image you want to generate...')}
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
