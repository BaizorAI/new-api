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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import {
  HermesAgentWorkspace,
  type HermesMessageSection,
  type HermesPromptSuggestion,
} from '@/features/hermes-playground/components/hermes-agent-workspace'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

import { WorkspaceHome } from './-workspace-home'

const capabilitySections = [
  'mine',
  'team',
  'baizor',
  'builtin',
  'tools',
] as const
const messageSections = ['wechat', 'history', 'settings'] as const
const routeSections = [...capabilitySections, ...messageSections] as const
const resultScopes = ['all', 'mine', 'team'] as const
const resultTypes = ['all', 'ppt', 'report', 'document', 'attachment'] as const

const teamWorkspaceSearchSchema = z.object({
  team_id: z.coerce.number().int().positive().optional().catch(undefined),
  panel: z
    .enum(['sessions', 'results', 'skills', 'messages', 'tasks'])
    .optional()
    .catch(undefined),
  section: z.enum(routeSections).optional().catch(undefined),
  scope: z.enum(resultScopes).optional().catch(undefined),
  type: z.enum(resultTypes).optional().catch(undefined),
  category: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/team-workspace/')({
  validateSearch: teamWorkspaceSearchSchema,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'team_workspace')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: TeamWorkspacePage,
})

function TeamWorkspacePage() {
  const { t } = useTranslation()
  const {
    category,
    panel,
    scope,
    section,
    team_id,
    type: resultType,
  } = Route.useSearch()
  const capabilitySection = isCapabilitySection(section) ? section : undefined
  const messageSection = isMessageSection(section) ? section : undefined

  const suggestedPrompts = useMemo<HermesPromptSuggestion[]>(
    () => [
      {
        label: t('Team Daily Plan'),
        prompt: t(
          'Create a concise team work plan for today. Include shared priorities, owners, risks, required inputs and next actions.'
        ),
      },
      {
        label: t('Project Brief'),
        prompt: t(
          'Turn this discussion into a project brief. Include goal, scope, roles, milestones, deliverables, risks and acceptance criteria.'
        ),
      },
      {
        label: t('Meeting Summary'),
        prompt: t(
          'Summarize this team discussion into decisions, open questions, action items, owners and due dates.'
        ),
      },
      {
        label: t('Task Breakdown'),
        prompt: t(
          'Break this team objective into executable tasks. Include owners, dependencies, estimated effort, priority and definition of done.'
        ),
      },
      {
        label: t('Delivery Review'),
        prompt: t(
          'Review current project delivery. Identify progress, blockers, quality risks, customer-facing updates and next actions.'
        ),
      },
      {
        label: t('Knowledge Base'),
        prompt: t(
          'Organize this conversation into reusable team knowledge. Include background, process, templates, examples and follow-up items.'
        ),
      },
    ],
    [t]
  )

  if (!team_id) {
    return <WorkspaceHome />
  }

  return (
    <HermesAgentWorkspace
      baseScopePrefix='team_workspace'
      defaultSystemPrompt={t(
        'You are a team collaboration assistant. Use Chinese by default. Help team members complete shared work through skills, tools, structured documents, task breakdowns, project plans, meeting summaries and delivery reviews. Keep outputs practical, traceable and suitable for team reuse.'
      )}
      emptyModelsMessage={t('No Hermes models available')}
      initialCapabilityCategory={category}
      initialCapabilitySection={capabilitySection}
      initialMessageSection={messageSection}
      initialPanel={panel}
      initialResultScope={scope}
      initialResultType={resultType}
      initialTeamId={team_id}
      queryKeyPrefix='team-workspace'
      suggestedPrompts={suggestedPrompts}
      workspaceMode='team'
    />
  )
}

function isCapabilitySection(
  value: unknown
): value is (typeof capabilitySections)[number] {
  return capabilitySections.includes(
    value as (typeof capabilitySections)[number]
  )
}

function isMessageSection(value: unknown): value is HermesMessageSection {
  return messageSections.includes(value as HermesMessageSection)
}
