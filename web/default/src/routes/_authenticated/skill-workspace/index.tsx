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
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'

import { HermesAgentWorkspace } from '@/features/hermes-playground/components/hermes-agent-workspace'
import { listHermesSkills } from '@/features/hermes-playground/api'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'
import { safeStorageScope } from '@/features/hermes-playground/sessions'

const searchSchema = z.object({
  skill: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/skill-workspace/')({
  validateSearch: searchSchema,
  beforeLoad: ({ search }) => {
    if (!isSidebarModuleEnabled('chat', 'hermes_playground')) {
      throw redirect({ to: '/dashboard' })
    }
    if (!search.skill) {
      throw redirect({
        to: '/hermes-playground',
        search: { panel: 'skills' },
      })
    }
  },
  component: SkillWorkspacePage,
})

function SkillWorkspacePage() {
  const { t } = useTranslation()
  const { skill: skillName = '' } = Route.useSearch()

  const { data: skills = [] } = useQuery({
    queryKey: ['skill-workspace', 'skills'],
    queryFn: listHermesSkills,
    staleTime: 5 * 60 * 1000,
  })

  const skill = skills.find((s) => s.name === skillName)
  const displayName = skill?.displayName || skill?.name || skillName
  const description = skill?.descriptionZh || skill?.description || ''

  const safeSkillName = safeStorageScope(skillName)

  const defaultSystemPrompt = [
    `你正在「${displayName}」技能工作台。`,
    description,
    `默认应用「${skillName}」技能。用中文回应，除非用户要求其他语言。`,
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <HermesAgentWorkspace
      baseScopePrefix={`skill_${safeSkillName}`}
      defaultSystemPrompt={defaultSystemPrompt}
      emptyModelsMessage={t('No Hermes models available')}
      queryKeyPrefix={`skill-workspace-${safeSkillName}`}
    />
  )
}
