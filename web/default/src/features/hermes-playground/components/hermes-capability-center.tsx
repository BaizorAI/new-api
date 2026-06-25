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
  CheckCircle2Icon,
  ChevronRightIcon,
  CopyIcon,
  MoreHorizontalIcon,
  PackagePlusIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
  WrenchIcon,
  XCircleIcon,
  ArrowBigUpIcon,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
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

import {
  deleteHermesSkill,
  promoteHermesSkill,
  listHermesSkills,
  listHermesToolsets,
  type HermesSkill,
  type HermesToolset,
} from '../api'

interface HermesCapabilityCenterProps {
  open: boolean
  userScope: string
  selectedTeamId: number
  teams: Team[]
  onOpenChange: (open: boolean) => void
  onAddSkill: () => void
  onEditSkill: (skill: HermesSkill) => void
}

const EMPTY_SKILLS: HermesSkill[] = []
const EMPTY_TOOLSETS: HermesToolset[] = []
const ADMIN_MIN_ROLE = 10

type SkillPublishOptions = {
  target: 'baizor' | 'team' | 'system'
  sourceScope: 'user' | 'team' | 'baizor'
  teamId?: number
}

type ToolsetStatusFilter =
  | 'all'
  | 'enabled'
  | 'disabled'
  | 'configured'
  | 'unconfigured'

