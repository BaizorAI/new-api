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
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  ImagePlus,
  Images,
  Loader2,
  MessageSquareQuote,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Sparkles,
  SquareIcon,
  Trash2,
  Video,
  Wand2,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

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
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Markdown } from '@/components/ui/markdown'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
  getStudioCharacters,
  getStudioProject,
  getStudioShots,
  getStudioStages,
  studioAgentCreate,
  studioQuickGenerate,
  updateStudioStage,
} from '../api'
import {
  PIPELINE_STAGES,
  STAGE_STATUS_CONFIG,
  STUDIO_QUERY_KEYS,
  type StageStatusValue,
} from '../constants'
import {
  useStudioStageChat,
  type StageChatMessage,
} from '../hooks/use-studio-stage-chat'
import { useExtractCharacters, useExtractShots } from '../hooks/use-ai-extraction'
import { useShotImageGen } from '../hooks/use-shot-image-gen'
import { useShotVideoGen } from '../hooks/use-shot-video-gen'
import { useSwapShotOrder } from '../hooks/use-studio-mutations'
import type { StudioCharacter, StudioShot } from '../types'
import { StudioCharacterDeleteDialog } from './studio-character-delete-dialog'
import { StudioCharacterMutateDrawer } from './studio-character-mutate-drawer'
import { StudioScriptEditor, type ScriptEditorHandle } from './studio-script-editor'
import { StudioShotDeleteDialog } from './studio-shot-delete-dialog'
import { StudioShotMutateDrawer } from './studio-shot-mutate-drawer'

// Stage-specific placeholder text for the chat input
const STAGE_PLACEHOLDERS: Record<string, string> = {
  script: 'Describe the story you want to tell...',
  characters: 'Describe the characters for your film...',
  storyboard: 'Describe how to break the script into shots...',
  image_gen: 'Describe the visual style for image generation...',
  video_gen: 'Describe video generation requirements...',
  post: 'Describe post-production needs (audio, transitions, effects)...',
  review: 'Ask for a review of the final output...',
}

// Maps each pipeline stage to its corresponding Hermes skill
const STAGE_SKILL_MAP: Record<string, string> = {
  script: 'script-analyzer',
  characters: 'character-designer',
  storyboard: 'shot-planner',
  image_gen: 'batch-generator',
  video_gen: 'batch-generator',
  post: 'post-production',
  review: 'quality-checker',
}

type DialogType = 'create' | 'update' | 'delete'

