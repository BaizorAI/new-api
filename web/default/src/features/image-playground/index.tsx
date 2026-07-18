import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ImageIcon,
  Loader2,
  Download,
  AlertCircle,
  Trash2,
  RefreshCw,
  Camera,
  PanelRightOpen,
  PanelRightClose,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Button } from '@/components/ui/button'
import { SoftConversionBanner } from '@/components/soft-conversion-banner'
import { cn } from '@/lib/utils'

import {
  getUserImageModels,
  getUserGroups,
  getImageHistory,
  clearImageHistory,
} from './api'
import { createAsset } from '../asset-center/api'
import { CharacterLockPanel } from './components/character-lock-panel'
import { ComplianceCheckDialog } from './components/compliance-check-dialog'
import {
  OnboardingWizard,
  hasCompletedOnboarding,
  markOnboardingDone,
  clearOnboarding,
} from './components/onboarding-wizard'
import { QuotaBadge } from './components/quota-badge'
import {
  TemplateGallery,
  TEMPLATES,
} from './components/template-gallery'
import type { ImageTemplate } from './components/template-gallery'
import type { LockedCharacter } from './components/character-lock-panel'
import type { OnboardingData } from './components/onboarding-wizard'
import {
  SIZE_OPTIONS,
  QUALITY_OPTIONS,
  DEFAULT_GROUP,
  PENDING_POLL_INTERVAL_MS,
} from './constants'
import { useImagePlaygroundState, useImageHandler } from './hooks'
import type {
  ImageModelOption,
  GroupOption,
  GeneratedImage,
} from './types'
import { IMAGE_STATUS } from './types'

const HISTORY_QUERY_KEY = ['image-playground', 'history'] as const

interface ImagePlaygroundProps {
  defaultModel?: string
  /** Force-show onboarding (e.g. from sidebar "Quick Start" link). */
  action?: 'onboarding'
}

