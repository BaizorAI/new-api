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
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { z } from 'zod'

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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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

import {
  createStudioProject,
  updateStudioProject,
} from '../api'
import {
  GENRE_OPTIONS,
  STUDIO_QUERY_KEYS,
  SUCCESS_MESSAGES,
} from '../constants'
import type { StudioProject } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

const studioProjectFormSchema = z.object({
  name: z.string().min(1, 'Project name is required').max(100),
  brief: z.string().max(500).default(''),
  genre: z.string().default(''),
  style_dna: z.string().max(500).default(''),
})

type StudioProjectFormValues = z.infer<typeof studioProjectFormSchema>

const DEFAULT_VALUES: StudioProjectFormValues = {
  name: '',
  brief: '',
  genre: '',
  style_dna: '',
}

function projectToFormValues(
  project: StudioProject
): StudioProjectFormValues {
  return {
    name: project.name,
    brief: project.brief,
    genre: project.genre,
    style_dna: project.style_dna,
  }
}

// ============================================================================
// Component
// ============================================================================

type StudioProjectMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  currentRow?: StudioProject
}

export function StudioProjectMutateDrawer({
  open,
  onOpenChange,
  currentRow,
}: StudioProjectMutateDrawerProps) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isUpdate = !!currentRow
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<StudioProjectFormValues>({
    resolver: zodResolver(studioProjectFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      form.reset(projectToFormValues(currentRow))
    } else if (open && !isUpdate) {
      form.reset(DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: StudioProjectFormValues) => {
    setIsSubmitting(true)
    try {
      if (isUpdate && currentRow) {
        const result = await updateStudioProject(currentRow.id, data)
        if (result.success) {
          toast.success(t(SUCCESS_MESSAGES.PROJECT_UPDATED))
          onOpenChange(false)
          void queryClient.invalidateQueries({
            queryKey: [...STUDIO_QUERY_KEYS.projects],
          })
          void queryClient.invalidateQueries({
            queryKey: [...STUDIO_QUERY_KEYS.project(currentRow.id)],
          })
        }
      } else {
        const result = await createStudioProject(data)
        if (result.success && result.data) {
          toast.success(t(SUCCESS_MESSAGES.PROJECT_CREATED))
          onOpenChange(false)
          void queryClient.invalidateQueries({
            queryKey: [...STUDIO_QUERY_KEYS.projects],
          })
          void navigate({
            to: '/studio/$projectId',
            params: { projectId: String(result.data.id) },
          })
        }
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
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[520px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>
            {isUpdate ? t('Edit Project') : t('Create Project')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update your film project details.')
              : t('Set up a new film project. A 7-stage pipeline will be created automatically.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='studio-project-form'
            onSubmit={handleSubmit}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Project Name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Enter project name')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='brief'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Project Brief')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('Describe the story or concept...')}
                        className='h-24 resize-y text-sm'
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Optional. Up to 500 characters.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='genre'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Genre')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select genre')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent alignItemWithTrigger={false}>
                        <SelectGroup>
                          {GENRE_OPTIONS.map((genre) => (
                            <SelectItem key={genre} value={genre}>
                              {t(GENRE_LABELS[genre] ?? genre)}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='style_dna'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Style DNA')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('e.g. Cyberpunk, Ghibli, Film noir...')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Optional. Visual style keywords for AI generation.')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button variant='outline' />}>
            {t('Close')}
          </SheetClose>
          <Button
            form='studio-project-form'
            type='submit'
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t('Saving...')
              : isUpdate
                ? t('Save changes')
                : t('Create Project')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

// ============================================================================
// Genre Labels (i18n keys)
// ============================================================================

const GENRE_LABELS: Record<string, string> = {
  short_film: 'Short Film',
  commercial: 'Commercial',
  music_video: 'Music Video',
  animation: 'Animation',
  documentary: 'Documentary',
  other: 'Other',
}
