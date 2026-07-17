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

For commercial licensing, please contact support@quantumnous.com.
*/
import { Building2, User, Users } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'

/**
 * Studio edition — determines which feature set the user sees.
 *
 * - `saas-light`: Individual creator / small team. Minimal canvas,
 *   one-click templates, lightweight editing.
 * - `enterprise-pro`: Medium-large studio. Full asset library,
 *   batch pipeline, LoRA training, team collaboration, compute dashboard.
 */
export type StudioEdition = 'saas-light' | 'enterprise-pro'

/**
 * Resolve the studio edition for the current user.
 *
 * This is a heuristic based on the user's plan/role. In production this
 * should check the user's subscription tier from the status endpoint.
 */
export function resolveStudioEdition(
  userRole: number,
  hasEnterprisePlan?: boolean
): StudioEdition {
  // Admins and root users get enterprise pro
  if (userRole >= 10) return 'enterprise-pro'
  // Users with enterprise plan get pro
  if (hasEnterprisePlan) return 'enterprise-pro'
  // Default: saas-light for individual creators
  return 'saas-light'
}

type StudioVersionGuardProps = {
  edition: StudioEdition
  children?: React.ReactNode
  /** Content shown only in saas-light (individual creator) view */
  saasContent?: React.ReactNode
  /** Content shown only in enterprise-pro view */
  enterpriseContent?: React.ReactNode
  className?: string
}

/**
 * StudioVersionGuard switches the UX between SaaS Light (individual)
 * and Enterprise Pro (studio) editions.
 *
 * Usage:
 * ```tsx
 * <StudioVersionGuard
 *   edition={edition}
 *   enterpriseContent={<LoraPanel />}
 * >
 *   <SharedContent />
 * </StudioVersionGuard>
 * ```
 */
export function StudioVersionGuard({
  edition,
  children,
  saasContent,
  enterpriseContent,
  className,
}: StudioVersionGuardProps) {
  const { t } = useTranslation()

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Edition badge */}
      <div className='border-b px-4 py-2'>
        <EditionBadge edition={edition} />
      </div>

      {/* Shared content */}
      <div className='flex-1'>{children}</div>

      {/* Edition-specific panels */}
      {edition === 'saas-light' && saasContent ? (
        <div className='border-t'>{saasContent}</div>
      ) : null}
      {edition === 'enterprise-pro' && enterpriseContent ? (
        <div className='border-t'>{enterpriseContent}</div>
      ) : null}
    </div>
  )
}

function EditionBadge({ edition }: { edition: StudioEdition }) {
  const { t } = useTranslation()

  if (edition === 'enterprise-pro') {
    return (
      <div className='flex items-center gap-2'>
        <Building2
          className='size-3.5 text-primary'
          aria-hidden='true'
        />
        <span className='text-[11px] font-medium text-primary'>
          {t('Enterprise Pro')}
        </span>
        <span className='ml-auto rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary'>
          {t('Full access')}
        </span>
      </div>
    )
  }

  return (
    <div className='flex items-center gap-2'>
      <User className='size-3.5 text-muted-foreground' aria-hidden='true' />
      <span className='text-[11px] font-medium text-muted-foreground'>
        {t('SaaS Light')}
      </span>
      <span className='ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground'>
        {t('Basic')}
      </span>
    </div>
  )
}

export type { StudioVersionGuardProps }
