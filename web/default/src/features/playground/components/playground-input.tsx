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
  useCallback,
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from 'react'
import {
  PaperclipIcon,
  FileIcon,
  ImageIcon,
  ScreenShareIcon,
  CameraIcon,
  GlobeIcon,
  SendIcon,
  SquareIcon,
  BarChartIcon,
  BoxIcon,
  NotepadTextIcon,
  CodeSquareIcon,
  GraduationCapIcon,
  ListChecksIcon,
  PackagePlusIcon,
  PlusCircleIcon,
  RefreshCwIcon,
  SaveIcon,
  SearchCheckIcon,
  TerminalIcon,
  WandSparklesIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  PromptInputTools,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { Suggestion, Suggestions } from '@/components/ai-elements/suggestion'
import { ModelGroupSelector } from '@/components/model-group-selector'
import type { ModelOption, GroupOption } from '../types'

export type PlaygroundSlashAction = 'new' | 'save' | 'retry' | 'skill'

interface PlaygroundInputProps {
  onSubmit: (text: string) => void
  onStop?: () => void
  disabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  modelValue: string
  onModelChange: (value: string) => void
  isModelLoading?: boolean
  groups: GroupOption[]
  groupValue: string
  onGroupChange: (value: string) => void
  enableSlashCommands?: boolean
  onSlashAction?: (action: PlaygroundSlashAction) => void
}

export function PlaygroundInput({
  onSubmit,
  onStop,
  disabled,
  isGenerating,
  models,
  modelValue,
  onModelChange,
  isModelLoading = false,
  groups,
  groupValue,
  onGroupChange,
  enableSlashCommands = false,
  onSlashAction,
}: PlaygroundInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')
  const [activeCommandIndex, setActiveCommandIndex] = useState(0)

  const suggestions = useMemo(
    () => [
      { icon: BarChartIcon, text: t('Analyze data'), color: '#76d0eb' },
      { icon: BoxIcon, text: t('Surprise me'), color: '#76d0eb' },
      { icon: NotepadTextIcon, text: t('Summarize text'), color: '#ea8444' },
      { icon: CodeSquareIcon, text: t('Code'), color: '#6c71ff' },
      { icon: GraduationCapIcon, text: t('Get advice'), color: '#76d0eb' },
      { icon: null, text: t('More') },
    ],
    [t]
  )

  const slashCommands = useMemo(
    () => [
      {
        icon: PlusCircleIcon,
        command: '/new',
        label: t('New session'),
        description: t('Start a new Hermes conversation'),
        action: 'new' as const,
      },
      {
        icon: SaveIcon,
        command: '/save',
        label: t('Save'),
        description: t('Export the current Hermes conversation'),
        action: 'save' as const,
      },
      {
        icon: RefreshCwIcon,
        command: '/retry',
        label: t('Retry'),
        description: t('Retry the last user request'),
        action: 'retry' as const,
      },
      {
        icon: PackagePlusIcon,
        command: '/skill',
        label: t('Add Hermes skill'),
        description: t('Create a reusable Hermes skill'),
        action: 'skill' as const,
      },
      {
        icon: TerminalIcon,
        command: '/help',
        label: t('Help'),
        description: t('Show Hermes capabilities and usage suggestions'),
        prompt: t(
          'Please list the Hermes capabilities currently available in this session and suggest how I should use them.'
        ),
      },
      {
        icon: ListChecksIcon,
        command: '/plan',
        label: t('Plan'),
        description: t('Create an execution plan before acting'),
        prompt: t(
          'Please make a concise execution plan first, then proceed step by step after confirming the key assumptions.'
        ),
      },
      {
        icon: CodeSquareIcon,
        command: '/code',
        label: t('Code'),
        description: t('Work as a coding agent'),
        prompt: t(
          'Please solve this as a coding task. Inspect the relevant files first, make the smallest safe change, and verify the result.'
        ),
      },
      {
        icon: SearchCheckIcon,
        command: '/review',
        label: t('Review'),
        description: t('Review code or changes'),
        prompt: t(
          'Please review the current change for bugs, regressions, missing tests, and risky assumptions. List findings first.'
        ),
      },
      {
        icon: NotepadTextIcon,
        command: '/summary',
        label: t('Summary'),
        description: t('Summarize the current context'),
        prompt: t(
          'Please summarize the current context, important decisions, open issues, and recommended next steps.'
        ),
      },
      {
        icon: WandSparklesIcon,
        command: '/improve',
        label: t('Improve'),
        description: t('Improve a draft or solution'),
        prompt: t(
          'Please improve this while preserving intent. Make it clearer, more complete, and easier to act on.'
        ),
      },
    ],
    [t]
  )

  const slashQuery = text.startsWith('/') ? text.slice(1).toLowerCase() : ''
  const isSlashCommandOpen =
    enableSlashCommands && text.startsWith('/') && !/\s/.test(text)
  const filteredSlashCommands = useMemo(
    () =>
      slashCommands.filter((item) =>
        `${item.command} ${item.label} ${item.description}`
          .toLowerCase()
          .includes(slashQuery)
      ),
    [slashCommands, slashQuery]
  )

  useEffect(() => {
    setActiveCommandIndex(0)
  }, [slashQuery])

  const isModelSelectDisabled =
    disabled || isModelLoading || models.length === 0
  const isGroupSelectDisabled = disabled || groups.length === 0

  const applySlashCommand = useCallback((prompt: string) => {
    setText(prompt)
  }, [])

  const runSlashAction = useCallback(
    (action: PlaygroundSlashAction) => {
      setText('')
      onSlashAction?.(action)
    },
    [onSlashAction]
  )

  const handleTextareaKeyDown = useCallback(
    (event: KeyboardEvent<HTMLTextAreaElement>) => {
      if (!isSlashCommandOpen || filteredSlashCommands.length === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveCommandIndex((index) =>
          index + 1 >= filteredSlashCommands.length ? 0 : index + 1
        )
        return
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveCommandIndex((index) =>
          index === 0 ? filteredSlashCommands.length - 1 : index - 1
        )
        return
      }

      if (event.key === 'Enter') {
        event.preventDefault()
        const command = filteredSlashCommands[activeCommandIndex]
        if (command?.action) {
          runSlashAction(command.action)
        } else if (command?.prompt) {
          applySlashCommand(command.prompt)
        }
        return
      }

      if (event.key === 'Escape') {
        event.preventDefault()
        setText('')
      }
    },
    [
      activeCommandIndex,
      applySlashCommand,
      filteredSlashCommands,
      isSlashCommandOpen,
      runSlashAction,
    ]
  )

  const handleSubmit = (message: PromptInputMessage) => {
    if (!message.text?.trim() || disabled) return
    onSubmit(message.text)
    setText('')
  }

  const handleFileAction = (action: string) => {
    toast.info(t('Feature in development'), {
      description: action,
    })
  }

  const handleSuggestionClick = (suggestion: string) => {
    onSubmit(suggestion)
  }

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <div className='relative'>
        {isSlashCommandOpen && filteredSlashCommands.length > 0 && (
          <div className='bg-popover text-popover-foreground ring-foreground/10 absolute right-0 bottom-full left-0 z-20 mb-2 overflow-hidden rounded-xl p-1 shadow-lg ring-1'>
            <div className='text-muted-foreground px-2 py-1.5 text-xs font-medium'>
              {t('Hermes commands')}
            </div>
            <div className='max-h-72 overflow-y-auto'>
              {filteredSlashCommands.map((item, index) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.command}
                    type='button'
                    className={`flex w-full items-start gap-2 rounded-lg px-2 py-2 text-left text-sm transition-colors ${
                      index === activeCommandIndex
                        ? 'bg-muted'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => {
                      if (item.action) {
                        runSlashAction(item.action)
                      } else if (item.prompt) {
                        applySlashCommand(item.prompt)
                      }
                    }}
                  >
                    <Icon className='text-muted-foreground mt-0.5 size-4 shrink-0' />
                    <span className='min-w-0 flex-1'>
                      <span className='flex items-center gap-2'>
                        <span className='font-medium'>{item.command}</span>
                        <span className='text-muted-foreground truncate text-xs'>
                          {item.label}
                        </span>
                      </span>
                      <span className='text-muted-foreground mt-0.5 block truncate text-xs'>
                        {item.description}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <PromptInput groupClassName='rounded-xl' onSubmit={handleSubmit}>
          <PromptInputTextarea
            autoComplete='off'
            autoCorrect='off'
            autoCapitalize='off'
            spellCheck={false}
            className='px-5 md:text-base'
            disabled={disabled}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleTextareaKeyDown}
            placeholder={t('Ask anything')}
            value={text}
          />

          <PromptInputFooter className='p-2.5'>
            <PromptInputTools>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <PromptInputButton
                      className='border font-medium'
                      disabled={disabled}
                      variant='outline'
                    />
                  }
                >
                  <PaperclipIcon size={16} />
                  <span className='hidden sm:inline'>{t('Attach')}</span>
                  <span className='sr-only sm:hidden'>{t('Attach')}</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='start'>
                  <DropdownMenuItem
                    onClick={() => handleFileAction('upload-file')}
                  >
                    <FileIcon className='mr-2' size={16} />
                    {t('Upload file')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFileAction('upload-photo')}
                  >
                    <ImageIcon className='mr-2' size={16} />
                    {t('Upload photo')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFileAction('take-screenshot')}
                  >
                    <ScreenShareIcon className='mr-2' size={16} />
                    {t('Take screenshot')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => handleFileAction('take-photo')}
                  >
                    <CameraIcon className='mr-2' size={16} />
                    {t('Take photo')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <PromptInputButton
                className='border font-medium'
                disabled={disabled}
                onClick={() => toast.info(t('Search feature in development'))}
                variant='outline'
              >
                <GlobeIcon size={16} />
                <span className='hidden sm:inline'>{t('Search')}</span>
                <span className='sr-only sm:hidden'>{t('Search')}</span>
              </PromptInputButton>
            </PromptInputTools>

            <div className='flex items-center gap-1.5 md:gap-2'>
              <ModelGroupSelector
                selectedModel={modelValue}
                models={models}
                onModelChange={onModelChange}
                selectedGroup={groupValue}
                groups={groups}
                onGroupChange={onGroupChange}
                disabled={isModelSelectDisabled || isGroupSelectDisabled}
              />

              {isGenerating && onStop ? (
                <PromptInputButton
                  className='text-foreground font-medium'
                  onClick={onStop}
                  variant='secondary'
                >
                  <SquareIcon className='fill-current' size={16} />
                  <span className='hidden sm:inline'>{t('Stop')}</span>
                  <span className='sr-only sm:hidden'>{t('Stop')}</span>
                </PromptInputButton>
              ) : (
                <PromptInputButton
                  className='text-foreground font-medium'
                  disabled={disabled || !text.trim()}
                  type='submit'
                  variant='secondary'
                >
                  <SendIcon size={16} />
                  <span className='hidden sm:inline'>{t('Send')}</span>
                  <span className='sr-only sm:hidden'>{t('Send')}</span>
                </PromptInputButton>
              )}
            </div>
          </PromptInputFooter>
        </PromptInput>
      </div>

      <Suggestions>
        {suggestions.map(({ icon: Icon, text, color }) => (
          <Suggestion
            className={`text-xs font-normal sm:text-sm ${
              text === t('More') ? 'hidden sm:flex' : ''
            }`}
            key={text}
            onClick={() => handleSuggestionClick(text)}
            suggestion={text}
          >
            {Icon && <Icon size={16} style={{ color }} />}
            {text}
          </Suggestion>
        ))}
      </Suggestions>
    </div>
  )
}
