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
import { FileBox, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

import { fetchAssets } from '../asset-center/api'
import type { AssetItem, AssetType } from '../asset-center/types'
import { ASSET_TYPE_LABELS } from '../asset-center/types'

type AssetPickerProps = {
  /** Whether the picker dialog is open */
  open: boolean
  /** Called when dialog open state changes */
  onOpenChange: (open: boolean) => void
  /** Filter assets to these types only */
  assetTypes?: AssetType[]
  /** Called when user selects an asset */
  onSelect: (asset: AssetItem) => void
  /** Dialog title */
  title?: string
}

/**
 * Reusable asset picker dialog.
 *
 * Embed this inside image-playground, video-playground, or studio to let
 * users browse and select assets from the unified asset center without
 * leaving their current workflow.
 */
export function AssetPicker({
  open,
  onOpenChange,
  assetTypes,
  onSelect,
  title,
}: AssetPickerProps) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['asset-picker', assetTypes, search],
    queryFn: () =>
      fetchAssets({
        asset_type: assetTypes?.length === 1 ? assetTypes[0] : undefined,
        search: search || undefined,
        page_size: 50,
      }),
    enabled: open,
  })

  const assets = useMemo(() => {
    if (!data?.items) return []
    if (!assetTypes || assetTypes.length === 0) return data.items
    return data.items.filter((a) => assetTypes.includes(a.asset_type))
  }, [data, assetTypes])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='sm:max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{title ?? t('Select Asset')}</DialogTitle>
        </DialogHeader>

        <div className='relative mb-3'>
          <Search className='text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2' />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('Search assets...')}
            className='h-8 pl-9 text-sm'
          />
        </div>

        <ScrollArea className='max-h-80'>
          {isLoading ? (
            <div className='flex h-32 items-center justify-center'>
              <p className='text-muted-foreground text-sm'>
                {t('Loading...')}
              </p>
            </div>
          ) : assets.length === 0 ? (
            <div className='flex h-32 flex-col items-center justify-center gap-2'>
              <FileBox
                className='text-muted-foreground/40 size-8'
                aria-hidden='true'
              />
              <p className='text-muted-foreground text-sm'>
                {t('No assets found')}
              </p>
            </div>
          ) : (
            <div className='grid gap-2'>
              {assets.map((asset) => (
                <button
                  key={asset.id}
                  type='button'
                  className={cn(
                    'flex items-center gap-3 rounded-lg p-2 text-left transition-colors',
                    'hover:bg-accent'
                  )}
                  onClick={() => {
                    onSelect(asset)
                    onOpenChange(false)
                  }}
                >
                  {asset.thumbnail_url ? (
                    <img
                      src={asset.thumbnail_url}
                      alt={asset.name}
                      className='size-10 shrink-0 rounded object-cover'
                    />
                  ) : (
                    <div className='bg-muted flex size-10 shrink-0 items-center justify-center rounded'>
                      <FileBox
                        className='text-muted-foreground/40 size-5'
                        aria-hidden='true'
                      />
                    </div>
                  )}
                  <div className='min-w-0 flex-1'>
                    <p className='truncate text-sm font-medium'>
                      {asset.name}
                    </p>
                    <p className='text-muted-foreground text-xs'>
                      {t(ASSET_TYPE_LABELS[asset.asset_type])}
                    </p>
                  </div>
                  {asset.width > 0 ? (
                    <span className='text-muted-foreground shrink-0 text-xs'>
                      {asset.width}×{asset.height}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  )
}