export function StudioStageDetail() {
  const { t } = useTranslation()
  const { projectId, stageKey } = useParams({
    from: '/_authenticated/studio/$projectId/$stageKey/',
  })
  const id = Number(projectId)

  // Dialog state for characters
  const [charDialog, setCharDialog] = useState<DialogType | null>(null)
  const [currentChar, setCurrentChar] = useState<StudioCharacter | null>(null)

  // Dialog state for shots
  const [shotDialog, setShotDialog] = useState<DialogType | null>(null)
  const [currentShot, setCurrentShot] = useState<StudioShot | null>(null)

  // Fullscreen video preview
  const [fullscreenVideo, setFullscreenVideo] = useState<{
    url: string
    poster?: string
    label: string
  } | null>(null)

  // Script editor imperative handle + selection state (script stage only)
  const scriptEditorRef = useRef<ScriptEditorHandle>(null)
  const [currentSelection, setCurrentSelection] = useState<{
    start: number
    end: number
    text: string
  } | null>(null)

  const stageConfig = useMemo(
    () => PIPELINE_STAGES.find((s) => s.key === stageKey),
    [stageKey]
  )

  const { data: projectData, isLoading: isLoadingProject } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.project(id)],
    queryFn: () => getStudioProject(id),
    enabled: id > 0,
  })

  const { data: stagesData, isLoading: isLoadingStages } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.stages(id)],
    queryFn: () => getStudioStages(id),
    enabled: id > 0,
  })

  const { data: shotsData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.shots(id)],
    queryFn: () => getStudioShots(id),
    enabled:
      id > 0 &&
      (stageKey === 'storyboard' ||
        stageKey === 'image_gen' ||
        stageKey === 'video_gen' ||
        stageKey === 'review'),
  })

  const { data: charsData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.characters(id)],
    queryFn: () => getStudioCharacters(id),
    enabled: id > 0 && stageKey === 'characters',
  })

  const isPageLoading = isLoadingProject || isLoadingStages

  const { messages, sendMessage, stopGeneration, isStreaming } =
    useStudioStageChat({ projectId: id, stageKey })

  const { generateImage, generatingIds } = useShotImageGen({
    projectId: id,
    styleDna: projectData?.data?.style_dna,
  })
  const {
    generateVideo,
    generatingIds: videoGeneratingIds,
  } = useShotVideoGen({
    projectId: id,
    styleDna: projectData?.data?.style_dna,
  })
  const { extractCharacters, isExtracting: isExtractingChars } =
    useExtractCharacters(id)
  const { extractShots, isExtracting: isExtractingShots } =
    useExtractShots(id)
  const swapShotOrder = useSwapShotOrder(id)

  // Agent create & quick generate state
  const [isAgentCreating, setIsAgentCreating] = useState(false)
  const [isQuickAnalyzing, setIsQuickAnalyzing] = useState(false)

  const project = projectData?.data
  const stages = stagesData?.data ?? []
  const stage = stages.find((s) => s.key === stageKey)
  const shots = shotsData?.data ?? []
  const characters = charsData?.data ?? []

  // Get script text for AI extraction
  const scriptText = useMemo(() => {
    const scriptStage = stages.find((s) => s.key === 'script')
    return scriptStage?.output_data ?? ''
  }, [stages])

  const statusConfig = stage
    ? STAGE_STATUS_CONFIG[stage.status as StageStatusValue]
    : null

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const text = (message.text ?? '').trim()
      if (!text || isStreaming) return

      // For script stage, inject script content + selection as context
      if (stageKey === 'script') {
        const fullScript = scriptEditorRef.current?.getText() ?? ''
        sendMessage(text, {
          scriptContext: fullScript || undefined,
          selectionContext: currentSelection?.text ?? undefined,
        })
        setCurrentSelection(null)
      } else {
        sendMessage(text)
      }
    },
    [isStreaming, sendMessage, stageKey, currentSelection]
  )

  const handleAgentCreate = useCallback(async () => {
    const skill = STAGE_SKILL_MAP[stageKey]
    if (!skill) return
    setIsAgentCreating(true)
    try {
      const result = await studioAgentCreate(id, {
        skill,
        stage_key: stageKey,
        context: scriptText || undefined,
      })
      if (result.success) {
        toast.success(
          t('Agent task created: {{title}}', { title: result.data?.title ?? skill })
        )
      } else {
        toast.error(result.message ?? t('Failed to create agent task.'))
      }
    } catch {
      toast.error(t('Failed to create agent task.'))
    } finally {
      setIsAgentCreating(false)
    }
  }, [id, stageKey, scriptText, t])

  const handleQuickAnalyze = useCallback(async () => {
    if (!scriptText.trim()) return
    setIsQuickAnalyzing(true)
    try {
      const result = await studioQuickGenerate(id, {
        type: 'analyze',
        prompt: scriptText,
        stage_key: stageKey,
      })
      if (result.success && result.data?.text) {
        toast.success(t('Analysis complete.'))
      } else {
        toast.error(result.message ?? t('Analysis failed.'))
      }
    } catch {
      toast.error(t('Analysis failed.'))
    } finally {
      setIsQuickAnalyzing(false)
    }
  }, [id, stageKey, scriptText, t])

  const placeholder =
    STAGE_PLACEHOLDERS[stageKey] ?? 'Ask AI to help with this stage...'

  const showShotsCrud =
    stageKey === 'storyboard' ||
    stageKey === 'image_gen' ||
    stageKey === 'video_gen'

  const shotsWithoutImage = shots.filter((s) => !s.image_url)
  const shotsWithoutVideo = shots.filter((s) => !s.video_url)
  const isBatchImgGenerating = generatingIds.size > 0
  const isBatchVidGenerating = videoGeneratingIds.size > 0

  if (isPageLoading) {
    return (
      <div className='flex h-full flex-col'>
        <div className='border-border flex items-center gap-3 border-b px-6 py-4'>
          <Button variant='ghost' size='icon' className='size-8' asChild>
            <Link
              to='/studio/$projectId'
              params={{ projectId: String(id) }}
            >
              <ArrowLeft className='size-4' />
            </Link>
          </Button>
          <div className='min-w-0 flex-1'>
            <div className='flex items-center gap-2'>
              {stageConfig ? (
                <span className='text-base' aria-hidden='true'>
                  {stageConfig.icon}
                </span>
              ) : null}
              <h1 className='truncate text-lg font-semibold'>
                {stageConfig ? t(stageConfig.labelKey) : stageKey}
              </h1>
            </div>
          </div>
        </div>
        <div className='flex flex-1 items-center justify-center'>
          <div className='flex items-center gap-2'>
            <Loader2 className='text-muted-foreground size-5 animate-spin' />
            <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-border flex items-center gap-3 border-b px-6 py-4'>
        <Button variant='ghost' size='icon' className='size-8' asChild>
          <Link
            to='/studio/$projectId'
            params={{ projectId: String(id) }}
          >
            <ArrowLeft className='size-4' />
          </Link>
        </Button>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            {stageConfig ? (
              <span className='text-base' aria-hidden='true'>
                {stageConfig.icon}
              </span>
            ) : null}
            <h1 className='truncate text-lg font-semibold'>
              {stageConfig ? t(stageConfig.labelKey) : stageKey}
            </h1>
          </div>
          {project ? (
            <p className='text-muted-foreground truncate text-xs'>
              {project.name}
              {statusConfig ? ` · ${t(statusConfig.labelKey)}` : null}
            </p>
          ) : null}
        </div>

        {/* AI action buttons */}
        <div className='flex items-center gap-2'>
          {stageKey === 'script' && scriptText.trim() ? (
            <Button
              size='sm'
              variant='outline'
              disabled={isQuickAnalyzing}
              onClick={() => void handleQuickAnalyze()}
            >
              {isQuickAnalyzing ? (
                <Loader2
                  className='mr-1.5 size-3.5 animate-spin'
                  aria-hidden='true'
                />
              ) : (
                <Sparkles
                  className='mr-1.5 size-3.5'
                  aria-hidden='true'
                />
              )}
              {isQuickAnalyzing
                ? t('Analyzing...')
                : t('Quick Analyze')}
            </Button>
          ) : null}
          {STAGE_SKILL_MAP[stageKey] ? (
            <Button
              size='sm'
              variant='outline'
              disabled={isAgentCreating}
              onClick={() => void handleAgentCreate()}
            >
              {isAgentCreating ? (
                <Loader2
                  className='mr-1.5 size-3.5 animate-spin'
                  aria-hidden='true'
                />
              ) : (
                <Bot
                  className='mr-1.5 size-3.5'
                  aria-hidden='true'
                />
              )}
              {isAgentCreating
                ? t('Creating...')
                : t('AI Agent')}
            </Button>
          ) : null}
        </div>
      </div>

      {/* Stage content area — script stage gets side-by-side layout */}
      {stageKey === 'script' ? (
        <ResizablePanelGroup orientation='horizontal' className='min-h-0 flex-1'>
          {/* Left panel: Script editor */}
          <ResizablePanel defaultSize={55} minSize={30}>
            <ScrollArea className='h-full'>
              <div className='p-6'>
                {stageConfig ? (
                  <p className='text-muted-foreground mb-6 text-sm'>
                    {t(stageConfig.descriptionKey)}
                  </p>
                ) : null}
                <StudioScriptEditor
                  ref={scriptEditorRef}
                  projectId={id}
                  stageKey={stageKey}
                  initialContent={stage?.output_data ?? ''}
                  onSelectionChange={setCurrentSelection}
                />
              </div>
            </ScrollArea>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: AI Chat */}
          <ResizablePanel defaultSize={45} minSize={25}>
            <div className='flex h-full flex-col'>
              {/* Chat messages with auto-scroll */}
              <Conversation className='min-h-0 flex-1'>
                <ConversationContent className='space-y-4'>
                  {messages.length === 0 ? (
                    <ConversationEmptyState
                      title={t('Script Assistant')}
                      description={t('AI will modify your script based on the response.')}
                      icon={<Bot className='size-8' />}
                    />
                  ) : (
                    messages.map((msg) => (
                      <ScriptChatBubble
                        key={msg.id}
                        message={msg}
                        onApply={(content) => {
                          if (currentSelection) {
                            scriptEditorRef.current?.replaceRange(
                              currentSelection.start,
                              currentSelection.end,
                              content
                            )
                          } else {
                            scriptEditorRef.current?.setText(content)
                          }
                        }}
                      />
                    ))
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              {/* Selection banner */}
              {currentSelection?.text ? (
                <div className='bg-muted/50 flex items-center gap-2 border-t px-3 py-1.5'>
                  <MessageSquareQuote className='text-muted-foreground size-3.5 shrink-0' />
                  <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
                    {t('Selected: "{{text}}"', {
                      text: currentSelection.text.length > 60
                        ? currentSelection.text.slice(0, 60) + '…'
                        : currentSelection.text,
                    })}
                  </span>
                  <Button
                    size='sm'
                    variant='ghost'
                    className='size-6 shrink-0 p-0'
                    onClick={() => setCurrentSelection(null)}
                    aria-label={t('Clear selection')}
                  >
                    <X className='size-3' />
                  </Button>
                </div>
              ) : null}

              {/* Chat input */}
              <div className='border-border shrink-0 border-t p-3'>
                <PromptInput
                  onSubmit={handleSubmit}
                  className='rounded-lg border shadow-sm'
                >
                  <PromptInputTextarea
                    placeholder={t(placeholder)}
                    className='min-h-[40px] resize-none text-sm'
                  />
                  <PromptInputFooter className='justify-end p-1'>
                    {isStreaming ? (
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        className='size-7'
                        onClick={stopGeneration}
                        aria-label={t('Stop')}
                      >
                        <SquareIcon className='size-4' aria-hidden='true' />
                      </Button>
                    ) : (
                      <PromptInputSubmit className='size-7' />
                    )}
                  </PromptInputFooter>
                </PromptInput>
              </div>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <>
          {/* Non-script stages: existing vertical layout */}
          <ScrollArea className='min-h-0 flex-1'>
            <div className='mx-auto max-w-4xl p-6'>
              {/* Stage description */}
              {stageConfig ? (
                <p className='text-muted-foreground mb-6 text-sm'>
                  {t(stageConfig.descriptionKey)}
                </p>
              ) : null}

          {/* Characters section */}
          {stageKey === 'characters' ? (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h2 className='text-sm font-medium'>
                  {t('Characters')} ({characters.length})
                </h2>
                <div className='flex items-center gap-2'>
                  <Button
                    size='sm'
                    variant='outline'
                    disabled={!scriptText.trim() || isExtractingChars}
                    onClick={() => void extractCharacters(scriptText)}
                  >
                    {isExtractingChars ? (
                      <Loader2
                        className='mr-1.5 size-3.5 animate-spin'
                        aria-hidden='true'
                      />
                    ) : (
                      <Wand2 className='mr-1.5 size-3.5' aria-hidden='true' />
                    )}
                    {isExtractingChars
                      ? t('Extracting...')
                      : t('AI Extract')}
                  </Button>
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setCurrentChar(null)
                      setCharDialog('create')
                    }}
                  >
                    <Plus className='mr-1.5 size-3.5' aria-hidden='true' />
                    {t('Add Character')}
                  </Button>
                </div>
              </div>
              {characters.length > 0 ? (
                <div className='grid gap-3 sm:grid-cols-2'>
                  {characters.map((char) => (
                    <div
                      key={char.id}
                      className='border-border group relative rounded-lg border p-3'
                    >
                      <div className='flex items-start justify-between gap-2'>
                        <h3 className='text-sm font-medium'>{char.name}</h3>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant='ghost'
                              size='icon'
                              className='size-7 shrink-0 opacity-0 group-hover:opacity-100'
                              aria-label={t('More actions')}
                            >
                              <MoreHorizontal className='size-4' />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align='end'>
                            <DropdownMenuItem
                              onClick={() => {
                                setCurrentChar(char)
                                setCharDialog('update')
                              }}
                            >
                              <Pencil className='mr-2 size-4' />
                              {t('Edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className='text-destructive'
                              onClick={() => {
                                setCurrentChar(char)
                                setCharDialog('delete')
                              }}
                            >
                              <Trash2 className='mr-2 size-4' />
                              {t('Delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      {char.description ? (
                        <p className='text-muted-foreground mt-1 text-xs'>
                          {char.description}
                        </p>
                      ) : null}
                      {char.visual_prompt ? (
                        <p className='text-muted-foreground mt-1 truncate text-xs italic'>
                          {char.visual_prompt}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Shots section */}
          {showShotsCrud ? (
            <div className='space-y-3'>
              <div className='flex items-center justify-between'>
                <h2 className='text-sm font-medium'>
                  {t('Shots')} ({shots.length})
                </h2>
                <div className='flex items-center gap-2'>
                  {stageKey === 'storyboard' ? (
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={!scriptText.trim() || isExtractingShots}
                      onClick={() => void extractShots(scriptText)}
                    >
                      {isExtractingShots ? (
                        <Loader2
                          className='mr-1.5 size-3.5 animate-spin'
                          aria-hidden='true'
                        />
                      ) : (
                        <Wand2
                          className='mr-1.5 size-3.5'
                          aria-hidden='true'
                        />
                      )}
                      {isExtractingShots
                        ? t('Extracting...')
                        : t('AI Extract')}
                    </Button>
                  ) : null}
                  {stageKey === 'image_gen' && shots.length > 0 ? (
                    <Button
                      size='sm'
                      variant='outline'
                      disabled={
                        isBatchImgGenerating ||
                        shotsWithoutImage.length === 0
                      }
                      onClick={() => {
                        for (const shot of shotsWithoutImage) {
                          void generateImage(shot)
                        }
                      }}
                    >
                      {isBatchImgGenerating ? (
                        <Loader2
                          className='mr-1.5 size-3.5 animate-spin'
                          aria-hidden='true'
                        />
                      ) : (
                        <Images
                          className='mr-1.5 size-3.5'
                          aria-hidden='true'
                        />
                      )}
                      {isBatchImgGenerating
                        ? t('Generating...')
                        : t('Generate All Images')}
                    </Button>
                  ) : null}
                  {stageKey === 'video_gen' && shots.length > 0 ? (
                    <>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={
                          isBatchImgGenerating ||
                          shotsWithoutImage.length === 0
                        }
                        onClick={() => {
                          for (const shot of shotsWithoutImage) {
                            void generateImage(shot)
                          }
                        }}
                      >
                        {isBatchImgGenerating ? (
                          <Loader2
                            className='mr-1.5 size-3.5 animate-spin'
                            aria-hidden='true'
                          />
                        ) : (
                          <Images
                            className='mr-1.5 size-3.5'
                            aria-hidden='true'
                          />
                        )}
                        {isBatchImgGenerating
                          ? t('Generating...')
                          : t('Generate All Images')}
                      </Button>
                      <Button
                        size='sm'
                        variant='outline'
                        disabled={
                          isBatchVidGenerating ||
                          shotsWithoutVideo.length === 0
                        }
                        onClick={() => {
                          for (const shot of shotsWithoutVideo) {
                            void generateVideo(shot)
                          }
                        }}
                      >
                        {isBatchVidGenerating ? (
                          <Loader2
                            className='mr-1.5 size-3.5 animate-spin'
                            aria-hidden='true'
                          />
                        ) : (
                          <Video
                            className='mr-1.5 size-3.5'
                            aria-hidden='true'
                          />
                        )}
                        {isBatchVidGenerating
                          ? t('Generating...')
                          : t('Generate All Videos')}
                      </Button>
                    </>
                  ) : null}
                  <Button
                    size='sm'
                    variant='outline'
                    onClick={() => {
                      setCurrentShot(null)
                      setShotDialog('create')
                    }}
                  >
                    <Plus className='mr-1.5 size-3.5' aria-hidden='true' />
                    {t('Add Shot')}
                  </Button>
                </div>
              </div>
              {shots.length > 0 ? (
                <div className='space-y-2'>
                  {shots.map((shot, shotIndex) => {
                    const isImgGenerating = generatingIds.has(shot.id)
                    const isVidGenerating = videoGeneratingIds.has(shot.id)
                    const showImageGen =
                      stageKey === 'image_gen' || stageKey === 'video_gen'
                    const showVideoGen = stageKey === 'video_gen'

                    return (
                      <div
                        key={shot.id}
                        className='border-border group flex items-start gap-3 rounded-lg border p-3'
                      >
                        {/* Reorder buttons (storyboard only) */}
                        {stageKey === 'storyboard' ? (
                          <div className='flex shrink-0 flex-col gap-0.5'>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='size-5'
                              disabled={shotIndex === 0}
                              onClick={() => {
                                const prev = shots[shotIndex - 1]
                                swapShotOrder.mutate({
                                  shotA: {
                                    id: shot.id,
                                    sort_order: shot.sort_order,
                                  },
                                  shotB: {
                                    id: prev.id,
                                    sort_order: prev.sort_order,
                                  },
                                })
                              }}
                              title={t('Move up')}
                            >
                              <ChevronUp className='size-3' />
                            </Button>
                            <Button
                              type='button'
                              variant='ghost'
                              size='icon'
                              className='size-5'
                              disabled={shotIndex === shots.length - 1}
                              onClick={() => {
                                const next = shots[shotIndex + 1]
                                swapShotOrder.mutate({
                                  shotA: {
                                    id: shot.id,
                                    sort_order: shot.sort_order,
                                  },
                                  shotB: {
                                    id: next.id,
                                    sort_order: next.sort_order,
                                  },
                                })
                              }}
                              title={t('Move down')}
                            >
                              <ChevronDown className='size-3' />
                            </Button>
                          </div>
                        ) : null}
                        <span className='text-muted-foreground shrink-0 font-mono text-xs'>
                          {t('S{{scene}}-{{shot}}', { scene: shot.scene_number, shot: shot.shot_number })}
                        </span>
                        <div className='min-w-0 flex-1'>
                          <p className='text-sm'>{shot.description}</p>
                          {shot.camera_angle || shot.camera_move ? (
                            <p className='text-muted-foreground mt-0.5 text-xs'>
                              {[shot.camera_angle, shot.camera_move]
                                .filter(Boolean)
                                .join(' · ')}
                            </p>
                          ) : null}
                        </div>

                        {/* Image thumbnail / generate button */}
                        {showImageGen ? (
                          shot.image_url ? (
                            <div className='relative shrink-0'>
                              <img
                                src={shot.image_url}
                                alt={shot.description}
                                className='size-16 rounded object-cover'
                              />
                              <Button
                                type='button'
                                variant='secondary'
                                size='icon'
                                className='absolute -right-1 -top-1 size-6 opacity-0 shadow-sm group-hover:opacity-100'
                                disabled={isImgGenerating}
                                onClick={() => void generateImage(shot)}
                                title={t('Regenerate')}
                              >
                                {isImgGenerating ? (
                                  <Loader2 className='size-3 animate-spin' />
                                ) : (
                                  <RefreshCw className='size-3' />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              className='shrink-0'
                              disabled={isImgGenerating}
                              onClick={() => void generateImage(shot)}
                            >
                              {isImgGenerating ? (
                                <Loader2
                                  className='mr-1.5 size-3.5 animate-spin'
                                  aria-hidden='true'
                                />
                              ) : (
                                <ImagePlus
                                  className='mr-1.5 size-3.5'
                                  aria-hidden='true'
                                />
                              )}
                              {isImgGenerating
                                ? t('Generating...')
                                : t('Generate Image')}
                            </Button>
                          )
                        ) : shot.image_url ? (
                          <img
                            src={shot.image_url}
                            alt={shot.description}
                            className='size-16 shrink-0 rounded object-cover'
                          />
                        ) : null}

                        {/* Video preview / generate button */}
                        {showVideoGen ? (
                          shot.video_url ? (
                            <div className='relative shrink-0'>
                              <button
                                type='button'
                                className='relative block cursor-pointer rounded'
                                onClick={() =>
                                  setFullscreenVideo({
                                    url: shot.video_url,
                                    poster: shot.image_url || undefined,
                                    label: t('S{{scene}}-{{shot}}', { scene: shot.scene_number, shot: shot.shot_number }),
                                  })
                                }
                                title={t('Click to play video')}
                              >
                                <video
                                  src={shot.video_url}
                                  poster={shot.image_url || undefined}
                                  className='h-16 w-24 rounded object-cover'
                                  muted
                                  preload='metadata'
                                />
                                <Play className='pointer-events-none absolute inset-0 m-auto size-5 text-white drop-shadow-md' />
                              </button>
                              <Button
                                type='button'
                                variant='secondary'
                                size='icon'
                                className='absolute -right-1 -top-1 size-6 opacity-0 shadow-sm group-hover:opacity-100'
                                disabled={isVidGenerating}
                                onClick={() => void generateVideo(shot)}
                                title={t('Regenerate')}
                              >
                                {isVidGenerating ? (
                                  <Loader2 className='size-3 animate-spin' />
                                ) : (
                                  <RefreshCw className='size-3' />
                                )}
                              </Button>
                            </div>
                          ) : (
                            <Button
                              type='button'
                              variant='outline'
                              size='sm'
                              className='shrink-0'
                              disabled={isVidGenerating}
                              onClick={() => void generateVideo(shot)}
                            >
                              {isVidGenerating ? (
                                <Loader2
                                  className='mr-1.5 size-3.5 animate-spin'
                                  aria-hidden='true'
                                />
                              ) : (
                                <Video
                                  className='mr-1.5 size-3.5'
                                  aria-hidden='true'
                                />
                              )}
                              {isVidGenerating
                                ? t('Generating...')
                                : t('Generate Video')}
                            </Button>
                          )
                        ) : null}

                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-7 shrink-0 opacity-0 group-hover:opacity-100'
                            aria-label={t('More actions')}
                          >
                            <MoreHorizontal className='size-4' />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align='end'>
                          <DropdownMenuItem
                            onClick={() => {
                              setCurrentShot(shot)
                              setShotDialog('update')
                            }}
                          >
                            <Pencil className='mr-2 size-4' />
                            {t('Edit')}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className='text-destructive'
                            onClick={() => {
                              setCurrentShot(shot)
                              setShotDialog('delete')
                            }}
                          >
                            <Trash2 className='mr-2 size-4' />
                            {t('Delete')}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    )
                  })}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Post-production checklist */}
          {stageKey === 'post' ? (
            <PostProductionSection
              outputData={stage?.output_data ?? ''}
              projectId={id}
              stageKey={stageKey}
            />
          ) : null}

          {/* Final review gallery */}
          {stageKey === 'review' ? (
            <ReviewGallerySection shots={shots} />
          ) : null}

          {/* Chat messages */}
          {messages.length > 0 ? (
            <div className='mt-6 space-y-4'>
              {messages.map((msg) => (
                <ChatBubble key={msg.id} message={msg} />
              ))}
            </div>
          ) : null}
        </div>
      </ScrollArea>

      {/* Chat input bar for non-script stages */}
      <div className='border-border shrink-0 border-t p-3'>
        <PromptInput
          onSubmit={handleSubmit}
          className='rounded-lg border shadow-sm'
        >
          <PromptInputTextarea
            placeholder={t(placeholder)}
            className='min-h-[40px] resize-none text-sm'
          />
          <PromptInputFooter className='justify-end p-1'>
            {isStreaming ? (
              <Button
                type='button'
                size='icon'
                variant='ghost'
                className='size-7'
                onClick={stopGeneration}
                aria-label={t('Stop')}
              >
                <SquareIcon className='size-4' aria-hidden='true' />
              </Button>
            ) : (
              <PromptInputSubmit className='size-7' />
            )}
          </PromptInputFooter>
        </PromptInput>
      </div>
        </>
      )}

      {/* Character dialogs */}
      <StudioCharacterMutateDrawer
        open={charDialog === 'create' || charDialog === 'update'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setCharDialog(null)
            setCurrentChar(null)
          }
        }}
        projectId={id}
        currentRow={charDialog === 'update' ? (currentChar ?? undefined) : undefined}
      />
      <StudioCharacterDeleteDialog
        open={charDialog === 'delete'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setCharDialog(null)
            setCurrentChar(null)
          }
        }}
        projectId={id}
        character={currentChar}
      />

      {/* Shot dialogs */}
      <StudioShotMutateDrawer
        open={shotDialog === 'create' || shotDialog === 'update'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShotDialog(null)
            setCurrentShot(null)
          }
        }}
        projectId={id}
        currentRow={shotDialog === 'update' ? (currentShot ?? undefined) : undefined}
      />
      <StudioShotDeleteDialog
        open={shotDialog === 'delete'}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setShotDialog(null)
            setCurrentShot(null)
          }
        }}
        projectId={id}
        shot={currentShot}
      />

      {/* Fullscreen video preview dialog */}
      <Dialog
        open={fullscreenVideo !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setFullscreenVideo(null)
        }}
      >
        <DialogContent className='max-w-3xl p-0'>
          {fullscreenVideo ? (
            <div className='flex flex-col'>
              <video
                src={fullscreenVideo.url}
                poster={fullscreenVideo.poster}
                controls
                autoPlay
                className='max-h-[80vh] w-full rounded-t-lg bg-black'
              />
              <div className='px-4 py-2 text-sm text-muted-foreground'>
                {fullscreenVideo.label}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================================
// Post-Production Checklist
// ============================================================================

const POST_CHECKLIST_ITEMS = [
  { key: 'color_grading', labelKey: 'Color Grading' },
  { key: 'sound_design', labelKey: 'Sound Design & Music' },
  { key: 'subtitles', labelKey: 'Subtitles & Captions' },
  { key: 'transitions', labelKey: 'Transitions & Effects' },
  { key: 'final_cut', labelKey: 'Final Cut Assembly' },
] as const

function PostProductionSection(props: {
  outputData: string
  projectId: number
  stageKey: string
}) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { outputData, projectId, stageKey } = props

  const [checked, setChecked] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(outputData || '{}')
    } catch {
      return {}
    }
  })
  const [saving, setSaving] = useState(false)

  const toggleItem = async (key: string) => {
    const next = { ...checked, [key]: !checked[key] }
    setChecked(next)
    setSaving(true)
    try {
      await updateStudioStage(projectId, stageKey, {
        output_data: JSON.stringify(next),
      })
      void queryClient.invalidateQueries({
        queryKey: [...STUDIO_QUERY_KEYS.stages(projectId)],
      })
    } catch {
      // Revert on error
      setChecked(checked)
    } finally {
      setSaving(false)
    }
  }

  const doneCount = POST_CHECKLIST_ITEMS.filter((i) => checked[i.key]).length

  return (
    <div className='space-y-3'>
      <div className='flex items-center justify-between'>
        <h2 className='text-sm font-medium'>
          {t('Post-Production Checklist')} ({doneCount}/{POST_CHECKLIST_ITEMS.length})
        </h2>
        {saving ? (
          <span className='text-muted-foreground animate-pulse text-xs'>
            {t('Saving...')}
          </span>
        ) : null}
      </div>
      <div className='space-y-1.5'>
        {POST_CHECKLIST_ITEMS.map((item) => (
          <label
            key={item.key}
            className='border-border hover:bg-accent/50 flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors'
          >
            <input
              type='checkbox'
              checked={!!checked[item.key]}
              onChange={() => void toggleItem(item.key)}
              className='accent-primary size-4 shrink-0 rounded'
            />
            <span
              className={
                checked[item.key]
                  ? 'text-muted-foreground text-sm line-through'
                  : 'text-sm'
              }
            >
              {t(item.labelKey)}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}

// ============================================================================
// Review Gallery
// ============================================================================

function ReviewGallerySection(props: { shots: StudioShot[] }) {
  const { t } = useTranslation()
  const { shots } = props

  const shotsWithMedia = shots.filter((s) => s.image_url || s.video_url)

  if (shotsWithMedia.length === 0) {
    return (
      <div className='flex h-32 items-center justify-center'>
        <p className='text-muted-foreground text-sm'>
          {t('No generated media yet. Complete the image and video generation stages first.')}
        </p>
      </div>
    )
  }

  return (
    <div className='space-y-3'>
      <h2 className='text-sm font-medium'>
        {t('Generated Media')} ({shotsWithMedia.length})
      </h2>
      <div className='grid gap-3 sm:grid-cols-2 lg:grid-cols-3'>
        {shotsWithMedia.map((shot) => (
          <div
            key={shot.id}
            className='border-border overflow-hidden rounded-lg border'
          >
            {shot.video_url ? (
              <video
                src={shot.video_url}
                poster={shot.image_url || undefined}
                controls
                className='h-40 w-full bg-black object-cover'
                preload='metadata'
              />
            ) : shot.image_url ? (
              <img
                src={shot.image_url}
                alt={shot.description}
                className='h-40 w-full object-cover'
              />
            ) : null}
            <div className='p-2'>
              <p className='text-muted-foreground truncate text-xs'>
                {t('S{{scene}}-{{shot}}: {{desc}}', { scene: shot.scene_number, shot: shot.shot_number, desc: shot.description })}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ChatBubble(props: { message: StageChatMessage }) {
  const { message } = props
  const isUser = message.role === 'user'

  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div
        className={
          isUser
            ? 'bg-primary text-primary-foreground max-w-[80%] rounded-lg px-3 py-2 text-sm'
            : 'max-w-[80%] text-sm'
        }
      >
        {isUser ? (
          message.content
        ) : message.status === 'loading' ? (
          <span className='text-muted-foreground animate-pulse text-xs'>
            ···
          </span>
        ) : message.status === 'error' ? (
          <span className='text-destructive text-xs'>{t(message.content)}</span>
        ) : (
          <div className='prose dark:prose-invert prose-sm'>
            <Markdown>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Script-specific Chat Bubble with "Apply to Script" button
// ============================================================================

function extractScriptBlock(content: string): string | null {
  const match = content.match(/```script\n([\s\S]*?)```/)
  return match?.[1]?.trimEnd() ?? null
}

function ScriptChatBubble(props: {
  message: StageChatMessage
  onApply?: (content: string) => void
}) {
  const { t } = useTranslation()
  const { message, onApply } = props
  const isUser = message.role === 'user'
  const [applied, setApplied] = useState(false)

  const scriptBlock =
    !isUser && message.status === 'complete'
      ? extractScriptBlock(message.content)
      : null

  return (
    <div className={isUser ? 'flex justify-end' : ''}>
      <div
        className={
          isUser
            ? 'bg-primary text-primary-foreground max-w-[80%] rounded-lg px-3 py-2 text-sm'
            : 'max-w-[80%] text-sm'
        }
      >
        {isUser ? (
          message.content
        ) : message.status === 'loading' ? (
          <span className='text-muted-foreground animate-pulse text-xs'>
            ···
          </span>
        ) : message.status === 'error' ? (
          <span className='text-destructive text-xs'>{t(message.content)}</span>
        ) : (
          <div className='prose dark:prose-invert prose-sm'>
            <Markdown>{message.content}</Markdown>
          </div>
        )}
      </div>
      {scriptBlock && onApply ? (
        <div className='mt-1'>
          <Button
            size='sm'
            variant={applied ? 'ghost' : 'outline'}
            className='h-7 gap-1 px-2 text-xs'
            disabled={applied}
            onClick={() => {
              onApply(scriptBlock)
              setApplied(true)
            }}
          >
            <Check className='size-3' aria-hidden='true' />
            {applied ? t('Applied') : t('Apply to Script')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
