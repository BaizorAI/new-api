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
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  CheckCircle2Icon,
  CopyIcon,
  PackagePlusIcon,
  RefreshCwIcon,
  SearchIcon,
  SlidersHorizontalIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

import {
  listHermesSkills,
  listHermesToolsets,
  type HermesSkill,
  type HermesToolset,
} from '../api'

interface HermesCapabilityCenterProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onAddSkill: () => void
}

const EMPTY_SKILLS: HermesSkill[] = []
const EMPTY_TOOLSETS: HermesToolset[] = []

export function HermesCapabilityCenter(props: HermesCapabilityCenterProps) {
  const { t } = useTranslation()
  const [skillSearch, setSkillSearch] = useState('')
  const [toolsetSearch, setToolsetSearch] = useState('')

  const skillsQuery = useQuery({
    queryKey: ['hermes-capabilities', 'skills'],
    queryFn: listHermesSkills,
    enabled: props.open,
  })
  const toolsetsQuery = useQuery({
    queryKey: ['hermes-capabilities', 'toolsets'],
    queryFn: listHermesToolsets,
    enabled: props.open,
  })

  const skills = skillsQuery.data ?? EMPTY_SKILLS
  const userSkills = useMemo(
    () =>
      filterSkills(
        skills.filter((skill) => skill.isUserCreated),
        skillSearch
      ),
    [skillSearch, skills]
  )
  const systemSkills = useMemo(
    () =>
      filterSkills(
        skills.filter((skill) => !skill.isUserCreated),
        skillSearch
      ),
    [skillSearch, skills]
  )
  const toolsets = useMemo(
    () => filterToolsets(toolsetsQuery.data ?? EMPTY_TOOLSETS, toolsetSearch),
    [toolsetSearch, toolsetsQuery.data]
  )

  const refresh = () => {
    void skillsQuery.refetch()
    void toolsetsQuery.refetch()
  }

  return (
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
              onAddSkill={props.onAddSkill}
              search={skillSearch}
              setSearch={setSkillSearch}
              systemSkills={systemSkills}
              userSkills={userSkills}
            />
          </TabsContent>

          <TabsContent className='min-h-0' value='tools'>
            <ToolPanel
              error={toolsetsQuery.error}
              isLoading={toolsetsQuery.isLoading}
              search={toolsetSearch}
              setSearch={setToolsetSearch}
              toolsets={toolsets}
            />
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}

interface SkillPanelProps {
  userSkills: HermesSkill[]
  systemSkills: HermesSkill[]
  search: string
  setSearch: (value: string) => void
  isLoading: boolean
  error: Error | null
  onAddSkill: () => void
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
                skills={props.userSkills}
                title={t('My skills')}
              />
              <SkillSection
                emptyDescription={t(
                  'No built-in skills match the current search.'
                )}
                emptyTitle={t('No system skills')}
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
              skill={skill}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SkillRow(props: { skill: HermesSkill }) {
  const { t } = useTranslation()

  const copyName = async () => {
    await navigator.clipboard.writeText(props.skill.name)
    toast.success(t('Skill name copied'))
  }

  return (
    <div className='rounded-lg border p-3'>
      <div className='flex items-start justify-between gap-2'>
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
        <Button
          aria-label={t('Copy skill name')}
          onClick={copyName}
          size='icon-sm'
          type='button'
          variant='ghost'
        >
          <CopyIcon className='size-4' />
        </Button>
      </div>
    </div>
  )
}

interface ToolPanelProps {
  toolsets: HermesToolset[]
  search: string
  setSearch: (value: string) => void
  isLoading: boolean
  error: Error | null
}

function ToolPanel(props: ToolPanelProps) {
  const { t } = useTranslation()

  return (
    <div className='flex h-full min-h-0 flex-col'>
      <div className='border-b p-4'>
        <div className='relative'>
          <SearchIcon className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2' />
          <Input
            className='pl-8'
            onChange={(event) => props.setSearch(event.target.value)}
            placeholder={t('Search toolsets and tools')}
            value={props.search}
          />
        </div>
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
              description={t('No toolsets match the current search.')}
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

function filterToolsets(
  toolsets: HermesToolset[],
  query: string
): HermesToolset[] {
  const normalizedQuery = query.trim().toLowerCase()
  if (!normalizedQuery) return toolsets

  return toolsets.filter((toolset) => {
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

function getSkillSourceLabel(
  skill: HermesSkill,
  t: (key: string) => string
): string {
  if (skill.isUserCreated) return t('Mine')
  if (skill.source === 'system') return t('Built-in')
  if (skill.source === 'external') return t('External')
  return t('Unknown')
}

function getErrorMessage(error: Error | null, fallback: string): string {
  if (!error) return fallback
  return error.message || fallback
}
