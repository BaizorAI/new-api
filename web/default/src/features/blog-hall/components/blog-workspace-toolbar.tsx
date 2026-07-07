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
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import { useBlogWorkspace } from './blog-workspace-provider'

import type { BlogArticleStatus } from '../types'

export function BlogWorkspaceToolbar() {
  const { t } = useTranslation()
  const { title, setTitle, status, setStatus, save, isSaving, isDirty } =
    useBlogWorkspace()

  return (
    <div className='border-border flex shrink-0 items-center gap-3 border-b px-4 py-2'>
      <Select
        onValueChange={(value) => {
          if (value) setStatus(value as BlogArticleStatus)
        }}
        value={status}
      >
        <SelectTrigger className='w-32' aria-label={t('Status')}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            <SelectItem value='draft'>{t('Draft')}</SelectItem>
            <SelectItem value='published'>{t('Published')}</SelectItem>
            <SelectItem value='archived'>{t('Archived')}</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>

      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className='flex-1 border-none px-0 font-semibold shadow-none focus-visible:ring-0'
        placeholder={t('Article title...')}
      />

      <Button
        size='sm'
        disabled={isSaving || !isDirty}
        onClick={() => void save()}
      >
        {isSaving ? t('Saving...') : t('Save')}
      </Button>
    </div>
  )
}
