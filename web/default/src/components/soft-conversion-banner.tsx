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
import { Link } from '@tanstack/react-router'
import {
  ArrowRight,
  BookOpen,
  Building2,
  Copyright,
  Cpu,
  Shield,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/** The five business conversion paths from the UX design document. */
export type ConversionType =
  | 'license'        // Free → Enterprise upgrade
  | 'compute'        // Render queue → compute pack purchase
  | 'training'       // Tutorial completion → training course
  | 'private-deploy' // Sensitive content → private deployment
  | 'copyright'      // Export → copyright registration package

type ConversionConfig = {
  icon: React.ElementType
  iconColor: string
  titleKey: string
  descKey: string
  ctaKey: string
  ctaTo: string
}

const CONVERSION_CONFIGS: Record<ConversionType, ConversionConfig> = {
  license: {
    icon: Building2,
    iconColor: 'text-violet-500',
    titleKey: 'Unlock Enterprise features',
    descKey:
      'Upgrade to Enterprise for local deployment, team collaboration, LoRA fine-tuning, and priority compute.',
    ctaKey: 'View plans',
    ctaTo: '/pricing',
  },
  compute: {
    icon: Cpu,
    iconColor: 'text-amber-500',
    titleKey: 'Speed up your render',
    descKey:
      'Elastic compute boost reduces render time by up to 5×. Compare tiers and buy a compute pack without leaving your workflow.',
    ctaKey: 'Boost now',
    ctaTo: '/pricing',
  },
  training: {
    icon: BookOpen,
    iconColor: 'text-emerald-500',
    titleKey: 'Master AI filmmaking',
    descKey:
      'Join our director masterclass — hands-on training with real productions. Includes bonus compute credits.',
    ctaKey: 'Enroll now',
    ctaTo: '/pricing',
  },
  'private-deploy': {
    icon: Shield,
    iconColor: 'text-blue-500',
    titleKey: 'Keep your assets on-prem',
    descKey:
      'You are working with sensitive content. Private deployment ensures data never leaves your infrastructure.',
    ctaKey: 'Learn more',
    ctaTo: '/pricing',
  },
  copyright: {
    icon: Copyright,
    iconColor: 'text-rose-500',
    titleKey: 'Protect your work',
    descKey:
      'Register copyright and monitor for infringement. Upgrade to the full copyright package for official registration + automated takedowns.',
    ctaKey: 'Upgrade copyright',
    ctaTo: '/pricing',
  },
}

type SoftConversionBannerProps = {
  type: ConversionType
  /** Whether the banner is dismissible */
  dismissible?: boolean
  /** Called when the user dismisses the banner */
  onDismiss?: () => void
  className?: string
}

/**
 * Soft conversion banner — non-intrusive, in-flow business CTA.
 *
 * NEVER blocks the UI. Users can dismiss it or click through to the
 * relevant conversion page. Renders as a subtle side/bottom prompt
 * that respects the user's current workflow.
 *
 * Five conversion types: license, compute, training, private-deploy, copyright.
 */
export function SoftConversionBanner({
  type,
  dismissible = true,
  onDismiss,
  className,
}: SoftConversionBannerProps) {
  const { t } = useTranslation()
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  const config = CONVERSION_CONFIGS[type]
  const Icon = config.icon

  const handleDismiss = () => {
    setDismissed(true)
    onDismiss?.()
  }

  return (
    <div
      className={cn(
        'bg-muted/30 border-border/60 relative flex items-start gap-3 rounded-lg border p-3',
        className
      )}
    >
      <div
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-lg border bg-background',
          config.iconColor.replace('text-', 'border-').replace('-500', '/20')
        )}
      >
        <Icon className={cn('size-4', config.iconColor)} aria-hidden='true' />
      </div>

      <div className='min-w-0 flex-1'>
        <p className='text-xs font-semibold'>{t(config.titleKey)}</p>
        <p className='mt-0.5 text-[11px] leading-relaxed text-muted-foreground'>
          {t(config.descKey)}
        </p>
        <Link
          to={config.ctaTo}
          className='mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline'
        >
          {t(config.ctaKey)}
          <ArrowRight className='size-3' />
        </Link>
      </div>

      {dismissible ? (
        <Button
          variant='ghost'
          size='icon'
          className='size-6 shrink-0 text-muted-foreground hover:text-foreground'
          onClick={handleDismiss}
          aria-label={t('Dismiss')}
        >
          <X className='size-3' />
        </Button>
      ) : null}
    </div>
  )
}
