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
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { HermesAgentWorkspace } from '@/features/hermes-playground/components/hermes-agent-workspace'
import {
  HERMES_PERSONAL_PANELS,
  HERMES_RESULT_SCOPES,
  HERMES_RESULT_TYPES,
  HERMES_ROUTE_SECTIONS,
  isHermesCapabilitySection,
  isHermesMessageSection,
} from '@/features/hermes-playground/lib/workspace-panel-controller'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

const hermesPlaygroundSearchSchema = z.object({
  panel: z.enum(HERMES_PERSONAL_PANELS).optional().catch(undefined),
  section: z.enum(HERMES_ROUTE_SECTIONS).optional().catch(undefined),
  scope: z.enum(HERMES_RESULT_SCOPES).optional().catch(undefined),
  type: z.enum(HERMES_RESULT_TYPES).optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  skill: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/hermes-playground/')({
  validateSearch: hermesPlaygroundSearchSchema,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'hermes_playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: HermesPlaygroundPage,
})

function HermesPlaygroundPage() {
  const { t } = useTranslation()
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

  return (
    <HermesAgentWorkspace
      defaultSystemPrompt='Use Chinese by default unless the user asks otherwise.'
      emptyModelsMessage={t('No Hermes models available')}
      initialCapabilityCategory={category}
      initialCapabilitySection={capabilitySection}
      initialMessageSection={messageSection}
      initialPanel={panel}
      initialResultScope={scope}
      initialResultType={resultType}
      initialSkill={skill}
      queryKeyPrefix='hermes-playground'
    />
  )
}
