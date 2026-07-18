import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

import { Main } from '@/components/layout'
import { ImagePlayground } from '@/features/image-playground'
import { isSidebarModuleEnabled } from '@/lib/nav-modules'

const imagePlaygroundSearchSchema = z.object({
  action: z.enum(['onboarding']).optional(),
})

export const Route = createFileRoute('/_authenticated/image-playground/')({
  validateSearch: imagePlaygroundSearchSchema,
  beforeLoad: () => {
    if (!isSidebarModuleEnabled('chat', 'playground')) {
      throw redirect({ to: '/dashboard' })
    }
  },
  component: ImagePlaygroundPage,
})

function ImagePlaygroundPage() {
  const { action } = Route.useSearch()
  return (
    <Main className='p-0'>
      <ImagePlayground defaultModel='huayu-drama-4' action={action} />
    </Main>
  )
}
