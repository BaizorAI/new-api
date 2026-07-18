import { createFileRoute } from '@tanstack/react-router'

import { Main } from '@/components/layout'
import { SwapLab } from '@/features/swap-lab'

export const Route = createFileRoute('/_authenticated/swap-lab/')({
  component: SwapLabPage,
})

function SwapLabPage() {
  return (
    <Main className='p-0'>
      <SwapLab />
    </Main>
  )
}
