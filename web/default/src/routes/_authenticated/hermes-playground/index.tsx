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
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

const hermesPlaygroundSearchSchema = z.object({
  panel: z.enum(['skills', 'messages', 'results']).optional().catch(undefined),
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
  const { panel } = Route.useSearch()

  return (
    <HermesAgentWorkspace
      defaultSystemPrompt='Use Chinese by default unless the user asks otherwise.'
      emptyModelsMessage={t('No Hermes models available')}
      initialPanel={panel}
      queryKeyPrefix='hermes-playground'
    />
  )
}
