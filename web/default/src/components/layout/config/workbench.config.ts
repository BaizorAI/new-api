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
import type { TFunction } from 'i18next'
import { BriefcaseBusiness, Users } from 'lucide-react'

import { IconHermes } from '@/assets/brand-icons'

import type { NavGroup, SidebarView } from '../types'

function getWorkbenchNavGroups(t: TFunction): NavGroup[] {
  return [
    {
      id: 'personal-workspace',
      title: t('Personal Workspace'),
      items: [
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
      ],
    },
    {
      id: 'team-workspace',
      title: t('Team Workspace'),
      items: [
        {
          title: t('Team Workspace'),
          description: t('Team collaboration workspace'),
          icon: Users,
          type: 'team-workspaces',
          variant: 'flat',
        },
      ],
    },
  ]
}

export const WORKBENCH_VIEW: SidebarView = {
  id: 'workbench',
  pathPattern: /^\/(team-workspace|hermes-playground|one-person-company)(\/|$)/,
  getNavGroups: getWorkbenchNavGroups,
}
