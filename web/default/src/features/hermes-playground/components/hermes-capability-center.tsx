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
import { formatRelativeTime, formatTimestamp } from '@/lib/format'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowBigUpIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  ChevronRightIcon,
  CopyIcon,
  MessageSquareIcon,
  MoreHorizontalIcon,
  PackagePlusIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  WrenchIcon,
  XCircleIcon,
  XIcon,
} from 'lucide-react'
import { type ReactNode, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Team } from '@/features/teams/types'
import { useAuthStore } from '@/stores/auth-store'

import { cn } from '@/lib/utils'

import {
  deleteHermesSkill,
  promoteHermesSkill,
  listHermesSkills,
  listHermesToolsets,
  type HermesSkill,
  type HermesToolset,
} from '../api'
import type { HermesCapabilitySection } from '../lib/workspace-panel-controller'

type HermesCapabilityTab = 'skills' | 'tools'

interface HermesCapabilityCenterProps {
  open: boolean
  userScope: string
  initialCategory?: string
  initialSection?: HermesCapabilitySection
  selectedTeamId: number
  selectedTeamName?: string
  teams: Team[]
  onOpenChange: (open: boolean) => void
  onAddSkill: () => void
  onUseSkill: (skill: HermesSkill) => void
  onEditSkill: (skill: HermesSkill, teamId?: number) => void
}

type HermesCapabilityCenterWorkspaceProps = Omit<
  HermesCapabilityCenterProps,
  'open' | 'onOpenChange'
>

const EMPTY_SKILLS: HermesSkill[] = []
const EMPTY_TOOLSETS: HermesToolset[] = []
const ADMIN_MIN_ROLE = 10
const ASCII_LETTER_PATTERN = /[A-Za-z]/
const CJK_PATTERN = /[\u3400-\u9fff]/

type SkillPublishOptions = {
  target: 'baizor' | 'team' | 'system'
  sourceScope: 'user' | 'team' | 'baizor'
  teamId?: number
  teamName?: string
}

type ToolsetStatusFilter =
  | 'all'
  | 'enabled'
  | 'disabled'
  | 'configured'
  | 'unconfigured'

export function HermesCapabilityCenter(props: HermesCapabilityCenterProps) {
  const { t } = useTranslation()

  return (
    <HermesCapabilityCenterContent
      {...props}
      isActive={props.open}
      renderFrame={(content) => (
        <Sheet open={props.open} onOpenChange={props.onOpenChange}>
          <SheetContent className='w-full gap-0 sm:max-w-xl' side='right'>
            <SheetHeader className='border-b pr-12'>
              <SheetTitle>{t('Hermes capabilities')}</SheetTitle>
              <SheetDescription>
                {t(
                  'Manage reusable skills and inspect available Hermes tools.'
                )}
              </SheetDescription>
            </SheetHeader>
            {content}
          </SheetContent>
        </Sheet>
      )}
    />
  )
}

export function HermesCapabilityCenterWorkspace(
  props: HermesCapabilityCenterWorkspaceProps
) {
  const { t } = useTranslation()

  return (
    <div className='bg-background flex h-full min-h-[calc(100vh-var(--app-header-height,0px))] flex-col'>
      <header className='border-b px-4 py-4 sm:px-6'>
        <div className='max-w-5xl space-y-1'>
          <h1 className='text-lg font-semibold tracking-tight'>
            {t('Hermes capabilities')}
          </h1>
          <p className='text-muted-foreground text-sm'>
            {t('Manage reusable skills and inspect available Hermes tools.')}
          </p>
        </div>
      </header>
      <HermesCapabilityCenterContent
        {...props}
        isActive
        renderFrame={(content) => (
          <div className='flex min-h-0 flex-1 flex-col'>{content}</div>
        )}
      />
    </div>
  )
}