export function HermesCapabilityCenter(props: HermesCapabilityCenterProps) {
  const { t } = useTranslation()
  const [skillSearch, setSkillSearch] = useState('')
  const [toolsetSearch, setToolsetSearch] = useState('')
  const [toolsetStatusFilter, setToolsetStatusFilter] =
    useState<ToolsetStatusFilter>('all')
  const [deletingSkill, setDeletingSkill] = useState<HermesSkill | null>(null)
  const [activeTeamId, setActiveTeamId] = useState(() =>
    props.selectedTeamId || props.teams[0]?.id || 0
  )
  const role = useAuthStore((s) => s.auth.user?.role ?? 0)

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

    const activeTeamExists = props.teams.some((team) => team.id === activeTeamId)
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
    ],
    queryFn: () => listHermesSkills({ teamId: activeTeamId || undefined }),
    enabled: props.open,
  })
  const toolsetsQuery = useQuery({
    queryKey: ['hermes-capabilities', props.userScope, 'toolsets'],
    queryFn: listHermesToolsets,
    enabled: props.open,
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
  const systemSkills = useMemo(
    () =>
      filterSkills(
        skills.filter(
          (skill) =>
            skill.source !== 'user' &&
            skill.source !== 'team' &&
            skill.source !== 'baizor' &&
            skill.ownerScope !== 'user' &&
            skill.ownerScope !== 'team' &&
            skill.ownerScope !== 'baizor'
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
      await deleteHermesSkill(deletingSkill.name)
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

  const isAdmin = role >= ADMIN_MIN_ROLE

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className='w-full gap-0 sm:max-w-xl' side='right'>
          <SheetHeader className='border-b pr-12'>
            <SheetTitle>{t('Hermes capabilities')}</SheetTitle>
            <SheetDescription>
              {t('Manage reusable skills and inspect available Hermes tools.')}
            </SheetDescription>
          </SheetHeader>

          <Tabs className='min-h-0 flex-1 gap-0' defaultValue='skills'>
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
                onDeleteSkill={setDeletingSkill}
                onEditSkill={props.onEditSkill}
                manageableTeams={manageableTeams}
                teams={props.teams}
                activeTeamId={activeTeamId}
                onActiveTeamChange={setActiveTeamId}
                selectedTeamId={activeTeamId}
                onPublishSkill={handlePublishSkill}
                search={skillSearch}
                setSearch={setSkillSearch}
                baizorSkills={baizorSkills}
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
        </SheetContent>
      </Sheet>

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
  systemSkills: HermesSkill[]
  search: string
  setSearch: (value: string) => void
  isLoading: boolean
  error: Error | null
  isAdmin: boolean
  onAddSkill: () => void
  onEditSkill: (skill: HermesSkill) => void
  onDeleteSkill: (skill: HermesSkill) => void
  manageableTeams: Team[]
  teams: Team[]
  activeTeamId: number
  onActiveTeamChange: (teamId: number) => void
  selectedTeamId: number
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
      </div>

      <ScrollArea className='min-h-0 flex-1'>
        <div className='space-y-5 p-4'>
          {props.error && (
            <CapabilityError
              message={getErrorMessage(
                props.error,
                t('Failed to load Hermes skills')
              )}
            />
          )}
          {props.isLoading && <LoadingRows />}
          {!props.isLoading && !props.error && (
            <>
              <SkillSection
                emptyDescription={t('Create a skill to make it appear here.')}
                emptyTitle={t('No personal skills')}
                isAdmin={props.isAdmin}
                onDeleteSkill={props.onDeleteSkill}
                onEditSkill={props.onEditSkill}
                manageableTeams={props.manageableTeams}
                selectedTeamId={props.selectedTeamId}
                onPublishSkill={props.onPublishSkill}
                skills={props.userSkills}
                title={t('My skills')}
              />
              <SkillSection
                emptyDescription={t(
                  'No team skills match the current search.'
                )}
                emptyTitle={t('No team skills')}
                isAdmin={props.isAdmin}
                onDeleteSkill={props.onDeleteSkill}
                onEditSkill={props.onEditSkill}
                manageableTeams={props.manageableTeams}
                selectedTeamId={props.selectedTeamId}
                onPublishSkill={props.onPublishSkill}
                skills={props.teamSkills}
                title={t('Team skills')}
              />
              <SkillSection
                emptyDescription={t(
                  'No Baizor Skills match the current search.'
                )}
                emptyTitle={t('No Baizor Skills')}
                isAdmin={props.isAdmin}
                onDeleteSkill={props.onDeleteSkill}
                onEditSkill={props.onEditSkill}
                manageableTeams={props.manageableTeams}
                selectedTeamId={props.selectedTeamId}
                onPublishSkill={props.onPublishSkill}
                skills={props.baizorSkills}
                title={t('Baizor Skills')}
              />
              <SkillSection
                emptyDescription={t(
                  'No built-in skills match the current search.'
                )}
                emptyTitle={t('No system skills')}
                isAdmin={props.isAdmin}
                onDeleteSkill={props.onDeleteSkill}
                onEditSkill={props.onEditSkill}
                manageableTeams={props.manageableTeams}
                selectedTeamId={props.selectedTeamId}
                onPublishSkill={props.onPublishSkill}
                skills={props.systemSkills}
                title={t('Built-in skills')}
              />
            </>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

interface SkillSectionProps {
  title: string
  skills: HermesSkill[]
  emptyTitle: string
  emptyDescription: string
  isAdmin: boolean
  onEditSkill: (skill: HermesSkill) => void
  onDeleteSkill: (skill: HermesSkill) => void
  manageableTeams: Team[]
  teams: Team[]
  activeTeamId: number
  onActiveTeamChange: (teamId: number) => void
  selectedTeamId: number
  onPublishSkill: (skill: HermesSkill, options: SkillPublishOptions) => void
}

function SkillSection(props: SkillSectionProps) {
  const { t } = useTranslation()

  return (
    <section className='space-y-2'>
      <div className='flex items-center justify-between'>
        <h3 className='text-sm font-medium'>{props.title}</h3>
        <span className='text-muted-foreground text-xs'>
          {t('{{count}} items', { count: props.skills.length })}
        </span>
      </div>
      {props.skills.length === 0 ? (
        <CompactEmpty
          description={props.emptyDescription}
          title={props.emptyTitle}
        />
      ) : (
        <div className='space-y-2'>
          {props.skills.map((skill) => (
            <SkillRow
              key={`${skill.source}-${skill.path ?? skill.name}`}
              isAdmin={props.isAdmin}
              onDeleteSkill={props.onDeleteSkill}
              onEditSkill={props.onEditSkill}
              manageableTeams={props.manageableTeams}
              selectedTeamId={props.selectedTeamId}
              onPublishSkill={props.onPublishSkill}
              skill={skill}
            />
          ))}
        </div>
      )}
    </section>
  )
}

interface SkillRowProps {
  skill: HermesSkill
  isAdmin: boolean
  onEditSkill: (skill: HermesSkill) => void
  onDeleteSkill: (skill: HermesSkill) => void
  manageableTeams: Team[]
  teams: Team[]
  activeTeamId: number
  onActiveTeamChange: (teamId: number) => void
  selectedTeamId: number
  onPublishSkill: (skill: HermesSkill, options: SkillPublishOptions) => void
}

function SkillRow(props: SkillRowProps) {
  const { t } = useTranslation()
  const referencePrompt = t('Use the "{{name}}" skill for this task.', {
    name: props.skill.name,
  })

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
              {getSkillSourceLabel(props.skill, t)}
            </Badge>
            {props.skill.category && (
              <Badge variant='outline'>{props.skill.category}</Badge>
            )}
          </div>
          <p className='text-muted-foreground line-clamp-2 text-xs'>
            {props.skill.description || t('No description')}
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
              <DropdownMenuItem onClick={() => props.onEditSkill(props.skill)}>
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
            value={getSkillSourceLabel(props.skill, t)}
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
        <div className='space-y-1'>
          <div className='text-muted-foreground text-xs'>
            {t('Reference prompt')}
          </div>
          <div className='bg-muted/40 rounded-md border px-2 py-1.5 font-mono text-xs break-words'>
            {referencePrompt}
          </div>
        </div>
        <div className='flex flex-wrap gap-2'>
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
  const { t } = useTranslation()

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
            {props.toolset.description || t('No description')}
          </p>
          <p className='text-muted-foreground text-xs'>
            {t('{{count}} tools', { count: props.toolset.tools.length })}
          </p>
        </div>
        <SlidersHorizontalIcon className='text-muted-foreground mt-0.5 size-4 shrink-0 transition-transform group-open:rotate-90' />
      </summary>
      <div className='mt-3 flex flex-wrap gap-1.5'>
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

function getToolsetFilterOptions(t: (key: string) => string) {
  return [
    { value: 'all' as const, label: t('All') },
    { value: 'enabled' as const, label: t('Enabled') },
    { value: 'disabled' as const, label: t('Disabled') },
    { value: 'configured' as const, label: t('Configured') },
    { value: 'unconfigured' as const, label: t('Needs configuration') },
  ]
}

function getSkillSourceLabel(
  skill: HermesSkill,
  t: (key: string) => string
): string {
  if (skill.isUserCreated) return t('Mine')
  if (skill.source === 'team') return t('Team')
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
