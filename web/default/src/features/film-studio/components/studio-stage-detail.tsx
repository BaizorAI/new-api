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
  Expand,
  ImagePlus,
  Images,
  Loader2,
  MessageSquare,
  MessageSquareQuote,
  Minimize2,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import {
  createStudioCharacter,
  deleteStudioCharacter,
  getStudioCharacters,
  getStudioProject,
  getStudioShots,
  getStudioStages,
  updateStudioCharacter,
  updateStudioStage,
} from '../api'
import {
  PIPELINE_STAGES,
  STAGE_STATUS,
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
import { sendChatCompletion } from '@/features/playground/api'
import { getImageHistory, submitImageGeneration } from '@/features/image-playground/api'
import { IMAGE_STATUS } from '@/features/image-playground/types'
import type { StudioCharacter, StudioShot } from '../types'
import { StudioScriptEditor, type ScriptEditorHandle, type ScriptEditorSelection } from './studio-script-editor'
import { StudioShotDeleteDialog } from './studio-shot-delete-dialog'
import { StudioShotMutateDrawer } from './studio-shot-mutate-drawer'
import { CharacterChatPanel } from './character-chat-panel'
import { CharactersStage } from './characters-stage'

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
  const queryClient = useQueryClient()
  const { projectId, stageKey } = useParams({
    from: '/_authenticated/studio/$projectId/$stageKey/',
  })
  const id = Number(projectId)

  // Dialog state for characters — sidebar + inline edit mode
  const [selectedCharId, setSelectedCharId] = useState<number | null>(null)
  const [charForm, setCharForm] = useState({
    name: '',
    description: '',
    visual_prompt: '',
    reference_url: '',
    lora_params: '',
  })
  // Shared style prefix for consistent character image generation
  const [styleContext, setStyleContext] = useState<string>('')

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
  const [currentSelection, setCurrentSelection] =
    useState<ScriptEditorSelection | null>(null)
  // Persist selection across the chat round-trip so "Apply to Script"
  // can still target the correct range after the selection banner is dismissed.
  const pendingSelectionRef = useRef<ScriptEditorSelection | null>(null)

  // Pre-defined AI modification types for quick-access buttons
  const MODIFICATION_TYPES = [
    {
      key: 'polish',
      label: t('Polish'),
      icon: Sparkles,
      prompt: '请润色以下段落，使其更加流畅优美：',
    },
    {
      key: 'expand',
      label: t('Expand'),
      icon: Expand,
      prompt: '请扩写以下段落，增加更多细节和描写：',
    },
    {
      key: 'shorten',
      label: t('Shorten'),
      icon: Minimize2,
      prompt: '请精简以下段落，保留核心内容：',
    },
    {
      key: 'rewrite',
      label: t('Rewrite'),
      icon: RefreshCw,
      prompt: '请用不同的方式改写以下段落：',
    },
    {
      key: 'dialogue',
      label: t('Optimize Dialogue'),
      icon: MessageSquare,
      prompt: '请优化以下对白，使其更加自然生动：',
    },
  ]

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

  // AI analyze state — placed before useStudioStageChat so the callback can reference it
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const analysisRef = useRef(false)
  analysisRef.current = !!isAnalyzing

  // Track which character fields are being AI-generated
  const [generatingFields, setGeneratingFields] = useState<Set<string>>(new Set())
  // Track image generation for characters — Set allows concurrent generations
  const [charImageGenIds, setCharImageGenIds] = useState<Set<number>>(() => new Set())
  const charImagePollRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const handleGenerateCharField = useCallback(async (
    char: StudioCharacter,
    field: 'visual_prompt' | 'reference_url' | 'lora_params'
  ) => {
    const key = `${char.id}_${field}`
    setGeneratingFields((prev) => new Set(prev).add(key))

    const systemPrompts: Record<string, string> = {
      visual_prompt:
        `You are a visual design AI for film production. The film project context:\nGenre: ${project?.genre ?? 'unknown'}\nStyle: ${project?.style_dna ?? 'not specified'}\n\nBased on the character name, description, and project context, generate a high-quality English visual prompt for AI image generation (Stable Diffusion / DALL-E). Include: physical appearance, age, clothing style appropriate to the era/setting, facial expression, lighting, camera angle (close-up portrait), and background mood. Output ONLY the prompt text, under 250 characters. Do NOT include explanations.`,
      reference_url:
        `You are a visual design AI for film production. The film project context:\nGenre: ${project?.genre ?? 'unknown'}\nStyle: ${project?.style_dna ?? 'not specified'}\n\nBased on the character name, description, and project context, describe a reference keyframe image: shot composition, setting/location appropriate to the era, color palette, lighting direction, and overall mood. Output ONLY the visual description, under 200 characters.`,
      lora_params:
        `You are a visual design AI for film production. The film project context:\nGenre: ${project?.genre ?? 'unknown'}\nStyle: ${project?.style_dna ?? 'not specified'}\n\nBased on the character name, description, and project context, suggest LoRA parameters for consistent AI character generation. Use format: lora_name:0.8, lora_name2:0.6 — with a one-line explanation. Keep under 150 characters.`,
    }

    try {
      const hermesHeaders: Record<string, string> = {
        'X-Baizor-Playground': 'hermes',
        'X-Baizor-Hermes-Skill-Activate': '/magicalbrush',
      }
      const result = await sendChatCompletion(
        {
          model: 'huayu-drama-4',
          messages: [
            { role: 'system', content: systemPrompts[field] },
            {
              role: 'user',
              content: `Character name: ${char.name}\nDescription: ${char.description || 'No description provided'}`,
            },
          ],
          stream: false,
          temperature: 0.4,
        },
        hermesHeaders
      )
      const content = result?.choices?.[0]?.message?.content?.trim()
      if (content) {
        await updateStudioCharacter(id, char.id, { [field]: content } as Record<string, string>)
        void queryClient.invalidateQueries({ queryKey: [...STUDIO_QUERY_KEYS.characters(id)] })
      }
    } catch { /* silently fail */ }
    finally {
      setGeneratingFields((prev) => {
        const next = new Set(prev)
        next.delete(key)
        return next
      })
    }
  }, [id, queryClient])

  // Generate character reference image — submits visual_prompt to image generation
  // and polls for the result. The visual_prompt should already be refined via MagicalBrush AI.
  const handleGenerateCharImage = useCallback(async (char: StudioCharacter) => {
    const prompt = (styleContext ? `${styleContext}. ` : '') + (charForm.visual_prompt?.trim() || char.description?.trim())
    if (!prompt) {
      toast.warning(t('Add a visual prompt or description first.'))
      return
    }
    if (charImageGenIds.has(char.id)) return // already generating for this character

    // Auto-save before generating
    if (charForm.visual_prompt !== char.visual_prompt) {
      await updateStudioCharacter(id, char.id, { visual_prompt: charForm.visual_prompt } as Record<string, string>)
      void queryClient.invalidateQueries({ queryKey: [...STUDIO_QUERY_KEYS.characters(id)] })
    }

    const key = `${char.id}_reference_url`
    setGeneratingFields((prev) => new Set(prev).add(key))
    setCharImageGenIds((prev) => new Set(prev).add(char.id))

    try {
      const pending = await submitImageGeneration({
        prompt,
        model: 'huayu-drama-4',
        size: '1024x1024',
        quality: 'standard',
        group: 'default',
      })

      // Poll for completion
      let polls = 0
      const MAX_POLLS = 40 // ~2 minutes
      const removeGen = () => {
        setCharImageGenIds((prev) => { const next = new Set(prev); next.delete(char.id); return next })
        setGeneratingFields((prev) => { const next = new Set(prev); next.delete(key); return next })
      }
      const poll = async () => {
        polls++
        if (polls > MAX_POLLS) {
          removeGen()
          toast.error(t('Image generation timed out.'))
          return
        }
        try {
          const history = await getImageHistory(1, 10)
          const record = history.items.find((h) => h.id === pending.id)
          if (!record || record.status === IMAGE_STATUS.PENDING) {
            charImagePollRef.current = setTimeout(() => void poll(), 3000)
            return
          }
          removeGen()
          if (record.status === IMAGE_STATUS.COMPLETED && record.image_url) {
            await updateStudioCharacter(id, char.id, { reference_url: record.image_url } as Record<string, string>)
            void queryClient.invalidateQueries({ queryKey: [...STUDIO_QUERY_KEYS.characters(id)] })
            toast.success(t('Reference image generated.'))
            setCharForm((f) => ({ ...f, reference_url: record.image_url! }))
          } else {
            toast.error(record.error_message || t('Image generation failed.'))
          }
        } catch {
          removeGen()
          toast.error(t('Image generation failed.'))
        }
      }
      charImagePollRef.current = setTimeout(() => void poll(), 3000)
    } catch {
      setCharImageGenIds((prev) => { const next = new Set(prev); next.delete(char.id); return next })
      setGeneratingFields((prev) => { const next = new Set(prev); next.delete(key); return next })
      toast.error(t('Image generation failed.'))
    }
  }, [id, queryClient, charForm.visual_prompt, t])

  const { messages, sendMessage, stopGeneration, clearMessages, deleteMessage, loadingHistory, isStreaming } =
    useStudioStageChat({
      projectId: id,
      stageKey,
      onMessageComplete: (_msgId, _content) => {
        // Stop the analyzing spinner when the AI response completes
        if (analysisRef.current) {
          setIsAnalyzing(false)
        }
      },
    })

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

  const project = projectData?.data
  const stages = stagesData?.data ?? []
  const stage = stages.find((s) => s.key === stageKey)
  const shots = shotsData?.data ?? []
  const characters = charsData?.data ?? []
  const selectedChar = characters.find((c) => c.id === selectedCharId) ?? null

  // Get script text for AI extraction
  const scriptText = useMemo(() => {
    const scriptStage = stages.find((s) => s.key === 'script')
    return scriptStage?.output_data ?? ''
  }, [stages])

  // Auto-init shared style context from project data
  useEffect(() => {
    const dna = project?.style_dna?.trim()
    if (dna && !styleContext) setStyleContext(dna)
  }, [project?.style_dna]) // eslint-disable-line react-hooks/exhaustive-deps

  const statusConfig = stage
    ? STAGE_STATUS_CONFIG[stage.status as StageStatusValue]
    : null

  const handleSubmit = useCallback(
    (message: PromptInputMessage, modificationType?: string) => {
      const text = (message.text ?? '').trim()
      if (!text || isStreaming) return

      // For script stage, inject script content + selection as context
      if (stageKey === 'script') {
        const fullScript = scriptEditorRef.current?.getText() ?? ''
        // Save selection in ref before clearing state — the ref is used
        // by the "Apply to Script" button which fires after the AI responds.
        pendingSelectionRef.current = currentSelection
        sendMessage(text, {
          scriptContext: fullScript || undefined,
          selectionContext: currentSelection?.text ?? undefined,
          paragraphContext: currentSelection?.paragraphIndex != null
            ? {
                index: currentSelection.paragraphIndex,
                text: currentSelection.paragraphText ?? '',
              }
            : undefined,
          modificationType,
        })
        setCurrentSelection(null)
      } else {
        sendMessage(text, { modificationType })
      }
    },
    [isStreaming, sendMessage, stageKey, currentSelection]
  )

  // Sync selected character into the inline edit form
  useEffect(() => {
    if (selectedChar) {
      setCharForm({
        name: selectedChar.name || '',
        description: selectedChar.description || '',
        visual_prompt: selectedChar.visual_prompt || '',
        reference_url: selectedChar.reference_url || '',
        lora_params: selectedChar.lora_params || '',
      })
    }
  }, [selectedCharId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSaveChar = useCallback(async () => {
    if (!selectedCharId || !charForm.name.trim()) return
    try {
      await updateStudioCharacter(id, selectedCharId, charForm)
      void queryClient.invalidateQueries({
        queryKey: [...STUDIO_QUERY_KEYS.characters(id)],
      })
      toast.success(t('Character saved.'))
    } catch {
      toast.error(t('Failed to save character.'))
    }
  }, [id, selectedCharId, charForm, queryClient, t])

  const handleDeleteChar = useCallback(async () => {
    if (!selectedCharId) return
    try {
      await deleteStudioCharacter(id, selectedCharId)
      setSelectedCharId(null)
      void queryClient.invalidateQueries({
        queryKey: [...STUDIO_QUERY_KEYS.characters(id)],
      })
      toast.success(t('Character deleted.'))
    } catch {
      toast.error(t('Failed to delete character.'))
    }
  }, [id, selectedCharId, queryClient, t])

  const handleCreateChar = useCallback(async () => {
    try {
      await createStudioCharacter(id, {
        name: t('New Character'),
        description: '',
        visual_prompt: '',
        reference_url: '',
        lora_params: '',
      })
      void queryClient.invalidateQueries({
        queryKey: [...STUDIO_QUERY_KEYS.characters(id)],
      })
      toast.success(t('Character created.'))
    } catch {
      toast.error(t('Failed to create character.'))
    }
  }, [id, queryClient, t])

  const handleAIAnalyze = useCallback(() => {
    const script = scriptEditorRef.current?.getText() ?? ''
    if (!script.trim()) return
    setIsAnalyzing(true)
    const prompt = `请对以下剧本进行全面分析，评估其是否已准备好进入下一阶段（角色设计和分镜）。请从以下维度评估：
1. 故事结构是否完整
2. 场景描述是否清晰
3. 对话是否自然
4. 是否适合进行角色设计和分镜

请明确给出结论：✅ 可以进入下一阶段，或 ⚠️ 需要修改并说明原因。`

    sendMessage(prompt, {
      scriptContext: script,
      modificationType: 'analyze',
    })
  }, [sendMessage])

  const handleMarkComplete = useCallback(async () => {
    try {
      const result = await updateStudioStage(id, stageKey, {
        status: STAGE_STATUS.COMPLETED,
      })
      if (result.success) {
        toast.success(t('Stage marked as completed.'))
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.project(id)],
        })
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.stages(id)],
        })
      } else {
        toast.error(result.message ?? t('Failed to update stage.'))
      }
    } catch {
      toast.error(t('Failed to update stage.'))
    }
  }, [id, stageKey, t, queryClient])

  // "Start" button — kick off AI script generation and move to In Progress
  const handleStartGeneration = useCallback(() => {
    const brief = project?.brief?.trim()
    if (!brief) return

    // Mark stage as In Progress
    updateStudioStage(id, stageKey, {
      status: STAGE_STATUS.IN_PROGRESS,
    }).then((result) => {
      if (result.success) {
        void queryClient.invalidateQueries({
          queryKey: [...STUDIO_QUERY_KEYS.stages(id)],
        })
      }
    }).catch(() => {})

    const genPrompt = `基于以下项目简报，生成一份完整的影视剧本：

项目名称：${project?.name ?? ''}
类型：${project?.genre ?? ''}
风格关键词：${project?.style_dna ?? ''}

项目简报：
${brief}

请生成一份结构完整的剧本，包括场景标题、动作描述、人物对话，用标准剧本格式。用 \`\`\`script 代码块包裹完整剧本。`

    sendMessage(genPrompt, {
      scriptContext: brief,
      modificationType: 'generate',
    })
  }, [id, stageKey, project, sendMessage, queryClient])

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

        {/* Header action buttons — ordered by workflow */}
        <div className='flex items-center gap-2'>
          {/* Step 1: AI Analyze */}
          {STAGE_SKILL_MAP[stageKey] ? (
            <Button
              size='sm'
              variant='outline'
              disabled={isAnalyzing || isStreaming}
              onClick={() => handleAIAnalyze()}
              title={t('AI analyzes the script and gives a readiness recommendation.')}
            >
              {isAnalyzing ? (
                <Loader2 className='mr-1.5 size-3.5 animate-spin' />
              ) : (
                <Sparkles className='mr-1.5 size-3.5' />
              )}
              {isAnalyzing ? t('Analyzing...') : t('AI Analyze')}
            </Button>
          ) : null}

          {/* Character stage: Step 2 → AI Extract, Step 3 → Style, Step 4 → Generate All, Step 5 → Add */}
          {stageKey === 'characters' ? (
            <>
              <Button
                size='sm'
                variant='outline'
                disabled={!scriptText.trim() || isExtractingChars}
                onClick={() => void extractCharacters(scriptText, characters.map(c => c.name))}
              >
                {isExtractingChars ? (
                  <Loader2 className='mr-1.5 size-3.5 animate-spin' />
                ) : (
                  <Wand2 className='mr-1.5 size-3.5' />
                )}
                {isExtractingChars ? t('Extracting...') : t('AI Extract')}
              </Button>

              <div className='flex items-center gap-1'>
                <Input
                  value={styleContext}
                  onChange={(e) => setStyleContext(e.target.value)}
                  placeholder={t('Image style context (shared prefix for all characters)')}
                  className='h-7 w-48 text-[11px]'
                />
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-7 w-7 p-0'
                  disabled={!scriptText.trim()}
                  onClick={async () => {
                    const hermesHeaders: Record<string, string> = {
                      'X-Baizor-Playground': 'hermes',
                      'X-Baizor-Hermes-Skill-Activate': '/magicalbrush',
                    }
                    try {
                      const result = await sendChatCompletion({
                        model: 'huayu-v2',
                        messages: [
                          { role: 'system', content: 'Extract the era, region, and visual style of this screenplay. Output ONLY a short comma-separated style context for AI image generation. Example: "Ancient China, Tang Dynasty, ink painting style, flowing silk robes". Keep under 120 characters.' },
                          { role: 'user', content: scriptText.slice(0, 3000) },
                        ],
                        stream: false,
                        temperature: 0.3,
                      }, hermesHeaders)
                      const content = result?.choices?.[0]?.message?.content?.trim()
                      if (content) setStyleContext(content)
                    } catch { /* ignore */ }
                  }}
                  title={t('AI analyze era and style')}
                >
                  <Sparkles className='size-3.5' />
                </Button>
              </div>

              <Button
                size='sm'
                variant='outline'
                disabled={characters.length === 0}
                onClick={() => {
                  for (const c of characters) {
                    if (c.visual_prompt?.trim() && !charImageGenIds.has(c.id)) {
                      void handleGenerateCharImage(c)
                    }
                  }
                }}
              >
                <Images className='mr-1.5 size-3.5' />
                {t('Generate All')}
              </Button>

              <Button size='sm' variant='outline' onClick={handleCreateChar}>
                <Plus className='mr-1.5 size-3.5' />
                {t('Add Character')}
              </Button>
            </>
          ) : null}

          {/* Shots: AI Extract + Add */}
          {showShotsCrud ? (
            <>
              {stageKey === 'storyboard' ? (
                <Button size='sm' variant='outline' disabled={!scriptText.trim() || isExtractingShots}
                  onClick={() => void extractShots(scriptText)}>
                  {isExtractingShots ? <Loader2 className='mr-1.5 size-3.5 animate-spin' /> : <Wand2 className='mr-1.5 size-3.5' />}
                  {isExtractingShots ? t('Extracting...') : t('AI Extract')}
                </Button>
              ) : null}
              <Button size='sm' variant='outline' onClick={() => { setCurrentShot(null); setShotDialog('create') }}>
                <Plus className='mr-1.5 size-3.5' />{t('Add Shot')}
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Stage content area — script stage gets side-by-side layout */}
      {stageKey === 'script' ? (
        <ResizablePanelGroup orientation='horizontal' className='min-h-0 flex-1'>
          {/* Left panel: Script editor */}
          <ResizablePanel defaultSize={55} minSize={30} className='flex flex-col'>
            <div className='flex min-h-0 flex-1 flex-col px-6 pt-6'>
              {stageConfig ? (
                <p className='text-muted-foreground mb-4 shrink-0 text-sm'>
                  {t(stageConfig.descriptionKey)}
                </p>
              ) : null}
              {/* Start button — kick off AI generation from project brief */}
              {stageKey === 'script' &&
              stage?.status === STAGE_STATUS.NOT_STARTED &&
              project?.brief?.trim() ? (
                <div className='bg-primary/5 border-primary/20 mb-4 flex items-center gap-4 rounded-lg border px-4 py-3'>
                  <div className='min-w-0 flex-1'>
                    <p className='text-sm font-medium'>
                      {t('Ready to start?')}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {t('AI will generate an initial script based on your project brief.')}
                    </p>
                  </div>
                  <Button
                    size='sm'
                    onClick={() => handleStartGeneration()}
                    disabled={isStreaming}
                  >
                    <Play className='mr-1.5 size-3.5' aria-hidden='true' />
                    {t('Start')}
                  </Button>
                </div>
              ) : null}
              <StudioScriptEditor
                ref={scriptEditorRef}
                projectId={id}
                stageKey={stageKey}
                initialContent={stage?.output_data ?? ''}
                onSelectionChange={setCurrentSelection}
              />
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right panel: AI Chat */}
          <ResizablePanel defaultSize={45} minSize={25} className='flex flex-col'>
            <div className='flex h-full flex-col'>
              {/* MagicBrush skill indicator */}
              {stageKey === 'script' ? (
                <div className='border-border flex items-center gap-2 border-b px-4 py-2'>
                  <span className='flex items-center gap-1.5 rounded-md bg-purple-500/10 px-2 py-0.5 text-xs font-medium text-purple-600 dark:text-purple-400'>
                    <Wand2 className='size-3' aria-hidden='true' />
                    MagicalBrush
                  </span>
                  <span className='text-muted-foreground text-xs'>
                    {t('Skill active: MagicalBrush')}
                  </span>
                </div>
              ) : STAGE_SKILL_MAP[stageKey] ? (
                <div className='border-border flex items-center gap-2 border-b px-4 py-2'>
                  <span className='flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary'>
                    <Bot className='size-3' aria-hidden='true' />
                    {STAGE_SKILL_MAP[stageKey]}
                  </span>
                </div>
              ) : null}
              {/* Chat header bar */}
              <div className='border-border flex shrink-0 items-center justify-between border-b px-4 py-1.5'>
                <span className='text-muted-foreground text-[11px]'>
                  {t('Chat History')}
                </span>
                {messages.length > 0 ? (
                  <Button
                    size='sm'
                    variant='ghost'
                    className='text-muted-foreground hover:text-destructive h-6 gap-1 px-1.5 text-[11px]'
                    onClick={() => clearMessages()}
                  >
                    <Trash2 className='size-3' aria-hidden='true' />
                    {t('Clear all')}
                  </Button>
                ) : null}
              </div>
              {/* Chat messages with auto-scroll */}
              <Conversation className='min-h-0 flex-1'>
                <ConversationContent className='space-y-4'>
                  {loadingHistory ? (
                    <ConversationEmptyState
                      title={t('Loading...')}
                      description=''
                      icon={<Loader2 className='size-8 animate-spin' />}
                    />
                  ) : messages.length === 0 ? (
                    <ConversationEmptyState
                      title={t('Script Assistant')}
                      description={t(
                        'AI powered by MagicalBrush will modify your script based on the response.'
                      )}
                      icon={<Wand2 className='size-8' />}
                    />
                  ) : (
                    messages.map((msg) => (
                      <ScriptChatBubble
                        key={msg.id}
                        message={msg}
                        onApply={(content) => {
                          const sel = pendingSelectionRef.current
                          if (sel) {
                            scriptEditorRef.current?.replaceRange(
                              sel.start,
                              sel.end,
                              content
                            )
                            pendingSelectionRef.current = null
                          } else {
                            scriptEditorRef.current?.setText(content)
                          }
                        }}
                        onRewrite={(analysisContent) => {
                          // Follow-up: ask AI to rewrite the script based on analysis
                          const fullScript = scriptEditorRef.current?.getText() ?? ''
                          sendMessage(
                            '请根据以上分析建议，重写完整剧本。保留所有改进点，用 ```script 代码块包裹修改后的完整剧本。',
                            {
                              scriptContext: fullScript || undefined,
                              modificationType: 'rewrite_from_analysis',
                            }
                          )
                        }}
                        onComplete={() => void handleMarkComplete()}
                        onDelete={() => deleteMessage(msg.id)}
                      />
                    ))
                  )}
                </ConversationContent>
                <ConversationScrollButton />
              </Conversation>

              {/* Selection banner */}
              {currentSelection?.text ? (
                <>
                  <div className='bg-muted/50 flex items-center gap-2 border-t px-3 py-1.5'>
                    <MessageSquareQuote className='text-muted-foreground size-3.5 shrink-0' />
                    <span className='text-muted-foreground min-w-0 flex-1 truncate text-xs'>
                      {currentSelection.paragraphIndex != null
                        ? t('Selected paragraph {{index}}', {
                            index: currentSelection.paragraphIndex + 1,
                          })
                        : t('Selected: "{{text}}"', {
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
                  {/* Modification type quick-actions */}
                  <div className='border-border flex flex-wrap items-center gap-1 border-t px-3 py-2'>
                    <span className='text-muted-foreground mr-1 text-[10px] uppercase tracking-wider'>
                      {t('Modify with AI')}
                    </span>
                    {MODIFICATION_TYPES.map((mt) => {
                      const Icon = mt.icon
                      return (
                        <Button
                          key={mt.key}
                          size='sm'
                          variant='outline'
                          className='h-6 gap-1 px-2 text-[11px]'
                          disabled={isStreaming}
                          onClick={() => {
                            const selectionText = currentSelection.text
                            const promptText = `${mt.prompt}\n\n${selectionText}`
                            handleSubmit(
                              { text: promptText } as PromptInputMessage,
                              mt.key
                            )
                          }}
                        >
                          <Icon className='size-3' aria-hidden='true' />
                          {mt.label}
                        </Button>
                      )
                    })}
                  </div>
                </>
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
          {/* Characters stage: full-width left-aligned with split layout */}
{stageKey === 'characters' ? (
  <CharactersStage projectId={id} stageKey={stageKey} scriptText={scriptText} project={project}
    messages={messages} loadingHistory={loadingHistory} isStreaming={isStreaming}
    placeholder={placeholder} onClearMessages={clearMessages} onDeleteMessage={deleteMessage}
    onSubmit={handleSubmit} onStopGeneration={stopGeneration}
  />
          ) : (
            /* Other non-script stages */
            <ScrollArea className='min-h-0 flex-1'>
              <div className='mx-auto max-w-4xl p-6'>
                {stageConfig ? (
                  <p className='text-muted-foreground mb-6 text-sm'>
                    {t(stageConfig.descriptionKey)}
                  </p>
                ) : null}
              </div>
            </ScrollArea>
          )}

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

          {stageKey !== 'characters' ? (
            <CharacterChatPanel
              messages={messages}
              loadingHistory={loadingHistory}
              isStreaming={isStreaming}
              placeholder={placeholder}
              onClearMessages={clearMessages}
              onDeleteMessage={deleteMessage}
              onSubmit={handleSubmit}
              onStopGeneration={stopGeneration}
            />
          ) : null}
        </>
      )}

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
  // Try targeted paragraph revision first
  const paraMatch = content.match(/```revised-paragraph\s*\n([\s\S]*?)```/)
  if (paraMatch?.[1]?.trimEnd()) return paraMatch[1].trimEnd()
  // Fallback to full script block
  const scriptMatch = content.match(/```script\s*\n([\s\S]*?)```/)
  return scriptMatch?.[1]?.trimEnd() ?? null
}

function isAnalysisMessage(content: string): boolean {
  // Analysis messages contain ✅ or ⚠️ markers with recommendations,
  // and do NOT contain a script/revised-paragraph code block.
  if (extractScriptBlock(content)) return false
  return /✅|⚠️/.test(content)
}

function ScriptChatBubble(props: {
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
        {/* Delete button — shown on hover */}
        {onDelete ? (
          <button
            type='button'
            className='text-muted-foreground hover:text-destructive absolute right-1 top-1 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100'
            onClick={onDelete}
            aria-label={t('Delete')}
          >
            <X className='size-3' />
          </button>
        ) : null}
      </div>
      {/* Script block → "Apply to Script" + "Complete Stage" */}
      {scriptBlock && onApply && !isAnalysis ? (
        <div className='mt-1 flex items-center gap-1.5'>
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
          {onComplete ? (
            <Button
              size='sm'
              variant={completed ? 'ghost' : 'default'}
              className='h-7 gap-1 px-2 text-xs'
              disabled={completed}
              onClick={() => {
                onComplete()
                setCompleted(true)
              }}
            >
              <Check className='size-3' aria-hidden='true' />
              {completed ? t('Done') : t('Complete Stage')}
            </Button>
          ) : null}
        </div>
      ) : null}
      {/* Analysis → "Rewrite with Suggestions" + "Complete Stage" */}
      {isAnalysis && onRewrite ? (
        <div className='mt-1 flex items-center gap-1.5'>
          <Button
            size='sm'
            variant={applied ? 'ghost' : 'outline'}
            className='h-7 gap-1 px-2 text-xs'
            disabled={applied}
            onClick={() => {
              onRewrite(message.content)
              setApplied(true)
            }}
          >
            <RefreshCw className='size-3' aria-hidden='true' />
            {applied ? t('Rewriting...') : t('Rewrite with Suggestions')}
          </Button>
          {analysisPassed && onComplete ? (
            <Button
              size='sm'
              variant={completed ? 'ghost' : 'default'}
              className='h-7 gap-1 px-2 text-xs'
              disabled={completed}
              onClick={() => {
                onComplete()
                setCompleted(true)
              }}
            >
              <Check className='size-3' aria-hidden='true' />
              {completed ? t('Done') : t('Complete Stage')}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
