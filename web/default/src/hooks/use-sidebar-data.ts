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
  FileText,
  FlaskConical,
  Key,
  LayoutDashboard,
  ListTodo,
  MessageSquare,
  Radio,
  ServerCog,
  Settings,
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
 * These are shown when the URL does not match any nested sidebar view
 * registered in `layout/lib/sidebar-view-registry.ts`.
 */
export function useSidebarData(): SidebarData {
  const { t } = useTranslation()

  return {
    navGroups: [
      {
        id: 'chat',
        title: t('Workspaces'),
        items: [
          {
            title: t('My Teams'),
            description: t('Team collaboration workspace'),
            icon: Users,
            type: 'team-workspaces',
          },
          {
            title: t('My One-Person Company'),
            description: t('Personal business and project workspace'),
            url: '/one-person-company',
            icon: BriefcaseBusiness,
          },
          {
            title: t('HermesAgent'),
            description: t('Personal AI workspace'),
            icon: IconHermes,
            type: 'hermes-sessions',
          },
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
        id: 'general',
        title: t('Management Backend'),
        items: [
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
            title: t('Access Keys'),
            url: '/keys',
            icon: Key,
          },
          {
            title: t('Team Management'),
            url: '/teams',
            icon: Users,
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
        ],
      },
      {
        id: 'personal',
        title: t('Personal'),
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
        ],
      },
      {
        id: 'admin',
        title: t('Advanced Settings'),
        items: [
          {
            title: t('Model Channels'),
            url: '/channels',
            icon: Radio,
          },
          {
            title: t('Model Management'),
            url: '/models/metadata',
            icon: Box,
          },
          {
            title: t('Users'),
            url: '/users',
            icon: Users,
          },
          {
            title: t('Redeem Codes'),
            url: '/redemption-codes',
            icon: Ticket,
          },
          {
            title: t('Subscription Management'),
            url: '/subscriptions',
            icon: CreditCard,
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
          },
        ],
      },
    ],
  }
}

