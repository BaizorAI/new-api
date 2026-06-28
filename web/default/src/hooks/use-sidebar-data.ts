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
  Box,
  BriefcaseBusiness,
  CreditCard,
  FileCheck2,
  FileText,
  FlaskConical,
  Key,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Radio,
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
 * The root order is intentionally user-workflow first. Technical and
 * operational surfaces remain available, but they sit behind Management or
 * Settings instead of competing with workspaces, skills, messages and results.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()

  return {
    navGroups: [
      {
        id: 'overview',
        title: t('Overview'),
        items: [
          {
            title: t('Workspace Home'),
            description: t(
              'Continue from teams, skills, conversations and results.'
            ),
            url: '/team-workspace',
            icon: LayoutDashboard,
            configUrls: ['/team-workspace'],
          },
        ],
      },
      {
        id: 'workbench',
        title: t('Workbench'),
        items: [
          {
            title: t('My Teams'),
            description: t('Team collaboration workspace'),
            icon: Users,
            type: 'team-workspaces',
          },
          {
            title: t('HermesAgent'),
            description: t('Personal AI workspace'),
            icon: IconHermes,
            type: 'hermes-sessions',
          },
          {
            title: t('My One-Person Company'),
            description: t('Personal business and project workspace'),
            url: '/one-person-company',
            icon: BriefcaseBusiness,
          },
        ],
      },
      {
        id: 'skill-store',
        title: t('Skill Store'),
        items: [
          {
            title: t('Skill Store'),
            description: t(
              'Choose proven skills by scenario and reuse them in personal or team work.'
            ),
            url: '/hermes-playground?panel=skills',
            configUrls: ['/hermes-playground'],
            icon: Sparkles,
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
            url: '/hermes-playground?panel=messages',
            configUrls: ['/hermes-playground'],
            icon: MessageSquare,
          },
        ],
      },
      {
        id: 'results',
        title: t('Results'),
        items: [
          {
            title: t('Latest results'),
            description: t('Reports, slides, documents and file results.'),
            url: '/hermes-playground?panel=results',
            configUrls: ['/hermes-playground'],
            icon: FileCheck2,
          },
        ],
      },
      {
        id: 'model-playground',
        title: t('Model Playground'),
        items: [
          {
            title: t('Model Playground'),
            icon: FlaskConical,
            type: 'playground-sessions',
          },
          {
            title: t('Chat'),
            icon: MessageSquare,
            type: 'chat-presets',
          },
        ],
      },
      {
        id: 'management',
        title: t('Management Backend'),
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
