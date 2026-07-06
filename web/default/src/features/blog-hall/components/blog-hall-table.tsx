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
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'

import { getBlogArticles } from '../api'
import { getBlogArticleStatusOptions } from '../constants'
import { useBlogHallColumns } from './blog-hall-columns'
import { useBlogHall } from './blog-hall-provider'

const route = getRouteApi('/_authenticated/blog-hall/')

export function BlogHallTable() {
  const { t } = useTranslation()
  const columns = useBlogHallColumns()
  const { refreshTrigger } = useBlogHall()
  const isMobile = useMediaQuery('(max-width: 640px)')

  const {
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    columnFilters: [
      { columnId: 'status', searchKey: 'status', type: 'array' },
    ],
  })

  const statusFilter = (
    columnFilters.find((f) => f.id === 'status')?.value as string[] | undefined
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'blog-articles',
      pagination.pageIndex + 1,
      pagination.pageSize,
      statusFilter,
      refreshTrigger,
    ],
    queryFn: async () => {
      const status =
        statusFilter?.length === 1 ? statusFilter[0] : undefined
      const result = await getBlogArticles({
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        status,
      })
      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const articles = data?.items || []

  const { table } = useDataTable({
    data: articles,
    columns,
    columnFilters,
    pagination,
    onPaginationChange,
    onColumnFiltersChange,
    manualPagination: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  const statusOptions = useMemo(() => getBlogArticleStatusOptions(t), [t])

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No articles yet')}
      emptyDescription={t(
        'No articles yet. Start writing your first article.'
      )}
      skeletonKeyPrefix='blog-hall-skeleton'
      applyHeaderSize
      toolbarProps={{
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: statusOptions,
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
