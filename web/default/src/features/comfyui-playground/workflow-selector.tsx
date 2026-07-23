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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { fetchWorkflows } from './api'
import type { WorkflowListItem } from './types'

interface WorkflowSelectorProps {
  onSelect: (name: string) => void
  selectedName: string | null
  loading: boolean
  disabled: boolean
}

export function WorkflowSelector({
  onSelect,
  selectedName,
  loading,
  disabled,
}: WorkflowSelectorProps) {
  const { t } = useTranslation()
  const [workflows, setWorkflows] = useState<WorkflowListItem[]>([])

  useEffect(() => {
    fetchWorkflows()
      .then(setWorkflows)
      .catch(() => {})
  }, [])

  return (
    <div className='flex items-center gap-2'>
      <label className='text-sm font-medium text-muted-foreground whitespace-nowrap'>
        {t('Workflow')}:
      </label>
      <select
        className='max-w-[200px] rounded-lg border bg-background px-2 py-1 text-sm
          focus:outline-none focus:ring-2 focus:ring-primary/20'
        value={selectedName ?? ''}
        onChange={(e) => {
          const v = e.target.value
          if (v) onSelect(v)
        }}
        disabled={loading || disabled}
      >
        <option value=''>{t('Select workflow...')}</option>
        {workflows.map((w) => (
          <option key={w.name} value={w.name}>
            {w.name}
          </option>
        ))}
      </select>
      {loading && <span className='text-xs text-muted-foreground'>{t('Loading...')}</span>}
    </div>
  )
}
