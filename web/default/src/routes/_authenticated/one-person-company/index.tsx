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

import {
  HermesAgentWorkspace,
  type HermesPromptSuggestion,
} from '@/features/hermes-playground/components/hermes-agent-workspace'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

export const Route = createFileRoute('/_authenticated/one-person-company/')({
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'one_person_company')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: OnePersonCompanyPage,
})

function OnePersonCompanyPage() {
  const { t } = useTranslation()

  const suggestedPrompts = useMemo<HermesPromptSuggestion[]>(
    () => [
      {
        label: t('Today Operations'),
        prompt: t(
          'Create a concise one-person company operating plan for today. Include priorities, customer work, content, delivery, risks and next actions.'
        ),
      },
      {
        label: t('Offer'),
        prompt: t(
          'Help me package one service offer. Include target customer, problem, deliverables, price tiers, proof points and sales script.'
        ),
      },
      {
        label: t('Content'),
        prompt: t(
          'Create a customer acquisition content plan for a one-person company. Include topics, hooks, publishing channels and conversion actions.'
        ),
      },
      {
        label: t('Sales Follow-up'),
        prompt: t(
          'Create a customer follow-up plan. Include qualification questions, next message, objection handling and closing steps.'
        ),
      },
      {
        label: t('Delivery'),
        prompt: t(
          'Create a delivery plan for a client project. Include milestones, checklist, required inputs, risks and acceptance criteria.'
        ),
      },
      {
        label: t('Review'),
        prompt: t(
          'Run a weekly business review for a one-person company. Summarize revenue, leads, delivery, bottlenecks, decisions and next week actions.'
        ),
      },
    ],
    [t]
  )

  return (
    <HermesAgentWorkspace
      baseScopePrefix='one_person_company'
      defaultSystemPrompt={t(
        'You are a one-person company operating assistant. Use Chinese by default. Focus on practical business outcomes: positioning, offers, customer acquisition, sales follow-up, delivery, finance and review. Prefer structured tables, checklists, documents and executable next actions. Avoid vague advice.'
      )}
      emptyModelsMessage={t('No Hermes models available')}
      queryKeyPrefix='one-person-company'
      suggestedPrompts={suggestedPrompts}
    />
  )
}