export function ImagePlayground({
  defaultModel = 'huayu-drama-4',
  action,
}: ImagePlaygroundProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  // ── State (config only — history is server-side) ──────────────
  const {
    config,
    models,
    groups,
    setModels,
    setGroups,
    updateConfig,
  } = useImagePlaygroundState({
    defaultConfig: { model: defaultModel },
  })

  // ── New UX state ──────────────────────────────────────────────
  const [showOnboarding, setShowOnboarding] = useState(
    () => action === 'onboarding' || !hasCompletedOnboarding()
  )

  // When triggered from sidebar, clear the stored flag so onboarding shows.
  useEffect(() => {
    if (action === 'onboarding') {
      clearOnboarding()
      setShowOnboarding(true)
    }
  }, [action])
  const [showTemplates, setShowTemplates] = useState(false)
  const [characters, setCharacters] = useState<LockedCharacter[]>([])
  const [quotaRemaining, setQuotaRemaining] = useState(50)
  const [quotaTotal, setQuotaTotal] = useState(100)
  const [consistencyEnabled, setConsistencyEnabled] = useState(false)

  // ── Prompt state ──────────────────────────────────────────────
  const [prompt, setPrompt] = useState('')
  const [isClearing, setIsClearing] = useState(false)

  // ── Server-side history with conditional polling ──────────────
  const { data: historyData } = useQuery({
    queryKey: [...HISTORY_QUERY_KEY],
    queryFn: () => getImageHistory(1, 200),
    refetchInterval: (query) => {
      const items = query.state.data?.items
      if (items?.some((i) => i.status === IMAGE_STATUS.PENDING)) {
        return PENDING_POLL_INTERVAL_MS
      }
      return false
    },
  })

  // Display in chronological order (oldest first) for conversation flow
  const images: GeneratedImage[] = useMemo(
    () => [...(historyData?.items ?? [])].reverse(),
    [historyData]
  )

  const invalidateHistory = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: [...HISTORY_QUERY_KEY] })
  }, [queryClient])

  // ── Auto-sync completed images to asset center ──────────────
  const syncedAssetIds = useRef(new Set<number>())

  useEffect(() => {
    const completed = images.filter(
      (img) => img.status === IMAGE_STATUS.COMPLETED
        && img.image_url
        && !syncedAssetIds.current.has(img.id)
    )
    if (completed.length === 0) return

    Promise.allSettled(
      completed.map((img) => {
        syncedAssetIds.current.add(img.id)
        return createAsset({
          name: img.prompt.slice(0, 80),
          asset_type: 'storyboard',
          url: img.image_url
            || (img.b64_json ? `data:image/png;base64,${img.b64_json}` : undefined),
          source_app: 'image-playground',
          source_id: img.id,
          metadata: JSON.stringify({
            model: img.model,
            size: img.size,
            quality: img.quality,
            revised_prompt: img.revised_prompt,
          }),
        }).catch(() => {
          // Remove from synced so it can retry next poll
          syncedAssetIds.current.delete(img.id)
        })
      })
    )
  }, [images])

  // ── Handler (submits async, triggers refetch) ─────────────────
  const { generate, isSubmitting, error } = useImageHandler({
    config,
    onSuccess: invalidateHistory,
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
      updateConfig(
        'model',
        preferred ? preferred.value : availableModels[0].value
      )
    }
  }, [
    modelsData,
    availableModels,
    config.model,
    defaultModel,
    setModels,
    updateConfig,
  ])

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
  const [showCompliance, setShowCompliance] = useState(false)
  const [pendingPrompt, setPendingPrompt] = useState('')

  const handleGenerate = useCallback(() => {
    // Show compliance check before generating
    setPendingPrompt(prompt)
    setShowCompliance(true)
  }, [prompt])

  const handleComplianceProceed = useCallback(() => {
    setShowCompliance(false)
    generate(pendingPrompt)
    setPrompt('')
  }, [generate, pendingPrompt])

  const handleComplianceEdit = useCallback(() => {
    setShowCompliance(false)
    // User edits prompt themselves
  }, [])

  const handleRetry = useCallback(
    (image: GeneratedImage) => {
      generate(image.prompt)
    },
    [generate]
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !isSubmitting) {
        e.preventDefault()
        handleGenerate()
      }
    },
    [handleGenerate, isSubmitting]
  )

  const handleDownload = useCallback((image: GeneratedImage) => {
    const url =
      image.image_url ||
      (image.b64_json ? `data:image/png;base64,${image.b64_json}` : null)
    if (!url) return
    // Images are stored locally on the server (same origin), so
    // the download attribute works directly — no blob fetch needed.
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `image-${image.id}.png`
    anchor.click()
  }, [])

  const handleClearHistory = useCallback(async () => {
    setIsClearing(true)
    try {
      await clearImageHistory()
      invalidateHistory()
      toast.success(t('History cleared'))
    } catch {
      toast.error(t('Failed to clear history'))
    } finally {
      setIsClearing(false)
    }
  }, [invalidateHistory, t])

  // ── Onboarding handlers ─────────────────────────────────────
  const handleOnboardingClose = useCallback(
    (data: OnboardingData) => {
      setShowOnboarding(false)
      if (data.storyboardText.trim()) {
        setPrompt(data.storyboardText)
      }
    },
    []
  )

  // ── Template handler ────────────────────────────────────────
  const handleSelectTemplate = useCallback(
    (template: ImageTemplate) => {
      setPrompt(template.prompt)
      if (template.size) updateConfig('size', template.size)
      if (template.quality) updateConfig('quality', template.quality)
    },
    [updateConfig]
  )

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className='flex h-full'>
      {/* Onboarding — shown once for new users */}
      <OnboardingWizard
        open={showOnboarding}
        onClose={handleOnboardingClose}
      />

      {/* Compliance check — shown before generation */}
      <ComplianceCheckDialog
        open={showCompliance}
        onOpenChange={setShowCompliance}
        prompt={pendingPrompt}
        onProceed={handleComplianceProceed}
        onEdit={handleComplianceEdit}
      />

      {/* Left: Character lock panel */}
      <CharacterLockPanel
        characters={characters}
        consistencyEnabled={consistencyEnabled}
        onToggleConsistency={setConsistencyEnabled}
        onAddCharacter={(char) =>
          setCharacters((prev) => [...prev, char])
        }
        onRemoveCharacter={(id) =>
          setCharacters((prev) => prev.filter((c) => c.id !== id))
        }
        className='hidden lg:flex'
      />

      {/* Center: Main playground area */}
      <div className='flex min-w-0 flex-1 flex-col'>
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

            {/* Spacer */}
            <div className='ml-auto flex items-center gap-2'>
              {/* Quota badge */}
              <QuotaBadge remaining={quotaRemaining} total={quotaTotal} />

              {/* Template toggle */}
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground'
                onClick={() => setShowTemplates((v) => !v)}
              >
                {showTemplates ? (
                  <PanelRightClose className='mr-1 size-4' />
                ) : (
                  <PanelRightOpen className='mr-1 size-4' />
                )}
                {t('Templates')}
              </Button>

              {/* Clear history */}
              {images.length > 0 && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='text-muted-foreground hover:text-destructive'
                  onClick={handleClearHistory}
                  disabled={isClearing}
                >
                  {isClearing ? (
                    <Loader2 className='mr-1 size-4 animate-spin' />
                  ) : (
                    <Trash2 className='mr-1 size-4' />
                  )}
                  {t('Clear History')}
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Compute upsell when quota is low */}
        {quotaRemaining <= quotaTotal * 0.2 ? (
          <SoftConversionBanner
            type='compute'
            className='mx-4 mb-0 mt-0'
          />
        ) : null}

        <div className='flex min-h-0 flex-1'>
          {/* Main conversation area */}
          <Conversation className='flex-1'>
            <ConversationContent className='mx-auto max-w-3xl space-y-1'>
              {images.length === 0 && !error && (
                <ConversationEmptyState
                  icon={<ImageIcon className='size-12 opacity-30' />}
                  title={t('Image Model')}
                  description={t(
                    'Describe the image you want to generate...'
                  )}
                />
              )}

              {images.map((image) => (
                <ImageConversationEntry
                  key={image.id}
                  image={image}
                  onDownload={handleDownload}
                  onRetry={handleRetry}
                />
              ))}

              {error && (
                <div className='flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive'>
                  <AlertCircle className='size-4 shrink-0' />
                  <span>{error}</span>
                </div>
              )}
            </ConversationContent>
            <ConversationScrollButton />
          </Conversation>

          {/* Right: Template gallery (collapsible) */}
          {showTemplates ? (
            <TemplateGallery
              onSelect={handleSelectTemplate}
              className='hidden w-[260px] shrink-0 border-l lg:flex'
            />
          ) : null}
        </div>

        {/* Input area */}
        <div className='border-t bg-background p-4'>
          <div className='mx-auto flex max-w-3xl gap-2'>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t(
                'Describe the image you want to generate...'
              )}
              rows={2}
              className='flex-1 resize-none rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring'
              disabled={isSubmitting}
            />
            <Button
              onClick={handleGenerate}
              disabled={isSubmitting || !prompt.trim()}
              className='self-end'
            >
              {isSubmitting ? (
                <>
                  <Loader2 className='mr-2 size-4 animate-spin' />
                  {t('Submitting...')}
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

// ── Conversation entry (user prompt + assistant response) ──────

interface ImageConversationEntryProps {
  image: GeneratedImage
  onDownload: (image: GeneratedImage) => void
  onRetry: (image: GeneratedImage) => void
}

function ImageConversationEntry({
  image,
  onDownload,
  onRetry,
}: ImageConversationEntryProps) {
  const { t } = useTranslation()

  return (
    <div className='space-y-1'>
      {/* User prompt bubble */}
      <Message from='user' className='py-1.5'>
        <MessageContent variant='contained'>
          <p className='whitespace-pre-wrap'>{image.prompt}</p>
        </MessageContent>
      </Message>

      {/* Assistant response bubble */}
      <Message from='assistant' className='py-1.5'>
        <MessageContent variant='flat'>
          {image.status === IMAGE_STATUS.PENDING && (
            <div className='flex items-center gap-2 py-4'>
              <Loader className='text-muted-foreground' />
              <span className='text-sm text-muted-foreground'>
                {t('Generating...')}
              </span>
            </div>
          )}

          {image.status === IMAGE_STATUS.COMPLETED && (
            <div className='space-y-2'>
              {(image.image_url || image.b64_json) && (
                <img
                  src={
                    image.image_url ||
                    `data:image/png;base64,${image.b64_json}`
                  }
                  alt={image.revised_prompt || image.prompt}
                  className={cn(
                    'max-h-[512px] rounded-lg border object-contain',
                    'cursor-pointer transition-opacity hover:opacity-90'
                  )}
                  onClick={() => {
                    const url =
                      image.image_url ||
                      `data:image/png;base64,${image.b64_json}`
                    window.open(url, '_blank')
                  }}
                />
              )}
              <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                <span>
                  {image.model} · {image.size} · {image.quality}
                </span>
                <Button
                  variant='ghost'
                  size='icon'
                  className='size-6 text-muted-foreground hover:text-foreground'
                  onClick={() => onDownload(image)}
                >
                  <Download className='size-3.5' />
                </Button>
              </div>
              {image.revised_prompt && (
                <p className='text-xs italic text-muted-foreground'>
                  {image.revised_prompt}
                </p>
              )}
            </div>
          )}

          {image.status === IMAGE_STATUS.FAILED && (
            <div className='space-y-2'>
              <div className='flex items-center gap-2 text-sm text-destructive'>
                <AlertCircle className='size-4 shrink-0' />
                <span>{image.error_message || t('Generation failed')}</span>
              </div>
              <Button
                variant='ghost'
                size='sm'
                className='h-7 text-xs'
                onClick={() => onRetry(image)}
              >
                <RefreshCw className='mr-1 size-3' />
                {t('Retry')}
              </Button>
            </div>
          )}
        </MessageContent>
      </Message>
    </div>
  )
}
