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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Checkbox } from '@/components/ui/checkbox'
import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'

import { getStudioCharacters } from '../api'
import { STUDIO_QUERY_KEYS } from '../constants'
import {
  useCreateStudioShot,
  useUpdateStudioShot,
} from '../hooks/use-studio-mutations'
import type { StudioShot } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

const shotFormSchema = z.object({
  scene_number: z.coerce.number().int().min(1, 'Scene number is required'),
  shot_number: z.coerce.number().int().min(1, 'Shot number is required'),
  description: z.string().min(1, 'Description is required').max(500),
  camera_angle: z.string().max(100).default(''),
  camera_move: z.string().max(100).default(''),
  duration: z.coerce.number().min(0).default(0),
  image_prompt: z.string().max(1000).default(''),
  video_prompt: z.string().max(1000).default(''),
  character_ids: z.string().default(''),
})

type ShotFormValues = z.infer<typeof shotFormSchema>

const DEFAULT_VALUES: ShotFormValues = {
  scene_number: 1,
  shot_number: 1,
  description: '',
  camera_angle: '',
  camera_move: '',
  duration: 0,
  image_prompt: '',
  video_prompt: '',
  character_ids: '',
}

function shotToFormValues(shot: StudioShot): ShotFormValues {
  return {
    scene_number: shot.scene_number,
    shot_number: shot.shot_number,
    description: shot.description,
    camera_angle: shot.camera_angle,
    camera_move: shot.camera_move,
    duration: shot.duration,
    image_prompt: shot.image_prompt,
    video_prompt: shot.video_prompt,
    character_ids: shot.character_ids,
  }
}

// ============================================================================
// Component
// ============================================================================

type StudioShotMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: number
  currentRow?: StudioShot
}

export function StudioShotMutateDrawer({
  open,
  onOpenChange,
  projectId,
  currentRow,
}: StudioShotMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createMutation = useCreateStudioShot(projectId)
  const updateMutation = useUpdateStudioShot(projectId)

  const { data: charactersData } = useQuery({
    queryKey: [...STUDIO_QUERY_KEYS.characters(projectId)],
    queryFn: () => getStudioCharacters(projectId),
    enabled: open,
  })
  const characters = charactersData?.data ?? []

  const form = useForm<ShotFormValues>({
    resolver: zodResolver(shotFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      form.reset(shotToFormValues(currentRow))
    } else if (open && !isUpdate) {
      form.reset(DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: ShotFormValues) => {
    setIsSubmitting(true)
    try {
      if (isUpdate && currentRow) {
        const result = await updateMutation.mutateAsync({
          shotId: currentRow.id,
          data,
        })
        if (result.success) onOpenChange(false)
      } else {
        const result = await createMutation.mutateAsync(data)
        if (result.success) onOpenChange(false)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    void form.handleSubmit(onSubmit)(event)
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) form.reset()
      }}
    >
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[480px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate ? t('Edit Shot') : t('Add Shot')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update shot details.')
              : t('Add a new shot to the storyboard.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='studio-shot-form'
            onSubmit={handleSubmit}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <div className='grid grid-cols-2 gap-3'>
                <FormField
                  control={form.control}
                  name='scene_number'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Scene Number')}</FormLabel>
                      <FormControl>
                        <Input {...field} type='number' min={1} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='shot_number'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Shot Number')}</FormLabel>
                      <FormControl>
                        <Input {...field} type='number' min={1} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('Describe what happens in this shot...')}
                        className='h-24 resize-y text-sm'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className='grid grid-cols-2 gap-3'>
                <FormField
                  control={form.control}
                  name='camera_angle'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Camera Angle')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('e.g. Close-up, Wide...')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name='camera_move'
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('Camera Move')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('e.g. Pan, Dolly...')}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name='duration'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Duration (seconds)')}</FormLabel>
                    <FormControl>
                      <Input {...field} type='number' min={0} step={0.5} />
                    </FormControl>
                    <FormDescription>
                      {t('Optional. Shot duration in seconds.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='image_prompt'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Image Prompt')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('Describe the visual for image generation...')}
                        className='h-20 resize-y text-sm'
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Optional. Used for AI image generation.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='video_prompt'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Video Prompt')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('Describe the motion and action for video generation...')}
                        className='h-20 resize-y text-sm'
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Optional. Used for AI video generation.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {characters.length > 0 ? (
                <FormField
                  control={form.control}
                  name='character_ids'
                  render={({ field }) => {
                    const selectedIds = new Set(
                      field.value
                        ? field.value.split(',').filter(Boolean)
                        : []
                    )

                    const toggleCharacter = (charId: string, checked: boolean) => {
                      const next = new Set(selectedIds)
                      if (checked) {
                        next.add(charId)
                      } else {
                        next.delete(charId)
                      }
                      field.onChange([...next].join(','))
                    }

                    return (
                      <FormItem>
                        <FormLabel>{t('Characters')}</FormLabel>
                        <div className='border-input max-h-36 space-y-2 overflow-y-auto rounded-md border p-3'>
                          {characters.map((char) => {
                            const idStr = String(char.id)
                            return (
                              <Label
                                key={char.id}
                                className='flex cursor-pointer items-center gap-2 text-sm font-normal'
                              >
                                <Checkbox
                                  checked={selectedIds.has(idStr)}
                                  onCheckedChange={(checked) =>
                                    toggleCharacter(idStr, checked === true)
                                  }
                                />
                                {char.name}
                              </Label>
                            )
                          })}
                        </div>
                        <FormDescription>
                          {t('Select characters appearing in this shot.')}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              ) : null}
            </SideDrawerSection>
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button variant='outline' />}>
            {t('Close')}
          </SheetClose>
          <Button
            form='studio-shot-form'
            type='submit'
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t('Saving...')
              : isUpdate
                ? t('Save changes')
                : t('Add Shot')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
