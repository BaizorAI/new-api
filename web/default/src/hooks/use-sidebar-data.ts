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
  BookOpen,
  Building2,
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
  Home,
  ImageIcon,
  Key,
  LayoutDashboard,
  ListChecks,
  Megaphone,
  MessageSquare,
  Palette,
  Radio,
  ServerCog,
  Settings,
  Sparkles,
  Ticket,
  User,
  UserCircle,
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
        id: 'home',
        title: t('Home'),
        description: t('Start from recent work, results, skills and quota.'),
        icon: Home,
        iconColor: 'text-sky-500',
        url: '/home',
        position: 'top',
        items: [
          {
            title: t('Home'),
            url: '/home',
            icon: Home,
            activeUrls: ['/home'],
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
            title: t('Continue work'),
            url: '/hermes-playground?panel=sessions',
            icon: MessageSquare,
            configUrls: ['/hermes-playground'],
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
        id: 'film-studio',
        title: t('Film Studio'),
        description: t('原画设计 → 镜头渲染 → 角色重塑 → 项目编排 → 资产沉淀，一条龙影视 AIGC 工作台。'),
        icon: Clapperboard,
        iconColor: 'text-rose-500',
        url: '/image-playground',
        position: 'top',
        items: [
          {
            title: t('Image Lab'),
            description: t('原画生成、分镜关键帧、角色立绘与风格模板。'),
            url: '/image-playground',
            activeUrls: ['/image-playground'],
            icon: ImageIcon,
          },
          {
            title: t('Video Lab'),
            description: t('运镜控制、长片段分段生成、时间轴拼接。'),
            url: '/video-playground',
            activeUrls: ['/video-playground'],
            icon: Video,
          },
          {
            title: t('Image to Video'),
            description: t('上传一张图片，AI 将其转为动态视频。'),
            url: '/image-to-video',
            activeUrls: ['/image-to-video'],
            icon: Video,
          },
          {
            title: t('ComfyUI Video'),
            description: t('AI 视频生成，基于 ComfyUI LTX 2.3 模型。'),
            url: '/comfyui-playground',
            activeUrls: ['/comfyui-playground'],
            icon: Video,
          },
          {
            title: t('Swap Lab'),
            description: t('角色换装、风格迁移、局部替换。'),
            url: '/swap-lab',
            activeUrls: ['/swap-lab'],
            icon: Sparkles,
          },
          {
            title: t('Film Projects'),
            description: t('7 阶段影视流水线：剧本→角色→分镜→生成→后期→出片。'),
            url: '/studio',
            activeUrls: ['/studio'],
            icon: FolderPlus,
          },
          {
            title: t('Asset Center'),
            description: t('角色、分镜、片段、LoRA 模型跨工具自动同步。'),
            url: '/asset-center',
            activeUrls: ['/asset-center'],
            icon: Archive,
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
          {
            title: t('Team activity'),
            url: '/teams/activity',
            icon: Activity,
            configUrls: ['/teams/activity'],
          },
        ],
      },
      {
        id: 'personal-center',
        title: t('Personal Center'),
        description: t('Profile, wallet, playground, and personal navigation settings.'),
        icon: User,
        iconColor: 'text-cyan-500',
        url: '/playground',
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
            title: t('Chat Model'),
            description: t('Try out different AI chat models.'),
            url: '/playground',
            configUrls: ['/playground'],
            icon: FlaskConical,
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
        id: 'capabilities',
        title: t('Capabilities'),
        description: t('Manage skills and tools'),
        icon: Sparkles,
        iconColor: 'text-amber-500',
        url: '/skill-editor',
        position: 'bottom',
        items: [
          {
            title: t('Skills'),
            url: '/skill-editor',
            activeUrls: ['/skill-editor'],
            icon: Sparkles,
          },
          {
            title: t('Tools'),
            url: '/tools-editor',
            activeUrls: ['/tools-editor', '/toolset-detail'],
            icon: Wrench,
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
        position: 'bottom',
        items: [
          {
            title: t('Blog Hall'),
            url: '/blog-hall',
            icon: BookOpen,
            activeUrls: ['/blog-hall'],
          },
          {
            title: t('Author Profile'),
            url: '/blog-hall/author-profile',
            icon: UserCircle,
            activeUrls: ['/blog-hall/author-profile'],
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
            title: t('Platform Overview'),
            url: '/dashboard/overview',
            icon: LayoutDashboard,
            requiredRole: ROLE.ADMIN,
          },
          {
            title: t('Online Status'),
            url: '/online-status',
            icon: Activity,
            requiredRole: ROLE.ADMIN,
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
