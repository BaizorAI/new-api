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

import {
  HermesAgentWorkspace,
  type HermesMessageSection,
} from '@/features/hermes-playground/components/hermes-agent-workspace'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

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

const hermesPlaygroundSearchSchema = z.object({
  panel: z
    .enum(['skills', 'messages', 'results', 'tasks'])
    .optional()
    .catch(undefined),
  section: z.enum(routeSections).optional().catch(undefined),
  scope: z.enum(resultScopes).optional().catch(undefined),
  type: z.enum(resultTypes).optional().catch(undefined),
  category: z.string().optional().catch(undefined),
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
    type: resultType,
  } = Route.useSearch()
  const capabilitySection = isCapabilitySection(section) ? section : undefined
  const messageSection = isMessageSection(section) ? section : undefined

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
      queryKeyPrefix='hermes-playground'
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
