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
import { type FormEvent, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
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
  useCreateStudioCharacter,
  useUpdateStudioCharacter,
} from '../hooks/use-studio-mutations'
import type { StudioCharacter } from '../types'

// ============================================================================
// Form Schema
// ============================================================================

const characterFormSchema = z.object({
  name: z.string().min(1, 'Character name is required').max(100),
  description: z.string().max(500).default(''),
  visual_prompt: z.string().max(1000).default(''),
  reference_url: z.string().max(500).default(''),
  lora_params: z.string().max(500).default(''),
})

type CharacterFormValues = z.infer<typeof characterFormSchema>

const DEFAULT_VALUES: CharacterFormValues = {
  name: '',
  description: '',
  visual_prompt: '',
  reference_url: '',
  lora_params: '',
}

function characterToFormValues(char: StudioCharacter): CharacterFormValues {
  return {
    name: char.name,
    description: char.description,
    visual_prompt: char.visual_prompt,
    reference_url: char.reference_url,
    lora_params: char.lora_params,
  }
}

// ============================================================================
// Component
// ============================================================================

type StudioCharacterMutateDrawerProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: number
  currentRow?: StudioCharacter
}

export function StudioCharacterMutateDrawer({
  open,
  onOpenChange,
  projectId,
  currentRow,
}: StudioCharacterMutateDrawerProps) {
  const { t } = useTranslation()
  const isUpdate = !!currentRow
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createMutation = useCreateStudioCharacter(projectId)
  const updateMutation = useUpdateStudioCharacter(projectId)

  const form = useForm<CharacterFormValues>({
    resolver: zodResolver(characterFormSchema),
    defaultValues: DEFAULT_VALUES,
  })

  useEffect(() => {
    if (open && isUpdate && currentRow) {
      form.reset(characterToFormValues(currentRow))
    } else if (open && !isUpdate) {
      form.reset(DEFAULT_VALUES)
    }
  }, [open, isUpdate, currentRow, form])

  const onSubmit = async (data: CharacterFormValues) => {
    setIsSubmitting(true)
    try {
      if (isUpdate && currentRow) {
        const result = await updateMutation.mutateAsync({
          charId: currentRow.id,
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
            {isUpdate ? t('Edit Character') : t('Add Character')}
          </SheetTitle>
          <SheetDescription>
            {isUpdate
              ? t('Update character details and visual prompt.')
              : t('Define a new character for this project.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='studio-character-form'
            onSubmit={handleSubmit}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='name'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Character Name')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('Enter character name')}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='description'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('Describe the character...')}
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
                name='visual_prompt'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Visual Prompt')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('Describe the character appearance for AI image generation...')}
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
                name='reference_url'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Reference Image URL')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder='https://...'
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='lora_params'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('LoRA Parameters')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder={t('e.g. lora_name:0.8, trigger_word...')}
                      />
                    </FormControl>
                    <FormDescription>
                      {t('Optional. LoRA model parameters for character consistency.')}
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
            form='studio-character-form'
            type='submit'
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t('Saving...')
              : isUpdate
                ? t('Save changes')
                : t('Add Character')}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
