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
  Building2,
  Box,
  ClipboardList,
  CreditCard,
  Database,
  FileArchive,
  FileCheck2,
  FileText,
  FlaskConical,
  FolderOpen,
  History,
  Key,
  LayoutDashboard,
  ListChecks,
  ListTodo,
  MessageSquare,
  PenLine,
  Plug,
  Presentation,
  QrCode,
  Radio,
  Search,
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
 * Root navigation groups for the application sidebar.
 *
 * Each top-level group represents the first-column product entry. Its items
 * form the second-column object list for that entry. Technical and operational
 * surfaces remain available, but they sit behind Management or Settings.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()

  return {
    navGroups: [
      {
        id: 'workspace',
        title: t('Workspace'),
        items: [
          {
            title: t('Workspace overview'),
            description: t(
              'Continue from teams, skills, conversations and results.'
            ),
            url: '/team-workspace',
            icon: LayoutDashboard,
            configUrls: ['/team-workspace'],
          },
          {
            title: t('HermesAgent'),
            description: t('Personal AI workspace'),
            url: '/hermes-playground',
            activeUrls: ['/hermes-playground'],
            icon: IconHermes,
          },
          {
            title: t('My One-Person Company'),
            description: t('Personal business and project workspace'),
            url: '/one-person-company',
            icon: BriefcaseBusiness,
          },
          {
            title: t('Team Workspace'),
            description: t('Team collaboration workspace'),
            icon: Building2,
            type: 'team-workspaces',
            variant: 'collapsible',
          },
        ],
      },
      {
        id: 'skill-store',
        title: t('Skill Store'),
        items: [
          {
            title: t('Skill overview'),
            description: t(
              'Choose proven skills by scenario and reuse them in personal or team work.'
            ),
            url: '/hermes-playground?panel=skills',
            configUrls: ['/hermes-playground'],
            icon: Sparkles,
          },
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
          {
            title: t('Skill categories'),
            icon: FolderOpen,
            items: [
              {
                title: t('PPT and presentations'),
                url: '/hermes-playground?panel=skills&category=ppt',
                icon: Presentation,
              },
              {
                title: t('Research reports'),
                url: '/hermes-playground?panel=skills&category=report',
                icon: Search,
              },
              {
                title: t('Data analysis'),
                url: '/hermes-playground?panel=skills&category=data',
                icon: Database,
              },
              {
                title: t('Document writing'),
                url: '/hermes-playground?panel=skills&category=document',
                icon: PenLine,
              },
            ],
            configUrls: ['/hermes-playground'],
          },
        ],
      },
      {
        id: 'message-platforms',
        title: t('Message platforms'),
        items: [
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
            title: t('Execution tasks'),
            description: t('View running, completed and failed agent tasks.'),
            url: '/hermes-playground?panel=tasks',
            configUrls: ['/hermes-playground'],
            icon: ListChecks,
          },
          {
            title: t('Message history'),
            url: '/hermes-playground?panel=messages&section=history',
            configUrls: ['/hermes-playground'],
            icon: History,
          },
          {
            title: t('Connection settings'),
            url: '/hermes-playground?panel=messages&section=settings',
            configUrls: ['/hermes-playground'],
            icon: Settings,
          },
        ],
      },
      {
        id: 'results',
        title: t('Results'),
        items: [
          {
            title: t('All results'),
            description: t('Reports, slides, documents and file results.'),
            url: '/hermes-playground?panel=results',
            configUrls: ['/hermes-playground'],
            icon: FileCheck2,
          },
          {
            title: t('My results'),
            url: '/hermes-playground?panel=results&scope=mine',
            configUrls: ['/hermes-playground'],
            icon: User,
          },
          {
            title: t('Team results'),
            url: '/team-workspace',
            configUrls: ['/team-workspace'],
            icon: Users,
          },
          {
            title: t('PPT'),
            url: '/hermes-playground?panel=results&type=ppt',
            configUrls: ['/hermes-playground'],
            icon: Presentation,
          },
          {
            title: t('Reports'),
            url: '/hermes-playground?panel=results&type=report',
            configUrls: ['/hermes-playground'],
            icon: FileText,
          },
          {
            title: t('Documents'),
            url: '/hermes-playground?panel=results&type=document',
            configUrls: ['/hermes-playground'],
            icon: ClipboardList,
          },
          {
            title: t('Attachment results'),
            url: '/hermes-playground?panel=results&type=attachment',
            configUrls: ['/hermes-playground'],
            icon: FileArchive,
          },
        ],
      },
      {
        id: 'model-playground',
        title: t('Model Playground'),
        items: [
          {
            title: t('Model sessions'),
            icon: FlaskConical,
            type: 'playground-sessions',
          },
          {
            title: t('AI chat'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
        ],
      },
      {
        id: 'management',
        title: t('Management'),
        items: [
          {
            title: t('Team Management'),
            url: '/teams',
            icon: Users,
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
            title: t('Data Dashboard'),
            url: '/dashboard/models',
            icon: LayoutDashboard,
          },
          {
            title: t('Usage Details'),
            url: '/usage-logs/common',
            icon: FileText,
          },
          {
            title: t('Task Records'),
            url: '/usage-logs/task',
            activeUrls: ['/usage-logs/drawing'],
            configUrls: ['/usage-logs/drawing', '/usage-logs/task'],
            icon: ListTodo,
          },
          {
            title: t('Model Channels'),
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
            title: t('Users'),
            url: '/users',
            icon: Users,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Redeem codes'),
            url: '/redemption-codes',
            icon: Ticket,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Subscription Management'),
            url: '/subscriptions',
            icon: CreditCard,
            requiredRole: ROLE.ADMIN,
          },
        ],
      },
      {
        id: 'settings',
        title: t('Settings'),
        items: [
          {
            title: t('Wallet'),
            url: '/wallet',
            icon: Wallet,
          },
          {
            title: t('Profile'),
            url: '/profile',
            icon: User,
          },
          {
            title: t('System Info'),
            url: '/system-info',
            icon: ServerCog,
            requiredRole: ROLE.SUPER_ADMIN,
          },
          {
            title: t('System Settings'),
            url: '/system-settings/site',
            activeUrls: ['/system-settings'],
            icon: Settings,
            requiredRole: ROLE.SUPER_ADMIN,
          },
        ],
      },
    ],
  }
}
