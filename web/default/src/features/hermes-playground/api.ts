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
import { api } from '@/lib/api'

export interface CreateHermesSkillPayload {
  name: string
  description: string
  instructions: string
  category?: string
}

export async function createHermesSkill(payload: CreateHermesSkillPayload) {
  const content = buildSkillContent(payload)
  const response = await api.post(
    '/pg/hermes/skills',
    {
      name: payload.name,
      category: payload.category,
      content,
    },
    {
      skipBusinessError: true,
    }
  )
  return response.data
}

function buildSkillContent(payload: CreateHermesSkillPayload): string {
  const description = payload.description.trim()
  const instructions = payload.instructions.trim()

  return `---
name: ${quoteYamlString(payload.name.trim())}
description: ${quoteYamlString(description)}
---

# ${payload.name.trim()}

${instructions}
`
}

function quoteYamlString(value: string): string {
  return JSON.stringify(value)
}
