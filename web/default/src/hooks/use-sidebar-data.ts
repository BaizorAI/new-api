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
  Activity,
  Archive,
  BriefcaseBusiness,
  Box,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileArchive,
  FileCheck2,
  FileText,
  FlaskConical,
  History,
  Key,
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Plug,
  QrCode,
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
            url: '/wallet',
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
          {
            title: t('Skills'),
            url: '/hermes-playground?panel=skills&section=mine',
            configUrls: ['/hermes-playground'],
            icon: Sparkles,
          },
          {
            title: t('Tools'),
            url: '/hermes-playground?panel=skills&section=tools',
            configUrls: ['/hermes-playground'],
            icon: Plug,
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
        ],
      },
      {
        id: 'skill-store',
        title: t('Skill Store'),
        description: t('Find and create reusable work skills.'),
        icon: Sparkles,
        url: '/hermes-playground?panel=skills',
        position: 'top',
        items: [
          {
            title: t('My skills'),
            url: '/hermes-playground?panel=skills&section=mine',
            configUrls: ['/hermes-playground'],
            icon: User,
          },
          {
            title: t('Team skills'),
            url: '/hermes-playground?panel=skills&section=team',
            configUrls: ['/hermes-playground'],
            icon: Users,
          },
          {
            title: t('Baizor Skills'),
            url: '/hermes-playground?panel=skills&section=baizor',
            configUrls: ['/hermes-playground'],
            icon: Sparkles,
          },
          {
            type: 'hermes-jilai-skills' as const,
            title: t('Jilai Law Firm Skills'),
            icon: Scale,
          },
          {
            title: t('Built-in skills'),
            url: '/hermes-playground?panel=skills&section=builtin',
            configUrls: ['/hermes-playground'],
            icon: Archive,
          },
          {
            title: t('Tools'),
            url: '/hermes-playground?panel=skills&section=tools',
            configUrls: ['/hermes-playground'],
            icon: Plug,
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
        id: 'message-platform',
        title: t('Message Platform'),
        description: t('Connect external messages to the AI workspace.'),
        icon: MessageSquare,
        url: '/hermes-playground?panel=messages',
        position: 'top',
        items: [
          {
            title: t('Overview'),
            url: '/hermes-playground?panel=messages',
            configUrls: ['/hermes-playground'],
            icon: LayoutDashboard,
          },
          {
            title: t('WeChat'),
            description: t(
              'Connect WeChat so messages can enter your AI workspace.'
            ),
            url: '/hermes-playground?panel=messages&section=wechat',
            configUrls: ['/hermes-playground'],
            icon: QrCode,
          },
          {
            title: t('Message history'),
            url: '/hermes-playground?panel=messages&section=history',
            configUrls: ['/hermes-playground'],
            icon: History,
          },
          {
            title: t('Connection status'),
            url: '/hermes-playground?panel=messages&section=settings',
            configUrls: ['/hermes-playground'],
            icon: Radio,
          },
          {
            title: t('Auto-reply settings'),
            url: '/hermes-playground?panel=messages&section=settings',
            configUrls: ['/hermes-playground'],
            icon: Settings,
          },
        ],
      },
      {
        id: 'model-playground',
        title: t('Model Playground'),
        description: t('Try models and compare model capabilities.'),
        icon: FlaskConical,
        url: '/playground',
        position: 'top',
        items: [
          {
            title: t('AI chat'),
            url: '/playground',
            icon: MessageSquare,
            configUrls: ['/playground'],
          },
          {
            title: t('Large model trial'),
            url: '/playground',
            icon: FlaskConical,
            configUrls: ['/playground'],
          },
          {
            title: t('Model capability comparison'),
            url: '/dashboard/models',
            icon: Activity,
            configUrls: ['/dashboard'],
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
            title: t('Access Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Platform Overview'),
            url: '/dashboard/overview',
            icon: Activity,
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
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Sidebar Personal Settings'),
            url: '/profile?section=sidebar',
            configUrls: ['/profile'],
            icon: Settings,
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