function HermesCapabilityCenterContent(
  props: HermesCapabilityCenterWorkspaceProps & {
    isActive: boolean
    renderFrame: (content: ReactNode) => ReactNode
  }
) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<HermesCapabilityTab>(() =>
    getInitialCapabilityTab(props.initialSection)
  )
  const [skillSearch, setSkillSearch] = useState(() =>
    getInitialSkillSearch(props.initialCategory)
  )
  const [toolsetSearch, setToolsetSearch] = useState('')
  const [toolsetStatusFilter, setToolsetStatusFilter] =
    useState<ToolsetStatusFilter>('all')
  const [deletingSkill, setDeletingSkill] = useState<HermesSkill | null>(null)
  const [activeTeamId, setActiveTeamId] = useState(
    () => props.selectedTeamId || props.teams[0]?.id || 0
  )
  const role = useAuthStore((s) => s.auth.user?.role ?? 0)

  useEffect(() => {
    if (!props.isActive) return
    setActiveTab(getInitialCapabilityTab(props.initialSection))
    setSkillSearch(getInitialSkillSearch(props.initialCategory))
  }, [props.initialCategory, props.initialSection, props.isActive])

  const activeTeamName = useMemo(() => {
    if (activeTeamId === props.selectedTeamId && props.selectedTeamName) {
      return props.selectedTeamName
    }
    return (
      props.teams.find((team) => team.id === activeTeamId)?.name.trim() || ''
    )
  }, [activeTeamId, props.selectedTeamId, props.selectedTeamName, props.teams])

  useEffect(() => {
    const selectedTeamExists = props.teams.some(
      (team) => team.id === props.selectedTeamId
    )
    if (
      props.selectedTeamId > 0 &&
      selectedTeamExists &&
      activeTeamId !== props.selectedTeamId
    ) {
      setActiveTeamId(props.selectedTeamId)
      return
    }

    const activeTeamExists = props.teams.some(
      (team) => team.id === activeTeamId
    )
    if (activeTeamId > 0 && activeTeamExists) return

    const fallbackTeamId = props.teams[0]?.id || 0
    if (activeTeamId !== fallbackTeamId) {
      setActiveTeamId(fallbackTeamId)
    }
  }, [activeTeamId, props.selectedTeamId, props.teams])

  const skillsQuery = useQuery({
    queryKey: [
      'hermes-capabilities',
      props.userScope,
      'skills',
      activeTeamId,
      activeTeamName,
    ],
    queryFn: () =>
      listHermesSkills({
        teamId: activeTeamId || undefined,
        teamName: activeTeamName || undefined,
      }),
    enabled: props.isActive,
  })
  const toolsetsQuery = useQuery({
    queryKey: ['hermes-capabilities', props.userScope, 'toolsets'],
    queryFn: listHermesToolsets,
    enabled: props.isActive,
  })

  const skills = skillsQuery.data ?? EMPTY_SKILLS
  const userSkills = useMemo(
    () =>
      filterSkills(
        skills.filter(
          (skill) =>
            skill.isUserCreated ||
            skill.source === 'user' ||
            skill.ownerScope === 'user'
        ),
        skillSearch
      ),
    [skillSearch, skills]
  )
  const teamSkills = useMemo(
    () =>
      filterSkills(
        skills.filter(
          (skill) => skill.source === 'team' || skill.ownerScope === 'team'
        ),
        skillSearch
      ),
    [skillSearch, skills]
  )
  const baizorSkills = useMemo(
    () =>
      filterSkills(
        skills.filter(
          (skill) => skill.source === 'baizor' || skill.ownerScope === 'baizor'
        ),
        skillSearch
      ),
    [skillSearch, skills]
  )
  const jilaiSkills = useMemo(
    () =>
      filterSkills(
        skills.filter(
          (skill) =>
            skill.source === 'external' || skill.ownerScope === 'external'
        ),
        skillSearch
      ),
    [skillSearch, skills]
  )
  const systemSkills = useMemo(
    () =>
      filterSkills(
        skills.filter(
          (skill) =>
            skill.source !== 'user' &&
            skill.source !== 'team' &&
            skill.source !== 'baizor' &&
            skill.source !== 'external' &&
            skill.ownerScope !== 'user' &&
            skill.ownerScope !== 'team' &&
            skill.ownerScope !== 'baizor' &&
            skill.ownerScope !== 'external'
        ),
        skillSearch
      ),
    [skillSearch, skills]
  )
  const toolsets = useMemo(
    () =>
      filterToolsets(
        toolsetsQuery.data ?? EMPTY_TOOLSETS,
        toolsetSearch,
        toolsetStatusFilter
      ),
    [toolsetSearch, toolsetStatusFilter, toolsetsQuery.data]
  )
  const manageableTeams = useMemo(
    () => props.teams.filter((team) => canManageTeam(team.role)),
    [props.teams]
  )

  const refresh = () => {
    void skillsQuery.refetch()
    void toolsetsQuery.refetch()
  }

  const handleDeleteSkill = async () => {
    if (!deletingSkill) return
    try {
      await deleteHermesSkill(deletingSkill.name, {
        teamId: getSkillTeamId(deletingSkill, activeTeamId),
      })
      toast.success(t('Skill deleted'))
      setDeletingSkill(null)
      refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to delete skill')
      )
    }
  }

  const handlePublishSkill = async (
    skill: HermesSkill,
    options: SkillPublishOptions
  ) => {
    try {
      await promoteHermesSkill(skill.name, options)
      if (options.target === 'team' && options.teamId) {
        setActiveTeamId(options.teamId)
      }
      toast.success(t('Skill published'))
      refresh()
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t('Failed to publish skill')
      )
    }
  }

  const isSysAdmin = role >= ADMIN_MIN_ROLE
  const isActiveTeamAdmin = useMemo(() => {
    const activeTeam = props.teams.find((team) => team.id === activeTeamId)
    return activeTeam ? canManageTeam(activeTeam.role) : false
  }, [activeTeamId, props.teams])
  const isAdmin = isSysAdmin || isActiveTeamAdmin

  return (
    <>
      {props.renderFrame(
        <Tabs
          className='min-h-0 flex-1 gap-0'
          value={activeTab}
          onValueChange={(value) =>
            setActiveTab(value === 'tools' ? 'tools' : 'skills')
          }
        >
          <div className='flex items-center justify-between gap-2 border-b px-4 py-3'>
            <TabsList className='w-fit'>
              <TabsTrigger value='skills'>{t('Skills')}</TabsTrigger>
              <TabsTrigger value='tools'>{t('Tools')}</TabsTrigger>
            </TabsList>
            <Button
              aria-label={t('Refresh Hermes capabilities')}
              onClick={refresh}
              size='icon-sm'
              type='button'
              variant='ghost'
            >
              <RefreshCwIcon className='size-4' />
            </Button>
          </div>

          <TabsContent className='min-h-0' value='skills'>
            <SkillPanel
              error={skillsQuery.error}
              isLoading={skillsQuery.isLoading}
              isAdmin={isAdmin}
              onAddSkill={props.onAddSkill}
              onUseSkill={props.onUseSkill}
              onDeleteSkill={setDeletingSkill}
              onEditSkill={props.onEditSkill}
              manageableTeams={manageableTeams}
              teams={props.teams}
              activeTeamId={activeTeamId}
              initialSection={props.initialSection}
              onActiveTeamChange={setActiveTeamId}
              selectedTeamId={activeTeamId}
              selectedTeamName={activeTeamName}
              onPublishSkill={handlePublishSkill}
              search={skillSearch}
              setSearch={setSkillSearch}
              baizorSkills={baizorSkills}
              jilaiSkills={jilaiSkills}
              systemSkills={systemSkills}
              teamSkills={teamSkills}
              userSkills={userSkills}
            />
          </TabsContent>

          <TabsContent className='min-h-0' value='tools'>
            <ToolPanel
              error={toolsetsQuery.error}
              isLoading={toolsetsQuery.isLoading}
              search={toolsetSearch}
              setSearch={setToolsetSearch}
              statusFilter={toolsetStatusFilter}
              setStatusFilter={setToolsetStatusFilter}
              toolsets={toolsets}
            />
          </TabsContent>
        </Tabs>
      )}

      <Dialog
        open={Boolean(deletingSkill)}
        onOpenChange={(open) => {
          if (!open) setDeletingSkill(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Delete skill')}</DialogTitle>
          </DialogHeader>
          <p className='text-muted-foreground text-sm'>
            {t('Are you sure you want to delete skill "{{name}}"?', {
              name: deletingSkill?.name ?? '',
            })}
          </p>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setDeletingSkill(null)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              variant='destructive'
              onClick={handleDeleteSkill}
            >
              {t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

interface SkillPanelProps {
  userSkills: HermesSkill[]
  teamSkills: HermesSkill[]
  baizorSkills: HermesSkill[]
  jilaiSkills: HermesSkill[]
  systemSkills: HermesSkill[]
  search: string
  setSearch: (value: string) => void
  isLoading: boolean
  error: Error | null
  isAdmin: boolean
  onAddSkill: () => void
  onUseSkill: (skill: HermesSkill) => void
  onEditSkill: (skill: HermesSkill, teamId?: number) => void
  onDeleteSkill: (skill: HermesSkill) => void
  manageableTeams: Team[]
  teams: Team[]
  activeTeamId: number
  initialSection?: HermesCapabilitySection
  onActiveTeamChange: (teamId: number) => void
  selectedTeamId: number
  selectedTeamName: string
  onPublishSkill: (skill: HermesSkill, options: SkillPublishOptions) => void
}

function SkillPanel(props: SkillPanelProps) {
  const { t } = useTranslation()

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='space-y-3 border-b p-4'>
        <div className='flex items-center gap-2'>
          <div className='relative min-w-0 flex-1'>
            <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
            <Input
              className='pl-8'
              onChange={(event) => props.setSearch(event.target.value)}
              placeholder={t('Search skills')}
              value={props.search}
            />
          </div>
          <Button onClick={props.onAddSkill} type='button'>
            <PackagePlusIcon className='size-4' />
            {t('Add skill')}
          </Button>
        </div>
        {props.teams.length > 0 && (
          <div className='flex items-center gap-2'>
            <span className='text-muted-foreground shrink-0 text-xs'>
              {t('Team context')}
            </span>
            <Select
              value={String(props.activeTeamId || props.teams[0]?.id || 0)}
              onValueChange={(value) => {
                props.onActiveTeamChange(Number(value) || 0)
              }}
            >
              <SelectTrigger
                aria-label={t('Team context')}
                className='h-8 min-w-0 flex-1 sm:max-w-[260px]'
              >
                <SelectValue placeholder={t('Select team')} />
              </SelectTrigger>
              <SelectContent align='start'>
                {props.teams.map((team) => (
                  <SelectItem key={team.id} value={String(team.id)}>
                    <span className='min-w-0 truncate'>{team.name}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className='flex flex-wrap gap-1.5'>
          {getSkillCategoryOptions(t).map((option) => (
            <Button
              aria-pressed={props.search === option.query}
              key={option.query || 'all'}
              onClick={() => props.setSearch(option.query)}
              size='xs'
              type='button'
              variant={props.search === option.query ? 'secondary' : 'outline'}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className='flex min-h-0 flex-1'>
        <ScrollArea className='min-h-0 flex-1'>
          <div className='space-y-4 p-3'>
            {props.error && (
              <CapabilityError
                message={getErrorMessage(
                  props.error,
                  t('Failed to load Hermes skills')
                )}
              />
            )}
            {props.isLoading && <LoadingRows />}
            {!props.isLoading &&
              !props.error &&
              getOrderedSkillSections(props, t).map((section) => (
                <SkillSection
                  emptyDescription={section.emptyDescription}
                  emptyTitle={section.emptyTitle}
                  isAdmin={props.isAdmin}
                  isFocused={section.isFocused}
                  key={section.id}
                  manageableTeams={props.manageableTeams}
                  onDeleteSkill={props.onDeleteSkill}
                  onEditSkill={props.onEditSkill}
                  onPublishSkill={props.onPublishSkill}
                  onUseSkill={props.onUseSkill}
                  selectedTeamId={props.selectedTeamId}
                  selectedTeamName={props.selectedTeamName}
                  skills={section.skills}
                  title={section.title}
                />
              ))}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

interface SkillSectionProps {
  title: string
  skills: HermesSkill[]
  emptyTitle: string
  emptyDescription: string
  isFocused?: boolean
  isAdmin: boolean
  onUseSkill: (skill: HermesSkill) => void
  onEditSkill: (skill: HermesSkill, teamId?: number) => void
  onDeleteSkill: (skill: HermesSkill) => void
  manageableTeams: Team[]
  selectedTeamId: number
  selectedTeamName: string
  onPublishSkill: (skill: HermesSkill, options: SkillPublishOptions) => void
}

function SkillSection(props: SkillSectionProps) {
  const { t } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <section>
      <button
        className='hover:bg-muted/60 flex w-full items-center gap-1 rounded px-1 py-1.5 transition-colors'
        onClick={() => setIsExpanded((v) => !v)}
        type='button'
      >
        <ChevronRightIcon
          className={cn(
            'text-muted-foreground size-3.5 shrink-0 transition-transform',
            isExpanded && 'rotate-90'
          )}
        />
        <span className='text-muted-foreground min-w-0 flex-1 truncate text-left text-xs font-medium uppercase tracking-wide'>
          {props.title}
        </span>
        {props.isFocused && <Badge variant='secondary'>{t('Current')}</Badge>}
        <span className='text-muted-foreground shrink-0 text-xs'>
          {props.skills.length}
        </span>
      </button>

      {isExpanded && (
        <div className='ml-3 border-l'>
          {props.skills.length === 0 ? (
            <div className='px-3 py-1.5'>
              <CompactEmpty
                description={props.emptyDescription}
                title={props.emptyTitle}
              />
            </div>
          ) : (
            <div className='space-y-0.5 py-0.5 pl-1'>
              {props.skills.map((skill) => (
                <SkillNodeItem
                  isAdmin={props.isAdmin}
                  key={`${skill.source}-${skill.path ?? skill.name}`}
                  manageableTeams={props.manageableTeams}
                  onDeleteSkill={props.onDeleteSkill}
                  onEditSkill={props.onEditSkill}
                  onPublishSkill={props.onPublishSkill}
                  onUseSkill={props.onUseSkill}
                  selectedTeamId={props.selectedTeamId}
                  selectedTeamName={props.selectedTeamName}
                  skill={skill}
                  time={skill.updatedAt}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  )
}

function SkillNodeItem(props: {
  skill: HermesSkill
  isAdmin: boolean
  onUseSkill: (skill: HermesSkill) => void
  onEditSkill: (skill: HermesSkill, teamId?: number) => void
  onDeleteSkill: (skill: HermesSkill) => void
  manageableTeams: Team[]
  selectedTeamId: number
  selectedTeamName: string
  onPublishSkill: (skill: HermesSkill, options: SkillPublishOptions) => void
  time?: number
}) {
  const { t, i18n } = useTranslation()
  const { skill } = props
  const description = getLocalizedCapabilityText(
    skill.description,
    skill.descriptionZh,
    i18n.language
  )
  const skillScope = getSkillScope(skill)
  const isTeamSkill = skillScope === 'team'
  const isUserSkill = skillScope === 'user' || skill.isUserCreated
  const canManage = isUserSkill || (isTeamSkill && props.isAdmin)

  return (
    <div className='group relative flex flex-row items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-muted/60'>
      {/* Action buttons: top-left, appear on hover */}
      {canManage && (
        <div className='mt-0.5 flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100'>
          <button
            className='text-muted-foreground hover:bg-background hover:text-foreground rounded p-0.5 transition-colors'
            onClick={(e) => {
              e.stopPropagation()
              props.onEditSkill(skill, getSkillTeamId(skill, props.selectedTeamId))
            }}
            title={t('Edit')}
            type='button'
          >
            <PencilIcon className='size-3' />
          </button>
          {isUserSkill && props.manageableTeams.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className='text-muted-foreground hover:bg-background hover:text-foreground rounded p-0.5 transition-colors'
                  onClick={(e) => e.stopPropagation()}
                  title={t('Publish to team')}
                  type='button'
                >
                  <ArrowBigUpIcon className='size-3' />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='start'>
                {props.manageableTeams.map((team) => (
                  <DropdownMenuItem
                    key={team.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      props.onPublishSkill(skill, {
                        target: 'team',
                        sourceScope: 'user',
                        teamId: team.id,
                        teamName: team.name,
                      })
                    }}
                  >
                    {team.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <button
            className='text-muted-foreground hover:bg-background hover:text-destructive rounded p-0.5 transition-colors'
            onClick={(e) => {
              e.stopPropagation()
              props.onDeleteSkill(skill)
            }}
            title={t('Delete')}
            type='button'
          >
            <Trash2Icon className='size-3' />
          </button>
        </div>
      )}
      {/* Skill body: click to use */}
      <div className='min-w-0 flex-1'>
        <div className='truncate text-sm font-medium leading-snug'>
          {skill.displayName || skill.name}
        </div>
        {skill.displayName && (
          <div className='text-muted-foreground font-mono text-xs'>
            {skill.name}
          </div>
        )}
        {description && (
          <div className='text-muted-foreground mt-0.5 line-clamp-2 text-xs'>
            {description}
          </div>
        )}
        {props.time && (
          <div className='text-muted-foreground mt-1 text-[11px]'>
            {formatTimestamp(props.time)}
          </div>
        )}
      </div>
      <button
        className='text-muted-foreground hover:text-foreground shrink-0 transition-colors'
        onClick={() => props.onUseSkill(skill)}
        title={t('Use skill')}
        type='button'
      >
        <PlayIcon className='size-3.5' />
      </button>
    </div>
  )
}

interface SkillDetailPaneProps {
  skill: HermesSkill
  isAdmin: boolean
  onClose: () => void
  onUseSkill: (skill: HermesSkill) => void
  onEditSkill: (skill: HermesSkill, teamId?: number) => void
  onDeleteSkill: (skill: HermesSkill) => void
  manageableTeams: Team[]
  selectedTeamId: number
  selectedTeamName: string
  onPublishSkill: (skill: HermesSkill, options: SkillPublishOptions) => void
}

function SkillDetailPane(props: SkillDetailPaneProps) {
  const { t, i18n } = useTranslation()
  const { skill } = props
  const description = getLocalizedCapabilityText(
    skill.description,
    skill.descriptionZh,
    i18n.language
  )
  const usageGuide = getLocalizedCapabilityText(
    skill.usageGuide,
    skill.usageGuideZh,
    i18n.language
  )
  const referencePrompt = t('Use the "{{name}}" skill for this task.', {
    name: skill.name,
  })

  const copyReference = async () => {
    await navigator.clipboard.writeText(referencePrompt)
    toast.success(t('Skill reference copied'))
  }

  const skillScope = getSkillScope(skill)
  const canPublishToBaizor =
    props.isAdmin &&
    (skillScope === 'user' ||
      (skillScope === 'team' && props.selectedTeamId > 0))
  const canPublishToTeam = skillScope === 'user'
  const isTeamSkill = skillScope === 'team'
  const isUserSkill = skillScope === 'user' || skill.isUserCreated
  const isManageable = isUserSkill || (isTeamSkill && props.isAdmin)

  return (
    <div className='flex min-w-0 flex-1 flex-col'>
      <div className='flex items-start justify-between gap-2 border-b p-4'>
        <div className='min-w-0'>
          <h3 className='truncate text-base font-semibold'>
            {skill.displayName || skill.name}
          </h3>
          {skill.displayName && (
            <div className='text-muted-foreground mt-0.5 font-mono text-xs'>{skill.name}</div>
          )}
          <div className='mt-1.5 flex flex-wrap gap-1.5'>
            <Badge variant={skill.isUserCreated ? 'default' : 'secondary'}>
              {getSkillSourceLabel(skill, t, props.selectedTeamName)}
            </Badge>
            {skill.category && (
              <Badge variant='outline'>{skill.category}</Badge>
            )}
          </div>
        </div>
        <button
          aria-label={t('Close')}
          className='text-muted-foreground hover:bg-muted mt-0.5 shrink-0 rounded-md p-1 transition-colors'
          onClick={props.onClose}
          type='button'
        >
          <XIcon className='size-4' />
        </button>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        <div className='space-y-3 p-4'>
          {description && (
            <CapabilityInfoBlock
              title={t('Description')}
              content={description}
            />
          )}
          {usageGuide && (
            <CapabilityInfoBlock
              title={t('Usage guide')}
              content={usageGuide}
            />
          )}
          <div className='space-y-1'>
            <div className='text-muted-foreground text-xs'>
              {t('Reference prompt')}
            </div>
            <div className='bg-muted/40 rounded-md border px-2 py-1.5 font-mono text-xs break-words'>
              {referencePrompt}
            </div>
          </div>
        </div>
      </ScrollArea>

      <div className='space-y-2 border-t p-4'>
        <Button
          className='w-full'
          onClick={() => props.onUseSkill(skill)}
          type='button'
        >
          <PlayIcon className='size-3.5' />
          {t('Start using skill')}
        </Button>
        <div className='flex gap-2'>
          <Button
            className='flex-1'
            onClick={() => props.onUseSkill(skill)}
            size='sm'
            type='button'
            variant='outline'
          >
            <MessageSquareIcon className='size-3.5' />
            {t('Chat')}
          </Button>
          <Button
            className='flex-1'
            onClick={props.onClose}
            size='sm'
            type='button'
            variant='outline'
          >
            {t('Done')}
          </Button>
        </div>
        {isManageable && (
          <div className='flex gap-2 pt-1'>
            <Button
              className='flex-1'
              onClick={() =>
                props.onEditSkill(
                  skill,
                  getSkillTeamId(skill, props.selectedTeamId)
                )
              }
              size='sm'
              type='button'
              variant='ghost'
            >
              <PencilIcon className='size-3.5' />
              {t('Edit')}
            </Button>
            <Button
              className='flex-1'
              onClick={() => props.onDeleteSkill(skill)}
              size='sm'
              type='button'
              variant='ghost'
            >
              <Trash2Icon className='size-3.5' />
              {t('Delete')}
            </Button>
            {(canPublishToBaizor || canPublishToTeam) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    className='flex-1'
                    size='sm'
                    type='button'
                    variant='ghost'
                  >
                    <ArrowBigUpIcon className='size-3.5' />
                    {t('Publish')}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align='end'>
                  {canPublishToTeam && props.manageableTeams.map((team) => (
                    <DropdownMenuItem
                      key={team.id}
                      onClick={() =>
                        props.onPublishSkill(skill, {
                          target: 'team',
                          sourceScope: 'user',
                          teamId: team.id,
                          teamName: team.name,
                        })
                      }
                    >
                      {t('Publish to {{name}}', { name: team.name })}
                    </DropdownMenuItem>
                  ))}
                  {canPublishToBaizor && (
                    <DropdownMenuItem
                      onClick={() =>
                        props.onPublishSkill(skill, {
                          target: 'baizor',
                          sourceScope: skillScope === 'team' ? 'team' : 'user',
                          teamId:
                            skillScope === 'team'
                              ? props.selectedTeamId
                              : undefined,
                          teamName:
                            skillScope === 'team'
                              ? props.selectedTeamName
                              : undefined,
                        })
                      }
                    >
                      {t('Publish to Baizor')}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        )}
        <Button
          className='w-full'
          onClick={copyReference}
          size='sm'
          type='button'
          variant='ghost'
        >
          <CopyIcon className='size-3.5' />
          {t('Copy reference')}
        </Button>
      </div>
    </div>
  )
}

interface SkillRowProps {
  skill: HermesSkill
  isAdmin: boolean
  onEditSkill: (skill: HermesSkill, teamId?: number) => void
  onUseSkill: (skill: HermesSkill) => void
  onDeleteSkill: (skill: HermesSkill) => void
  manageableTeams: Team[]
  selectedTeamId: number
  selectedTeamName: string
  onPublishSkill: (skill: HermesSkill, options: SkillPublishOptions) => void
}

function SkillRow(props: SkillRowProps) {
  const { t, i18n } = useTranslation()
  const referencePrompt = t('Use the "{{name}}" skill for this task.', {
    name: props.skill.name,
  })
  const displayDescription = getLocalizedCapabilityText(
    props.skill.description,
    props.skill.descriptionZh,
    i18n.language
  )
  const usageGuide = getLocalizedCapabilityText(
    props.skill.usageGuide,
    props.skill.usageGuideZh,
    i18n.language
  )

  const copyName = async () => {
    await navigator.clipboard.writeText(props.skill.name)
    toast.success(t('Skill name copied'))
  }

  const copyReference = async () => {
    await navigator.clipboard.writeText(referencePrompt)
    toast.success(t('Skill reference copied'))
  }

  const skillScope = getSkillScope(props.skill)
  const canPublishToBaizor =
    props.isAdmin &&
    (skillScope === 'user' ||
      (skillScope === 'team' && props.selectedTeamId > 0))
  const canPublishToTeam = skillScope === 'user'

  return (
    <details className='group rounded-lg border p-3'>
      <summary className='flex cursor-pointer list-none items-start justify-between gap-2'>
        <div className='min-w-0 space-y-1'>
          <div className='flex flex-wrap items-center gap-1.5'>
            <h4 className='truncate text-sm font-medium'>{props.skill.name}</h4>
            <Badge
              variant={props.skill.isUserCreated ? 'default' : 'secondary'}
            >
              {getSkillSourceLabel(props.skill, t, props.selectedTeamName)}
            </Badge>
            {props.skill.category && (
              <Badge variant='outline'>{props.skill.category}</Badge>
            )}
          </div>
          <p className='text-muted-foreground line-clamp-2 text-xs'>
            {displayDescription || t('No description')}
          </p>
          {props.skill.path && (
            <p className='text-muted-foreground truncate font-mono text-[11px]'>
              {props.skill.path}
            </p>
          )}
        </div>
        <div className='flex shrink-0 items-center gap-1'>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              render={
                <button
                  type='button'
                  className='text-muted-foreground hover:bg-muted flex size-6 items-center justify-center rounded-md'
                  aria-label={t('Open menu')}
                  onClick={(e) => e.stopPropagation()}
                />
              }
            >
              <MoreHorizontalIcon className='size-4' />
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-52'>
              <DropdownMenuItem
                onClick={() =>
                  props.onEditSkill(
                    props.skill,
                    getSkillTeamId(props.skill, props.selectedTeamId)
                  )
                }
              >
                <PencilIcon className='size-4' />
                {t('Edit skill')}
              </DropdownMenuItem>
              <DropdownMenuItem
                variant='destructive'
                onClick={() => props.onDeleteSkill(props.skill)}
              >
                <Trash2Icon className='size-4' />
                {t('Delete skill')}
              </DropdownMenuItem>
              {(canPublishToBaizor || canPublishToTeam) && (
                <>
                  <DropdownMenuSeparator />
                  {canPublishToBaizor && (
                    <DropdownMenuItem
                      onClick={() =>
                        props.onPublishSkill(props.skill, {
                          target: 'baizor',
                          sourceScope: skillScope === 'team' ? 'team' : 'user',
                          teamId:
                            skillScope === 'team'
                              ? props.selectedTeamId
                              : undefined,
                          teamName:
                            skillScope === 'team'
                              ? props.selectedTeamName
                              : undefined,
                        })
                      }
                    >
                      <ArrowBigUpIcon className='size-4' />
                      {t('Publish to Baizor Skills')}
                    </DropdownMenuItem>
                  )}
                  {canPublishToTeam && (
                    <DropdownMenuSub>
                      <DropdownMenuSubTrigger>
                        <ArrowBigUpIcon className='size-4' />
                        {t('Publish to team')}
                      </DropdownMenuSubTrigger>
                      <DropdownMenuSubContent className='w-48'>
                        {props.manageableTeams.length === 0 ? (
                          <DropdownMenuItem disabled>
                            {t('No manageable teams')}
                          </DropdownMenuItem>
                        ) : (
                          props.manageableTeams.map((team) => (
                            <DropdownMenuItem
                              key={team.id}
                              onClick={() =>
                                props.onPublishSkill(props.skill, {
                                  target: 'team',
                                  sourceScope: 'user',
                                  teamId: team.id,
                                  teamName: team.name,
                                })
                              }
                            >
                              {t('Publish to {{team}}', { team: team.name })}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuSubContent>
                    </DropdownMenuSub>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRightIcon className='text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-90' />
        </div>
      </summary>
      <div className='mt-3 space-y-3 border-t pt-3'>
        <div className='grid gap-2 text-xs sm:grid-cols-2'>
          <SkillDetailItem
            label={t('Source')}
            value={getSkillSourceLabel(props.skill, t, props.selectedTeamName)}
          />
          <SkillDetailItem
            label={t('Owner scope')}
            value={getOwnerScopeLabel(props.skill.ownerScope, t)}
          />
          <SkillDetailItem
            label={t('Category')}
            value={props.skill.category || t('None')}
          />
          <SkillDetailItem
            label={t('Path')}
            value={props.skill.path || t('None')}
          />
        </div>
        {shouldShowChineseDescription(
          props.skill.description,
          props.skill.descriptionZh
        ) && (
          <CapabilityInfoBlock
            title={t('Chinese description')}
            content={props.skill.descriptionZh}
          />
        )}
        <CapabilityInfoBlock title={t('Usage guide')} content={usageGuide} />
        <div className='space-y-1'>
          <div className='text-muted-foreground text-xs'>
            {t('Reference prompt')}
          </div>
          <div className='bg-muted/40 rounded-md border px-2 py-1.5 font-mono text-xs break-words'>
            {referencePrompt}
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
          <Button
            onClick={() => props.onUseSkill(props.skill)}
            size='sm'
            type='button'
          >
            <PlayIcon className='size-3.5' />
            {t('Start using')}
          </Button>
          <Button onClick={copyName} size='sm' type='button' variant='outline'>
            <CopyIcon className='size-3.5' />
            {t('Copy skill name')}
          </Button>
          <Button
            onClick={copyReference}
            size='sm'
            type='button'
            variant='outline'
          >
            <CopyIcon className='size-3.5' />
            {t('Copy skill reference')}
          </Button>
        </div>
      </div>
    </details>
  )
}

function SkillDetailItem(props: { label: string; value: string }) {
  return (
    <div className='min-w-0 rounded-md border px-2 py-1.5'>
      <div className='text-muted-foreground text-[11px]'>{props.label}</div>
      <div className='truncate text-xs'>{props.value}</div>
    </div>
  )
}

function CapabilityInfoBlock(props: {
  title: string
  content?: string
}): ReactNode {
  if (!props.content) return null

  return (
    <div className='bg-muted/35 rounded-md border px-2 py-1.5 text-xs'>
      <div className='text-muted-foreground mb-1'>{props.title}</div>
      <p className='leading-relaxed break-words'>{props.content}</p>
    </div>
  )
}

interface ToolPanelProps {
  toolsets: HermesToolset[]
  search: string
  setSearch: (value: string) => void
  statusFilter: ToolsetStatusFilter
  setStatusFilter: (value: ToolsetStatusFilter) => void
  isLoading: boolean
  error: Error | null
}

function ToolPanel(props: ToolPanelProps) {
  const { t } = useTranslation()

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='space-y-3 border-b p-4'>
        <div className='relative'>
          <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
          <Input
            className='pl-8'
            onChange={(event) => props.setSearch(event.target.value)}
            placeholder={t('Search toolsets and tools')}
            value={props.search}
          />
        </div>
        <div className='flex flex-wrap gap-1.5'>
          {getToolsetFilterOptions(t).map((option) => (
            <Button
              aria-pressed={props.statusFilter === option.value}
              key={option.value}
              onClick={() => props.setStatusFilter(option.value)}
              size='xs'
              type='button'
              variant={
                props.statusFilter === option.value ? 'secondary' : 'outline'
              }
            >
              {option.label}
            </Button>
          ))}
        </div>
        <p className='text-muted-foreground text-xs'>
          {t(
            'Toolsets are the capabilities currently visible from Hermes API Server, not a guarantee that every model call will use them.'
          )}
        </p>
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        <div className='space-y-3 p-4'>
          {props.error && (
            <CapabilityError
              message={getErrorMessage(
                props.error,
                t('Failed to load Hermes tools')
              )}
            />
          )}
          {props.isLoading && <LoadingRows />}
          {!props.isLoading && !props.error && props.toolsets.length === 0 && (
            <CompactEmpty
              description={t('No toolsets match the current filters.')}
              title={t('No toolsets')}
            />
          )}
          {!props.isLoading &&
            !props.error &&
            props.toolsets.map((toolset) => (
              <ToolsetRow key={toolset.name} toolset={toolset} />
            ))}
        </div>
      </ScrollArea>
    </div>
  )
}

function ToolsetRow(props: { toolset: HermesToolset }) {
  const { t, i18n } = useTranslation()
  const displayDescription = getLocalizedCapabilityText(
    props.toolset.description,
    props.toolset.descriptionZh,
    i18n.language
  )
  const usageGuide = getLocalizedCapabilityText(
    props.toolset.usageGuide,
    props.toolset.usageGuideZh,
    i18n.language
  )

  return (
    <details className='group rounded-lg border p-3'>
      <summary className='flex cursor-pointer list-none items-start justify-between gap-3'>
        <div className='min-w-0 space-y-1'>
          <div className='flex flex-wrap items-center gap-1.5'>
            <h3 className='truncate text-sm font-medium'>
              {props.toolset.label}
            </h3>
            <StatusBadge
              active={props.toolset.enabled}
              activeText={t('Enabled')}
              inactiveText={t('Disabled')}
            />
            <StatusBadge
              active={props.toolset.configured}
              activeText={t('Configured')}
              inactiveText={t('Needs configuration')}
            />
          </div>
          <p className='text-muted-foreground line-clamp-2 text-xs'>
            {displayDescription || t('No description')}
          </p>
          <p className='text-muted-foreground text-xs'>
            {t('{{count}} tools', { count: props.toolset.tools.length })}
          </p>
        </div>
        <SlidersHorizontalIcon className='text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-90' />
      </summary>
      <div className='mt-3 space-y-3'>
        {shouldShowChineseDescription(
          props.toolset.description,
          props.toolset.descriptionZh
        ) && (
          <CapabilityInfoBlock
            title={t('Chinese description')}
            content={props.toolset.descriptionZh}
          />
        )}
        <CapabilityInfoBlock title={t('Usage guide')} content={usageGuide} />
        <div className='flex flex-wrap gap-1.5'>
          {props.toolset.tools.length === 0 ? (
            <span className='text-muted-foreground text-xs'>
              {t('No tools listed')}
            </span>
          ) : (
            props.toolset.tools.map((tool) => (
              <Badge key={tool} variant='outline'>
                {tool}
              </Badge>
            ))
          )}
        </div>
      </div>
    </details>
  )
}

function StatusBadge(props: {
  active: boolean
  activeText: string
  inactiveText: string
}) {
  const Icon = props.active ? CheckCircle2Icon : XCircleIcon

  return (
    <Badge variant={props.active ? 'secondary' : 'outline'}>
      <Icon className='size-3' />
      {props.active ? props.activeText : props.inactiveText}
    </Badge>
  )
}

function LoadingRows() {
  return (
    <div className='space-y-2'>
      <Skeleton className='h-20 w-full' />
      <Skeleton className='h-20 w-full' />
      <Skeleton className='h-20 w-full' />
    </div>
  )
}

function CapabilityError(props: { message: string }) {
  return (
    <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-lg border p-3 text-sm'>
      {props.message}
    </div>
  )
}

function CompactEmpty(props: { title: string; description: string }) {
  return (
    <Empty className='min-h-32 rounded-lg border p-4'>
      <EmptyMedia variant='icon'>
        <WrenchIcon className='size-4' />
      </EmptyMedia>
      <EmptyTitle>{props.title}</EmptyTitle>
      <EmptyDescription>{props.description}</EmptyDescription>
    </Empty>
  )
}

type OrderedSkillSection = {
  id: Exclude<HermesCapabilitySection, 'tools'>
  title: string
  skills: HermesSkill[]
  emptyTitle: string
  emptyDescription: string
  isFocused: boolean
}

function getOrderedSkillSections(
  props: SkillPanelProps,
  t: (key: string) => string
): OrderedSkillSection[] {
  const focusedSection =
    props.initialSection && props.initialSection !== 'tools'
      ? props.initialSection
      : undefined

  const sections: OrderedSkillSection[] = [
    {
      id: 'mine',
      title: t('My skills'),
      skills: props.userSkills,
      emptyTitle: t('No personal skills'),
      emptyDescription: t('Create a skill to make it appear here.'),
      isFocused: focusedSection === 'mine',
    },
    {
      id: 'team',
      title: t('Team skills'),
      skills: props.teamSkills,
      emptyTitle: t('No team skills'),
      emptyDescription: t('No team skills match the current search.'),
      isFocused: focusedSection === 'team',
    },
    {
      id: 'baizor',
      title: t('Baizor Skills'),
      skills: props.baizorSkills,
      emptyTitle: t('No Baizor Skills'),
      emptyDescription: t('No Baizor Skills match the current search.'),
      isFocused: focusedSection === 'baizor',
    },
    {
      id: 'jilai',
      title: t('Jilai Law Firm Skills'),
      skills: props.jilaiSkills,
      emptyTitle: t('No Jilai Law Firm Skills'),
      emptyDescription: t('No Jilai Law Firm skills match the current search.'),
      isFocused: focusedSection === 'jilai',
    },
    {
      id: 'builtin',
      title: t('Built-in skills'),
      skills: props.systemSkills,
      emptyTitle: t('No system skills'),
      emptyDescription: t('No built-in skills match the current search.'),
      isFocused: focusedSection === 'builtin',
    },
  ]

  if (!focusedSection) return sections
  return sections.filter((section) => section.id === focusedSection)
}

function getInitialCapabilityTab(
  section?: HermesCapabilitySection
): HermesCapabilityTab {
  return section === 'tools' ? 'tools' : 'skills'
}

function getInitialSkillSearch(category?: string): string {
  if (!category) return ''

  const normalizedCategory = category.trim().toLowerCase()
  const categorySearchTerms: Record<string, string> = {
    ppt: 'ppt',
    presentation: 'ppt',
    report: 'report',
    research: 'report',
    data: 'data',
    document: 'document',
  }
  return categorySearchTerms[normalizedCategory] ?? normalizedCategory
}

function filterSkills(skills: HermesSkill[], query: string): HermesSkill[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return skills

  return skills.filter((skill) => {
    const haystack = [
      skill.name,
      skill.description,
      skill.category,
      skill.path,
      skill.source,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}

function canManageTeam(role: Team['role']): boolean {
  return role === 'owner' || role === 'admin'
}

function getSkillScope(skill: HermesSkill): HermesSkill['source'] {
  if (skill.isUserCreated) return 'user'
  if (skill.source !== 'unknown') return skill.source
  return skill.ownerScope
}

function getSkillTeamId(
  skill: HermesSkill,
  selectedTeamId: number
): number | undefined {
  const scope = getSkillScope(skill)
  return scope === 'team' && selectedTeamId > 0 ? selectedTeamId : undefined
}

function filterToolsets(
  toolsets: HermesToolset[],
  query: string,
  statusFilter: ToolsetStatusFilter
): HermesToolset[] {
  const normalizedQuery = query.trim().toLowerCase()

  return toolsets.filter((toolset) => {
    if (!matchesToolsetStatusFilter(toolset, statusFilter)) return false
    if (!normalizedQuery) return true

    const haystack = [
      toolset.name,
      toolset.label,
      toolset.description,
      ...toolset.tools,
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(normalizedQuery)
  })
}

function matchesToolsetStatusFilter(
  toolset: HermesToolset,
  statusFilter: ToolsetStatusFilter
): boolean {
  switch (statusFilter) {
    case 'enabled':
      return toolset.enabled
    case 'disabled':
      return !toolset.enabled
    case 'configured':
      return toolset.configured
    case 'unconfigured':
      return !toolset.configured
    default:
      return true
  }
}

function getSkillCategoryOptions(t: (key: string) => string) {
  return [
    { query: '', label: t('Recommended') },
    { query: 'ppt', label: t('PPT and presentations') },
    { query: 'report', label: t('Research reports') },
    { query: 'data', label: t('Data analysis') },
    { query: 'document', label: t('Document writing') },
  ]
}

function getToolsetFilterOptions(t: (key: string) => string) {
  return [
    { value: 'all' as const, label: t('All') },
    { value: 'enabled' as const, label: t('Enabled') },
    { value: 'disabled' as const, label: t('Disabled') },
    { value: 'configured' as const, label: t('Configured') },
    { value: 'unconfigured' as const, label: t('Needs configuration') },
  ]
}

function getLocalizedCapabilityText(
  value: string | undefined,
  zhValue: string | undefined,
  language: string
): string {
  if (language.toLowerCase().startsWith('zh') && zhValue) return zhValue
  return value || zhValue || ''
}

function shouldShowChineseDescription(
  value: string | undefined,
  zhValue: string | undefined
): boolean {
  if (!value || !zhValue) return false
  return ASCII_LETTER_PATTERN.test(value) && !CJK_PATTERN.test(value)
}

function getSkillSourceLabel(
  skill: HermesSkill,
  t: (key: string, options?: Record<string, unknown>) => string,
  teamName?: string
): string {
  if (skill.isUserCreated) return t('Mine')
  if (skill.source === 'team') {
    return teamName ? t('Team: {{team}}', { team: teamName }) : t('Team')
  }
  if (skill.source === 'baizor') return t('Baizor Skills')
  if (skill.source === 'system') return t('Built-in')
  if (skill.source === 'external') return t('External')
  return t('Unknown')
}

function getOwnerScopeLabel(
  ownerScope: HermesSkill['ownerScope'],
  t: (key: string) => string
): string {
  if (ownerScope === 'user') return t('User')
  if (ownerScope === 'team') return t('Team')
  if (ownerScope === 'baizor') return t('Baizor')
  if (ownerScope === 'system') return t('System')
  if (ownerScope === 'external') return t('External')
  return t('Unknown')
}

function getErrorMessage(error: Error | null, fallback: string): string {
  if (!error) return fallback
  return error.message || fallback
}
