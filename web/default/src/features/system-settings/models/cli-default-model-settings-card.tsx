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
import { useEffect, useMemo, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import * as z from 'zod'

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

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const cliDefaultModelSchema = z.object({
  cli_default_model: z.object({
    model: z.string(),
    haiku_model: z.string(),
    sonnet_model: z.string(),
    opus_model: z.string(),
  }),
})

type CliDefaultModelFormInput = z.input<typeof cliDefaultModelSchema>
type CliDefaultModelFormValues = z.output<typeof cliDefaultModelSchema>

type FlatCliDefaults = {
  'cli_default_model.model': string
  'cli_default_model.haiku_model': string
  'cli_default_model.sonnet_model': string
  'cli_default_model.opus_model': string
}

const buildFormDefaults = (
  defaults: FlatCliDefaults
): CliDefaultModelFormInput => ({
  cli_default_model: {
    model: defaults['cli_default_model.model'],
    haiku_model: defaults['cli_default_model.haiku_model'],
    sonnet_model: defaults['cli_default_model.sonnet_model'],
    opus_model: defaults['cli_default_model.opus_model'],
  },
})

const normalizeFormValues = (
  values: CliDefaultModelFormValues
): FlatCliDefaults => ({
  'cli_default_model.model': values.cli_default_model.model,
  'cli_default_model.haiku_model': values.cli_default_model.haiku_model,
  'cli_default_model.sonnet_model': values.cli_default_model.sonnet_model,
  'cli_default_model.opus_model': values.cli_default_model.opus_model,
})

interface Props {
  defaultValues: FlatCliDefaults
}

export function CliDefaultModelSettingsCard(props: Props) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()

  const formDefaults = useMemo(
    () => buildFormDefaults(props.defaultValues),
    [props.defaultValues]
  )

  const form = useForm<
    CliDefaultModelFormInput,
    unknown,
    CliDefaultModelFormValues
  >({
    resolver: zodResolver(cliDefaultModelSchema),
    defaultValues: formDefaults,
  })

  const baselineRef = useRef<FlatCliDefaults>(props.defaultValues)
  const baselineSerializedRef = useRef<string>(
    JSON.stringify(props.defaultValues)
  )

  useEffect(() => {
    const serialized = JSON.stringify(props.defaultValues)
    if (serialized === baselineSerializedRef.current) return
    baselineRef.current = props.defaultValues
    baselineSerializedRef.current = serialized
    form.reset(buildFormDefaults(props.defaultValues))
  }, [props.defaultValues, form])

  const onSubmit = async (values: CliDefaultModelFormValues) => {
    const normalized = normalizeFormValues(values)
    const changedKeys = (
      Object.keys(normalized) as Array<keyof FlatCliDefaults>
    ).filter((key) => normalized[key] !== baselineRef.current[key])

    if (changedKeys.length === 0) {
      toast.info(t('No changes to save'))
      return
    }

    for (const key of changedKeys) {
      await updateOption.mutateAsync({
        key,
        value: normalized[key],
      })
    }

    baselineRef.current = normalized
    baselineSerializedRef.current = JSON.stringify(normalized)
    form.reset(buildFormDefaults(normalized))
  }

  return (
    <SettingsSection title={t('CLI Default Models')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />
          <FormDescription className='mb-4'>
            {t(
              'Default models returned to the CLI on login. The CLI uses these to select which model to invoke for each capability tier.'
            )}
          </FormDescription>

          <FormField
            control={form.control}
            name='cli_default_model.model'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Default Model')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='cli_default_model.haiku_model'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Haiku Model')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='cli_default_model.sonnet_model'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Sonnet Model')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='cli_default_model.opus_model'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Opus Model')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
