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
import { Link } from '@tanstack/react-router'
import {
  Archive,
  ArchiveRestore,
  Copy,
  Download,
  ExternalLink,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Trash2,
} from 'lucide-react'
import type { FormEvent } from 'react'
import { useTranslation } from 'react-i18next'

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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import {
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar'
import { cn } from '@/lib/utils'

import type { SessionActions, SessionLike } from '../lib/session-list-core'
import { SIDEBAR_NODE_COLORS } from '../constants'

export type { SessionActions, SessionLike }

export type SessionGroups<T extends SessionLike> = {
  pinned: T[]
  recent: T[]
  archived: T[]
}

export function SessionListGroupsExpanded<T extends SessionLike>(props: {
  baseUrl: string
  groups: SessionGroups<T>
  activeSessionId: string
  actions: SessionActions<T>
}) {
  return (
    <>
      <SessionGroupExpanded
        baseUrl={props.baseUrl}
        titleKey='Pinned'
        sessions={props.groups.pinned}
        activeSessionId={props.activeSessionId}
        actions={props.actions}
      />
      <SessionGroupExpanded
        baseUrl={props.baseUrl}
        titleKey='Recent'
        sessions={props.groups.recent}
        activeSessionId={props.activeSessionId}
        actions={props.actions}
      />
      <SessionGroupExpanded
        baseUrl={props.baseUrl}
        titleKey='Archived'
        sessions={props.groups.archived}
        activeSessionId={props.activeSessionId}
        actions={props.actions}
      />
    </>
  )
}

export function SessionListGroupsCollapsed<T extends SessionLike>(props: {
  baseUrl: string
  groups: SessionGroups<T>
  activeSessionId: string
  onSelect: (sessionId: string) => void
}) {
  return (
    <>
      <SessionGroupCollapsed
        baseUrl={props.baseUrl}
        titleKey='Pinned'
        sessions={props.groups.pinned}
        activeSessionId={props.activeSessionId}
        onSelect={props.onSelect}
      />
      <SessionGroupCollapsed
        baseUrl={props.baseUrl}
        titleKey='Recent'
        sessions={props.groups.recent}
        activeSessionId={props.activeSessionId}
        onSelect={props.onSelect}
      />
      <SessionGroupCollapsed
        baseUrl={props.baseUrl}
        titleKey='Archived'
        sessions={props.groups.archived}
        activeSessionId={props.activeSessionId}
        onSelect={props.onSelect}
      />
    </>
  )
}

function SessionGroupExpanded<T extends SessionLike>(props: {
  baseUrl: string
  titleKey: string
  sessions: T[]
  activeSessionId: string
  actions: SessionActions<T>
}) {
  const { t } = useTranslation()

  if (props.sessions.length === 0) return null

  return (
    <>
      <SidebarMenuSubItem>
        <div className='text-sidebar-foreground/60 px-2 pt-2 pb-1 text-[11px] font-medium'>
          {t(props.titleKey)}
        </div>
      </SidebarMenuSubItem>
      {props.sessions.map((session, idx) => (
        <SessionItemExpanded
          key={session.id}
          baseUrl={props.baseUrl}
          session={session}
          active={props.activeSessionId === session.id}
          actions={props.actions}
          index={idx}
        />
      ))}
    </>
  )
}

function SessionGroupCollapsed<T extends SessionLike>(props: {
  baseUrl: string
  titleKey: string
  sessions: T[]
  activeSessionId: string
  onSelect: (sessionId: string) => void
}) {
  const { t } = useTranslation()

  if (props.sessions.length === 0) return null

  return (
    <>
      <DropdownMenuItem disabled className='text-muted-foreground'>
        {t(props.titleKey)}
      </DropdownMenuItem>
      {props.sessions.map((session) => (
        <SessionItemCollapsed
          key={session.id}
          baseUrl={props.baseUrl}
          session={session}
          active={props.activeSessionId === session.id}
          onSelect={props.onSelect}
        />
      ))}
    </>
  )
}

function SessionItemExpanded<T extends SessionLike>(props: {
  baseUrl: string
  session: T
  active: boolean
  actions: SessionActions<T>
  index: number
}) {
  const { t } = useTranslation()
  const colorClass = SIDEBAR_NODE_COLORS[props.index % SIDEBAR_NODE_COLORS.length]

  return (
    <SidebarMenuSubItem className='group/session-item'>
      <SidebarMenuSubButton
        isActive={props.active}
        render={
          <Link
            to={props.baseUrl}
            onClick={() => props.actions.select(props.session.id)}
          />
        }
        className={cn('pr-7', colorClass)}
      >
        {props.session.pinned && !props.session.archived ? (
          <Pin className='size-3.5' aria-hidden='true' />
        ) : null}
        <span>{props.session.title || t('New session')}</span>
      </SidebarMenuSubButton>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger
          render={
            <button
              type='button'
              className='text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground absolute top-1 right-1 flex size-5 items-center justify-center rounded-md opacity-100 md:opacity-0 md:group-hover/session-item:opacity-100'
              aria-label={t('Open menu')}
            />
          }
        >
          <MoreHorizontal className='size-3.5' aria-hidden='true' />
        </DropdownMenuTrigger>
        <SessionItemActionsMenu
          session={props.session}
          actions={props.actions}
        />
      </DropdownMenu>
    </SidebarMenuSubItem>
  )
}

function SessionItemCollapsed<T extends SessionLike>(props: {
  baseUrl: string
  session: T
  active: boolean
  onSelect: (sessionId: string) => void
}) {
  return (
    <DropdownMenuItem
      render={
        <Link
          to={props.baseUrl}
          className={props.active ? 'bg-secondary' : ''}
          onClick={() => props.onSelect(props.session.id)}
        />
      }
    >
      {props.session.title || props.session.id}
    </DropdownMenuItem>
  )
}

function SessionItemActionsMenu<T extends SessionLike>(props: {
  session: T
  actions: SessionActions<T>
}) {
  const { t } = useTranslation()

  return (
    <DropdownMenuContent align='end' className='w-44'>
      <DropdownMenuItem onClick={() => props.actions.pin(props.session)}>
        {props.session.pinned ? (
          <PinOff className='size-4' aria-hidden='true' />
        ) : (
          <Pin className='size-4' aria-hidden='true' />
        )}
        {props.session.pinned ? t('Unpin') : t('Pin')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.copyId(props.session)}>
        <Copy className='size-4' aria-hidden='true' />
        {t('Copy ID')}
      </DropdownMenuItem>
      <DropdownMenuItem
        onClick={() => props.actions.openInNewWindow(props.session)}
      >
        <ExternalLink className='size-4' aria-hidden='true' />
        {t('Open in new window')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.export(props.session)}>
        <Download className='size-4' aria-hidden='true' />
        {t('Export')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.rename(props.session)}>
        <Pencil className='size-4' aria-hidden='true' />
        {t('Rename')}
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => props.actions.archive(props.session)}>
        {props.session.archived ? (
          <ArchiveRestore className='size-4' aria-hidden='true' />
        ) : (
          <Archive className='size-4' aria-hidden='true' />
        )}
        {props.session.archived ? t('Restore') : t('Archive')}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant='destructive'
        onClick={() => props.actions.delete(props.session)}
      >
        <Trash2 className='size-4' aria-hidden='true' />
        {t('Delete')}
      </DropdownMenuItem>
    </DropdownMenuContent>
  )
}

export function SessionRenameDialog<T extends SessionLike>(props: {
  open: boolean
  session: T | null
  value: string
  onOpenChange: (open: boolean) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  onValueChange: (value: string) => void
  titleKey?: string
  inputLabelKey?: string
}) {
  const { t } = useTranslation()

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent>
        <form onSubmit={props.onSubmit} className='space-y-4'>
          <DialogHeader>
            <DialogTitle>{t(props.titleKey ?? 'Rename session')}</DialogTitle>
          </DialogHeader>
          <Input
            value={props.value}
            onChange={(event) => props.onValueChange(event.target.value)}
            aria-label={t(props.inputLabelKey ?? 'Session name')}
            autoFocus
          />
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => props.onOpenChange(false)}
            >
              {t('Cancel')}
            </Button>
            <Button type='submit'>{t('Save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
