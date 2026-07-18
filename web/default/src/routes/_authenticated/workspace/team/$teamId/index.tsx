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
  type HermesPromptSuggestion,
} from '@/features/hermes-playground/components/hermes-agent-workspace'
import { safeStorageScope } from '@/features/hermes-playground/sessions'
import {
  HERMES_RESULT_SCOPES,
  HERMES_RESULT_TYPES,
  HERMES_ROUTE_SECTIONS,
  HERMES_TEAM_PANELS,
  isHermesCapabilitySection,
  isHermesMessageSection,
} from '@/features/hermes-playground/lib/workspace-panel-controller'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

const teamWorkspaceSearchSchema = z.object({
  panel: z.enum(HERMES_TEAM_PANELS).optional().catch(undefined),
  section: z.enum(HERMES_ROUTE_SECTIONS).optional().catch(undefined),
  scope: z.enum(HERMES_RESULT_SCOPES).optional().catch(undefined),
  type: z.enum(HERMES_RESULT_TYPES).optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  skill: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/workspace/team/$teamId/')({
  validateSearch: teamWorkspaceSearchSchema,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'team_workspace')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: TeamWorkspaceDetailPage,
})

function TeamWorkspaceDetailPage() {
  const { t } = useTranslation()
  const { teamId } = Route.useParams()
  const {
    category,
    panel,
    scope,
    section,
    skill,
    type: resultType,
  } = Route.useSearch()
  const capabilitySection = isHermesCapabilitySection(section)
    ? section
    : undefined
  const messageSection = isHermesMessageSection(section) ? section : undefined

  const baseScopePrefix = skill
    ? `team_workspace_skill_${safeStorageScope(skill)}`
    : 'team_workspace'

  const defaultSystemPrompt = skill
    ? [
        t('You are a team collaboration assistant. Use Chinese by default.'),
        t('The team has activated the "{{skill}}" skill. Apply it to all tasks unless instructed otherwise.', { skill }),
      ]
        .filter(Boolean)
        .join('\n\n')
    : t(
        'You are a team collaboration assistant. Use Chinese by default. Help team members complete shared work through skills, tools, structured documents, task breakdowns, project plans, meeting summaries and delivery reviews. Keep outputs practical, traceable and suitable for team reuse.'
      )

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

  return (
    <HermesAgentWorkspace
      baseScopePrefix={baseScopePrefix}
      defaultSystemPrompt={defaultSystemPrompt}
      emptyModelsMessage={t('No Hermes models available')}
      initialCapabilityCategory={category}
      initialCapabilitySection={capabilitySection}
      initialMessageSection={messageSection}
      initialPanel={panel}
      initialResultScope={scope}
      initialResultType={resultType}
      initialSkill={skill}
      initialTeamId={Number(teamId)}
      queryKeyPrefix='team-workspace'
      suggestedPrompts={suggestedPrompts}
      workspaceMode='team'
    />
  )
}
