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
  Building2,
  Bot,
  Box,
  CircleHelp,
  Clapperboard,
  Code2,
  CreditCard,
  Crown,
  FileCheck2,
  FileText,
  FlaskConical,
  FolderPlus,
  Gift,
  History,
  ImageIcon,
  Key,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquare,
  Palette,
  PenLine,
  Puzzle,
  Radio,
  ServerCog,
  Settings,
  Sparkles,
  Ticket,
  User,
  Users,
  Video,
  Wallet,
  Wrench,
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
        iconColor: 'text-sky-500',
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
            url: '/skill-editor',
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
        iconColor: 'text-amber-500',
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
            title: t('My tasks'),
            description: t('View your running, completed and failed tasks.'),
            type: 'hermes-execution-tasks',
            icon: ListChecks,
          },
          {
            title: t('My results'),
            description: t('Reports, slides, documents and files from your work.'),
            url: '/hermes-playground?panel=results&scope=user',
            configUrls: ['/hermes-playground'],
            icon: FileCheck2,
          },
        ],
      },
      {
        id: 'one-person-company',
        title: t('One-Person Company'),
        description: t('Run your solo business by department.'),
        icon: Building2,
        iconColor: 'text-violet-500',
        url: '/one-person-company',
        position: 'top',
        items: [
          {
            title: t('Marketing department'),
            url: '/one-person-company?dept=marketing',
            icon: Megaphone,
          },
          {
            title: t('Operations department'),
            url: '/one-person-company?dept=ops',
            icon: ListChecks,
          },
          {
            title: t('Design department'),
            url: '/one-person-company?dept=design',
            icon: Palette,
          },
          {
            title: t('R&D department'),
            url: '/one-person-company?dept=rd',
            icon: Code2,
          },
        ],
      },
      {
        id: 'film-studio',
        title: t('Film Studio'),
        description: t('Create films with AI-powered production pipeline.'),
        icon: Clapperboard,
        iconColor: 'text-rose-500',
        url: '/studio',
        position: 'top',
        items: [
          {
            title: t('All Projects'),
            description: t('View and manage film projects.'),
            url: '/studio',
            activeUrls: ['/studio'],
            icon: Clapperboard,
          },
          {
            title: t('New Project'),
            description: t('Create a new film project.'),
            url: '/studio?action=create',
            icon: FolderPlus,
          },
        ],
      },
      {
        id: 'team-collaboration',
        title: t('Team Collaboration'),
        description: t('Shared team sessions, results, skills and tasks.'),
        icon: Users,
        iconColor: 'text-emerald-500',
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
        id: 'blog-hall',
        title: t('Blog Hall'),
        description: t('Write, edit and publish articles to Blog Hall.'),
        icon: BookOpen,
        iconColor: 'text-pink-500',
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
        iconColor: 'text-slate-500',
        url: '/dashboard/overview',
        position: 'bottom',
        requiredRole: ROLE.ADMIN,
        items: [
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
        id: 'model-trial',
        title: t('Model Trial'),
        description: t('Try out different AI models'),
        icon: FlaskConical,
        iconColor: 'text-violet-500',
        url: '/playground',
        position: 'bottom',
        items: [
          {
            title: t('Chat Model'),
            url: '/playground',
            configUrls: ['/playground'],
            icon: MessageSquare,
          },
          {
            title: t('Image Model'),
            url: '/image-playground',
            configUrls: ['/image-playground'],
            icon: ImageIcon,
          },
          {
            title: t('Video Model'),
            url: '/video-playground',
            configUrls: ['/video-playground'],
            icon: Video,
          },
        ],
      },
      {
        id: 'settings',
        title: t('Settings'),
        description: t('Account, security, preferences and system settings.'),
        icon: Settings,
        iconColor: 'text-zinc-500',
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
        id: 'capability-skills',
        title: t('Skills'),
        description: t('Manage skills and tools'),
        icon: Sparkles,
        iconColor: 'text-amber-500',
        url: '/skill-editor',
        position: 'bottom',
        defaultOpen: true,
        items: [
          {
            title: t('My skills'),
            url: '/skill-editor?section=mine',
            icon: User,
          },
          {
            title: t('Team skills'),
            url: '/skill-editor?section=team',
            icon: Users,
          },
          {
            title: t('Platform skills'),
            url: '/skill-editor?section=platform',
            icon: Sparkles,
          },
          {
            title: t('Built-in skills'),
            url: '/skill-editor?section=builtin',
            icon: Archive,
          },
        ],
      },
      {
        id: 'capability-tools',
        title: t('Tools'),
        description: t('Browse and configure Hermes toolsets.'),
        icon: Wrench,
        iconColor: 'text-slate-500',
        url: '/tools-editor',
        position: 'bottom',
        defaultOpen: true,
        items: [
          {
            title: t('All tools'),
            url: '/tools-editor',
            icon: Wrench,
          },
          {
            title: t('Enabled'),
            url: '/tools-editor?filter=enabled',
            icon: Wrench,
          },
          {
            title: t('Disabled'),
            url: '/tools-editor?filter=disabled',
            icon: Wrench,
          },
          {
            title: t('Configured'),
            url: '/tools-editor?filter=configured',
            icon: Wrench,
          },
          {
            title: t('Needs configuration'),
            url: '/tools-editor?filter=unconfigured',
            icon: Wrench,
          },
        ],
      },
      {
        id: 'personal-center',
        title: t('Personal Center'),
        description: t('Profile, wallet and personal navigation settings.'),
        icon: User,
        iconColor: 'text-cyan-500',
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
            title: t('Usage Records'),
            url: '/my-usage-logs',
            configUrls: ['/my-usage-logs'],
            icon: History,
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
        iconColor: 'text-indigo-500',
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
