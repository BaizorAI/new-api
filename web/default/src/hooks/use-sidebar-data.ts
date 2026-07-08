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
import {
  Archive,
  BriefcaseBusiness,
  BookOpen,
  Box,
  CircleHelp,
  ClipboardList,
  CreditCard,
  Crown,
  FileArchive,
  FileCheck2,
  FileText,
  FlaskConical,
  Gift,
  Key,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  PenLine,
  Radio,
  Scale,
  ServerCog,
  Settings,
  Sparkles,
  Ticket,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { IconHermes } from '@/assets/brand-icons'
import type { SidebarData } from '@/components/layout/types'
import { ROLE } from '@/lib/roles'

/**
 * Product-first sidebar data.
 *
 * Each group is a first-column product entry. The group's items are the
 * second-column flat menu for that product; existing route targets are kept.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()

  return {
    navGroups: [
      {
        id: 'overview',
        title: t('Overview'),
        description: t('Start from recent work, results, skills and quota.'),
        icon: LayoutDashboard,
        url: '/team-workspace',
        position: 'top',
        items: [
          {
            title: t('Continue work'),
            url: '/team-workspace',
            icon: MessageSquare,
            configUrls: ['/team-workspace'],
          },
          {
            title: t('Recent results'),
            url: '/hermes-playground?panel=results&scope=all',
            configUrls: ['/hermes-playground'],
            icon: FileCheck2,
          },
          {
            title: t('Common skills'),
            url: '/hermes-playground?panel=skills',
            configUrls: ['/hermes-playground'],
            icon: Sparkles,
          },
          {
            title: t('Team activity'),
            url: '/team-workspace',
            icon: Users,
            configUrls: ['/team-workspace'],
          },
          {
            title: t('Quota status'),
            url: '/wallet/overview',
            icon: Wallet,
          },
        ],
      },
      {
        id: 'workbench',
        title: t('Workbench'),
        description: t('Personal agent work and execution tasks.'),
        icon: BriefcaseBusiness,
        url: '/hermes-playground',
        position: 'top',
        items: [
          {
            title: t('HermesAgent'),
            description: t('Personal AI workspace'),
            url: '/hermes-playground',
            activeUrls: ['/hermes-playground'],
            icon: IconHermes,
          },
          {
            title: t('Sessions'),
            description: t('Manage Hermes conversations.'),
            type: 'hermes-sessions',
            icon: MessageSquare,
          },
          {
            title: t('My One-Person Company'),
            description: t('Personal business and project workspace'),
            url: '/one-person-company',
            icon: BriefcaseBusiness,
          },
          {
            type: 'hermes-skill-section' as const,
            section: 'mine' as const,
            title: t('My skills'),
            icon: User,
          },
          {
            type: 'hermes-skill-section' as const,
            section: 'team' as const,
            title: t('Team skills'),
            icon: Users,
          },
          {
            type: 'hermes-skill-section' as const,
            section: 'baizor' as const,
            title: t('Baizor Skills'),
            icon: Sparkles,
          },
          {
            type: 'hermes-jilai-skills' as const,
            title: t('Jilai Law Firm Skills'),
            icon: Scale,
          },
          {
            title: t('Execution tasks'),
            description: t('View running, completed and failed agent tasks.'),
            type: 'hermes-execution-tasks',
            icon: ListChecks,
          },
          {
            title: t('Results'),
            url: '/hermes-playground?panel=results&scope=mine',
            configUrls: ['/hermes-playground'],
            icon: FileCheck2,
          },
        ],
      },
      {
        id: 'team-collaboration',
        title: t('Team Collaboration'),
        description: t('Shared team sessions, results, skills and tasks.'),
        icon: Users,
        url: '/teams',
        position: 'top',
        items: [
          {
            title: t('My team list'),
            url: '/teams',
            icon: Users,
            configUrls: ['/teams'],
          },
          {
            title: t('Team workspaces'),
            description: t('Team collaboration workspace'),
            icon: Users,
            type: 'team-workspaces',
            variant: 'flat',
          },
          {
            title: t('Team tasks'),
            description: t('View team execution tasks and progress.'),
            type: 'hermes-execution-tasks',
            icon: ListChecks,
          },
        ],
      },
      {
        id: 'results-center',
        title: t('Results Center'),
        description: t('Reports, slides, documents and file results.'),
        icon: FileCheck2,
        url: '/hermes-playground?panel=results&scope=all',
        position: 'top',
        items: [
          {
            title: t('All results'),
            url: '/hermes-playground?panel=results&scope=all',
            configUrls: ['/hermes-playground'],
            icon: FileCheck2,
          },
          {
            title: t('Reports'),
            url: '/hermes-playground?panel=results&scope=all&type=report',
            configUrls: ['/hermes-playground'],
            icon: FileText,
          },
          {
            title: t('PPT'),
            url: '/hermes-playground?panel=results&scope=all&type=ppt',
            configUrls: ['/hermes-playground'],
            icon: ClipboardList,
          },
          {
            title: t('Documents'),
            url: '/hermes-playground?panel=results&scope=all&type=document',
            configUrls: ['/hermes-playground'],
            icon: FileText,
          },
          {
            title: t('Attachments'),
            url: '/hermes-playground?panel=results&scope=all&type=attachment',
            configUrls: ['/hermes-playground'],
            icon: FileArchive,
          },
        ],
      },
      {
        id: 'blog-hall',
        title: t('Blog Hall'),
        description: t('Write, edit and publish articles to Blog Hall.'),
        icon: BookOpen,
        url: '/blog-hall',
        position: 'top',
        items: [
          {
            title: t('Blog Hall'),
            description: t('Write, edit and publish articles to Blog Hall.'),
            type: 'blog-articles' as const,
            icon: BookOpen,
          },
        ],
      },
      {
        id: 'management',
        title: t('Management'),
        description: t('Team, user, model and billing administration.'),
        icon: ServerCog,
        url: '/dashboard/overview',
        position: 'bottom',
        requiredRole: ROLE.ADMIN,
        items: [
          {
            title: t('Team Management'),
            url: '/teams',
            icon: Users,
          },
          {
            title: t('User Management'),
            url: '/users',
            icon: Users,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Channel Management'),
            url: '/channels',
            icon: Radio,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Model Management'),
            url: '/models/metadata',
            icon: Box,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Billing Management'),
            url: '/subscriptions',
            icon: CreditCard,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('System Logs'),
            url: '/usage-logs/common',
            icon: FileText,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('Redeem codes'),
            url: '/redemption-codes',
            icon: Ticket,
            requiredRole: ROLE.ADMIN,
          },
        ],
      },
      {
        id: 'settings',
        title: t('Settings'),
        description: t('Account, security, preferences and system settings.'),
        icon: Settings,
        url: '/profile?section=account',
        position: 'bottom',
        items: [
          {
            title: t('Account settings'),
            url: '/profile?section=account',
            configUrls: ['/profile'],
            icon: User,
          },
          {
            title: t('Message Platform'),
            url: '/hermes-playground?panel=messages',
            configUrls: ['/hermes-playground'],
            icon: MessageSquare,
          },
          {
            title: t('Model Playground'),
            url: '/playground',
            configUrls: ['/playground'],
            icon: FlaskConical,
          },
          {
            title: t('Security settings'),
            url: '/profile?section=security',
            configUrls: ['/profile'],
            icon: Key,
          },
          {
            title: t('Preference settings'),
            url: '/profile?section=preferences',
            configUrls: ['/profile'],
            icon: Settings,
          },
          {
            title: t('Hermes Capability Center'),
            url: '/hermes-playground?panel=skills&section=builtin',
            configUrls: ['/hermes-playground'],
            icon: Archive,
          },
          {
            title: t('System configuration'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
      {
        id: 'personal-center',
        title: t('Personal Center'),
        description: t('Profile, wallet and personal navigation settings.'),
        icon: User,
        url: '/profile?section=profile',
        position: 'bottom',
        items: [
          {
            title: t('Profile'),
            url: '/profile?section=profile',
            configUrls: ['/profile'],
            icon: User,
          },
          {
            title: t('Model Square'),
            url: '/pricing',
            icon: Box,
          },
          {
            title: t('Wallet Overview'),
            url: '/wallet/overview',
            configUrls: ['/wallet'],
            icon: Wallet,
          },
          {
            title: t('Add Funds'),
            url: '/wallet/topup',
            configUrls: ['/wallet'],
            icon: CreditCard,
          },
          {
            title: t('Redemption Code'),
            url: '/wallet/redeem',
            configUrls: ['/wallet'],
            icon: Ticket,
          },
          {
            title: t('Subscription Plans'),
            url: '/wallet/subscriptions',
            configUrls: ['/wallet'],
            icon: Crown,
          },
          {
            title: t('Affiliate Rewards'),
            url: '/wallet/affiliate',
            configUrls: ['/wallet'],
            icon: Gift,
          },
          {
            title: t('Access Keys'),
            url: '/keys',
            icon: Key,
          },
        ],
      },
      {
        id: 'help-docs',
        title: t('Help / Docs'),
        description: t('Open product help and documentation.'),
        icon: CircleHelp,
        url: '/docs',
        position: 'bottom',
        items: [
          {
            title: t('Documentation map'),
            url: '/docs',
            icon: CircleHelp,
          },
          {
            title: t('View Documentation'),
            url: '/docs',
            icon: FileText,
          },
        ],
      },
    ],
  }
}
