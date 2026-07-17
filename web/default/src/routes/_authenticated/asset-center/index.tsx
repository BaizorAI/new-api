import { createFileRoute } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { AssetCenter } from '@/features/asset-center'

export const Route = createFileRoute('/_authenticated/asset-center/')({
  component: AssetCenterPage,
})

function AssetCenterPage() {
  return (
    <Main className='p-0'>
      <AssetCenter />
    </Main>
  )
}
