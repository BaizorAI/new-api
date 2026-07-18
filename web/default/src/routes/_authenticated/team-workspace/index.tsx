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
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import {
  HERMES_RESULT_SCOPES,
  HERMES_RESULT_TYPES,
  HERMES_ROUTE_SECTIONS,
  HERMES_TEAM_PANELS,
} from '@/features/hermes-playground/lib/workspace-panel-controller'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

const teamWorkspaceSearchSchema = z.object({
  team_id: z.coerce.number().int().positive().optional().catch(undefined),
  panel: z.enum(HERMES_TEAM_PANELS).optional().catch(undefined),
  section: z.enum(HERMES_ROUTE_SECTIONS).optional().catch(undefined),
  scope: z.enum(HERMES_RESULT_SCOPES).optional().catch(undefined),
  type: z.enum(HERMES_RESULT_TYPES).optional().catch(undefined),
  category: z.string().optional().catch(undefined),
  skill: z.string().optional().catch(undefined),
})

export const Route = createFileRoute('/_authenticated/team-workspace/')({
  validateSearch: teamWorkspaceSearchSchema,
  beforeLoad: ({ search }) => {
    if (!isSidebarModuleEnabled('chat', 'team_workspace')) {
      throw redirect({ to: '/dashboard' })
    }

    const { team_id, ...rest } = search

    if (team_id) {
      throw redirect({
        to: '/workspace/team/$teamId',
        params: { teamId: String(team_id) },
        search: rest,
      })
    }

    throw redirect({ to: '/home' })
  },
  component: TeamWorkspacePage,
})

function TeamWorkspacePage() {
  // This component is unreachable because the route always redirects.
  return null
}
