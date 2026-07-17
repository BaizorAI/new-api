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
import {
  FileBox,
  Grid3X3,
  LayoutList,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

import { deleteAsset, fetchAssets } from './api'
import type { AssetItem, AssetType } from './types'
import { ASSET_TYPE_LABELS } from './types'

export function AssetCenter() {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['asset-center', searchQuery, typeFilter, page],
    queryFn: () =>
      fetchAssets({
        search: searchQuery,
        asset_type: typeFilter !== 'all' ? typeFilter : undefined,
        page,
        page_size: 24,
      }),
  })

  const assets = data?.items ?? []
  const total = data?.total ?? 0

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-border flex items-center justify-between border-b px-6 py-4'>
        <div className='flex items-center gap-2'>
          <FileBox className='text-primary size-5' aria-hidden='true' />
          <h1 className='text-lg font-semibold'>{t('Asset Center')}</h1>
        </div>
        <div className='flex items-center gap-2'>
          <Button
            variant='ghost'
            size='icon'
            className={cn('size-8', viewMode === 'grid' && 'bg-accent')}
            onClick={() => setViewMode('grid')}
            aria-label={t('Grid view')}
          >
            <Grid3X3 className='size-4' />
          </Button>
          <Button
            variant='ghost'
            size='icon'
            className={cn('size-8', viewMode === 'list' && 'bg-accent')}
            onClick={() => setViewMode('list')}
            aria-label={t('List view')}
          >
            <LayoutList className='size-4' />
          </Button>
        </div>
      </div>

      {/* Search & filter bar */}
      <div className='border-border flex items-center gap-3 border-b px-6 py-3'>
        <div className='relative flex-1'>
          <Search className='text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2' />
          <Input
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value)
              setPage(1)
            }}
            placeholder={t('Search assets...')}
            className='h-8 pl-9 text-sm'
          />
        </div>
        <Select
          value={typeFilter}
          onValueChange={(v) => {
            setTypeFilter(v)
            setPage(1)
          }}
        >
          <SelectTrigger className='h-8 w-36 text-sm'>
            <SelectValue placeholder={t('All Types')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value='all'>{t('All Types')}</SelectItem>
            {(Object.entries(ASSET_TYPE_LABELS) as [AssetType, string][]).map(
              ([value, labelKey]) => (
                <SelectItem key={value} value={value}>
                  {t(labelKey)}
                </SelectItem>
              )
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <ScrollArea className='flex-1'>
        {isLoading ? (
          <div className='flex h-64 items-center justify-center'>
            <p className='text-muted-foreground text-sm'>{t('Loading...')}</p>
          </div>
        ) : assets.length === 0 ? (
          <EmptyState />
        ) : viewMode === 'grid' ? (
          <AssetGrid
            assets={assets}
            onDelete={(id) => {
              void deleteAsset(id).then(() => refetch())
            }}
          />
        ) : (
          <AssetList
            assets={assets}
            onDelete={(id) => {
              void deleteAsset(id).then(() => refetch())
            }}
          />
        )}

        {/* Pagination */}
        {total > 24 ? (
          <div className='flex items-center justify-between px-6 py-3'>
            <p className='text-muted-foreground text-xs'>
              {t('{{total}} assets', { total })}
            </p>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                {t('Previous')}
              </Button>
              <span className='text-sm'>{page}</span>
              <Button
                variant='outline'
                size='sm'
                disabled={page * 24 >= total}
                onClick={() => setPage((p) => p + 1)}
              >
                {t('Next')}
              </Button>
            </div>
          </div>
        ) : null}
      </ScrollArea>
    </div>
  )
}

function EmptyState() {
  const { t } = useTranslation()
  return (
    <div className='flex h-64 flex-col items-center justify-center gap-4'>
      <FileBox className='text-muted-foreground/40 size-12' aria-hidden='true' />
      <p className='text-muted-foreground text-sm'>
        {t(
          'Your asset library is empty. Assets from Image Lab, Video Lab, and Film Studio will appear here automatically.'
        )}
      </p>
    </div>
  )
}

function AssetGrid(props: {
  assets: AssetItem[]
  onDelete: (id: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='grid gap-4 p-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'>
      {props.assets.map((asset) => (
        <AssetCard key={asset.id} asset={asset} onDelete={props.onDelete} />
      ))}
    </div>
  )
}

function AssetList(props: {
  assets: AssetItem[]
  onDelete: (id: number) => void
}) {
  const { t } = useTranslation()
  return (
    <div className='divide-y'>
      {props.assets.map((asset) => (
        <div
          key={asset.id}
          className='flex items-center gap-4 px-6 py-3 hover:bg-muted/50'
        >
          <Thumbnail asset={asset} className='size-10' />
          <div className='min-w-0 flex-1'>
            <p className='truncate text-sm font-medium'>{asset.name}</p>
            <p className='text-muted-foreground text-xs'>
              {t(ASSET_TYPE_LABELS[asset.asset_type])}
              {asset.width > 0 ? ` · ${asset.width}×${asset.height}` : ''}
              {asset.duration > 0 ? ` · ${asset.duration}s` : ''}
            </p>
          </div>
          <Button
            variant='ghost'
            size='icon'
            className='size-7'
            onClick={() => props.onDelete(asset.id)}
            aria-label={t('Delete')}
          >
            <Trash2 className='size-3.5' />
          </Button>
        </div>
      ))}
    </div>
  )
}

function AssetCard(props: {
  asset: AssetItem
  onDelete: (id: number) => void
}) {
  const { t } = useTranslation()
  const { asset, onDelete } = props

  return (
    <div className='border-border bg-card hover:bg-accent/50 group relative flex flex-col rounded-lg border p-3 transition-colors'>
      <Thumbnail asset={asset} className='mb-2 h-32 w-full' />

      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{asset.name}</p>
          <p className='text-muted-foreground text-xs'>
            {t(ASSET_TYPE_LABELS[asset.asset_type])}
          </p>
          {asset.width > 0 ? (
            <p className='text-muted-foreground text-xs'>
              {asset.width}×{asset.height}
              {asset.duration > 0 ? ` · ${asset.duration}s` : ''}
            </p>
          ) : null}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant='ghost'
              size='icon'
              className='size-7 shrink-0 opacity-0 group-hover:opacity-100'
              aria-label={t('More actions')}
            >
              <Trash2 className='size-3.5' />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align='end'>
            <DropdownMenuItem
              className='text-destructive'
              onClick={() => onDelete(asset.id)}
            >
              {t('Delete')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  )
}

function Thumbnail(props: { asset: AssetItem; className?: string }) {
  const { asset, className } = props

  if (asset.thumbnail_url || asset.url) {
    return (
      <img
        src={asset.thumbnail_url || asset.url}
        alt={asset.name}
        className={cn('rounded object-cover', className)}
        loading='lazy'
      />
    )
  }

  // Placeholder based on asset type
  return (
    <div
      className={cn(
        'bg-muted flex items-center justify-center rounded',
        className
      )}
    >
      <FileBox className='text-muted-foreground/30 size-8' aria-hidden='true' />
    </div>
  )
}

export { ASSET_TYPE_LABELS }
