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
import { Link, useParams } from '@tanstack/react-router'
import {
  ArrowLeft,
  ImagePlus,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  SquareIcon,
  Trash2,
  Wand2,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Markdown } from '@/components/ui/markdown'
import { ScrollArea } from '@/components/ui/scroll-area'

import {
  getStudioCharacters,
  getStudioProject,
  getStudioShots,
  getStudioStages,
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
import type { StudioCharacter, StudioShot } from '../types'
import { StudioCharacterDeleteDialog } from './studio-character-delete-dialog'
import { StudioCharacterMutateDrawer } from './studio-character-mutate-drawer'
import { StudioScriptEditor } from './studio-script-editor'
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

  const stageConfig = useMemo(
    () => PIPELINE_STAGES.find((s) => s.key === stageKey),
    [stageKey]
  )

  const { data: projectData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.project(id)],
    queryFn: () => getStudioProject(id),
    enabled: id > 0,
  })

  const { data: stagesData } = useQuery({
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
        stageKey === 'video_gen'),
  })

  const { data: charsData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.characters(id)],
    queryFn: () => getStudioCharacters(id),
    enabled: id > 0 && stageKey === 'characters',
  })

  const { messages, sendMessage, stopGeneration, isStreaming } =
    useStudioStageChat({ projectId: id, stageKey })

  const { generateImage, generatingIds } = useShotImageGen({
    projectId: id,
    styleDna: projectData?.data?.style_dna,
  })
  const { extractCharacters, isExtracting: isExtractingChars } =
    useExtractCharacters(id)
  const { extractShots, isExtracting: isExtractingShots } =
    useExtractShots(id)

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
      sendMessage(text)
    },
    [isStreaming, sendMessage]
  )

  const placeholder =
    STAGE_PLACEHOLDERS[stageKey] ?? 'Ask AI to help with this stage...'

  const showShotsCrud =
    stageKey === 'storyboard' ||
    stageKey === 'image_gen' ||
    stageKey === 'video_gen'

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
      </div>

      {/* Stage content area */}
      <ScrollArea className='flex-1'>
        <div className='mx-auto max-w-4xl p-6'>
          {/* Stage description */}
          {stageConfig ? (
            <p className='text-muted-foreground mb-6 text-sm'>
              {t(stageConfig.descriptionKey)}
            </p>
          ) : null}

          {/* Script editor */}
          {stageKey === 'script' ? (
            <StudioScriptEditor
              projectId={id}
              stageKey={stageKey}
              initialContent={stage?.output_data ?? ''}
            />
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
                  {shots.map((shot) => {
                    const isGenerating = generatingIds.has(shot.id)
                    const showImageGen =
                      stageKey === 'image_gen' || stageKey === 'video_gen'

                    return (
                      <div
                        key={shot.id}
                        className='border-border group flex items-start gap-3 rounded-lg border p-3'
                      >
                        <span className='text-muted-foreground shrink-0 font-mono text-xs'>
                          S{shot.scene_number}-{shot.shot_number}
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
                                disabled={isGenerating}
                                onClick={() => void generateImage(shot)}
                                title={t('Regenerate')}
                              >
                                {isGenerating ? (
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
                              disabled={isGenerating}
                              onClick={() => void generateImage(shot)}
                            >
                              {isGenerating ? (
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
                              {isGenerating
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

                        <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant='ghost'
                            size='icon'
                            className='size-7 shrink-0 opacity-0 group-hover:opacity-100'
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

      {/* Chat input bar */}
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
          <span className='text-destructive text-xs'>{message.content}</span>
        ) : (
          <div className='prose dark:prose-invert prose-sm'>
            <Markdown content={message.content} />
          </div>
        )}
      </div>
    </div>
  )
}
