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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'

import { SettingsForm } from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

const cliDefaultModelSchema = z.object({
  cli_default_model: z.object({
    // Shared
    model: z.string(),
    haiku_model: z.string(),
    sonnet_model: z.string(),
    opus_model: z.string(),
    // Codex
    codex_model: z.string(),
    codex_full_auto: z.boolean(),
    codex_reasoning_effort: z.string(),
    // Claude
    claude_model: z.string(),
    claude_max_turns: z.coerce.number().int().min(0),
    claude_permission_mode: z.string(),
  }),
})

type CliDefaultModelFormInput = z.input<typeof cliDefaultModelSchema>
type CliDefaultModelFormValues = z.output<typeof cliDefaultModelSchema>

type FlatCliDefaults = {
  'cli_default_model.model': string
  'cli_default_model.haiku_model': string
  'cli_default_model.sonnet_model': string
  'cli_default_model.opus_model': string
  'cli_default_model.codex_model': string
  'cli_default_model.codex_full_auto': boolean
  'cli_default_model.codex_reasoning_effort': string
  'cli_default_model.claude_model': string
  'cli_default_model.claude_max_turns': number
  'cli_default_model.claude_permission_mode': string
}

const buildFormDefaults = (
  defaults: FlatCliDefaults
): CliDefaultModelFormInput => ({
  cli_default_model: {
    model: defaults['cli_default_model.model'],
    haiku_model: defaults['cli_default_model.haiku_model'],
    sonnet_model: defaults['cli_default_model.sonnet_model'],
    opus_model: defaults['cli_default_model.opus_model'],
    codex_model: defaults['cli_default_model.codex_model'],
    codex_full_auto: defaults['cli_default_model.codex_full_auto'],
    codex_reasoning_effort: defaults['cli_default_model.codex_reasoning_effort'],
    claude_model: defaults['cli_default_model.claude_model'],
    claude_max_turns: defaults['cli_default_model.claude_max_turns'],
    claude_permission_mode: defaults['cli_default_model.claude_permission_mode'],
  },
})

const normalizeFormValues = (
  values: CliDefaultModelFormValues
): FlatCliDefaults => ({
  'cli_default_model.model': values.cli_default_model.model,
  'cli_default_model.haiku_model': values.cli_default_model.haiku_model,
  'cli_default_model.sonnet_model': values.cli_default_model.sonnet_model,
  'cli_default_model.opus_model': values.cli_default_model.opus_model,
  'cli_default_model.codex_model': values.cli_default_model.codex_model,
  'cli_default_model.codex_full_auto': values.cli_default_model.codex_full_auto,
  'cli_default_model.codex_reasoning_effort':
    values.cli_default_model.codex_reasoning_effort,
  'cli_default_model.claude_model': values.cli_default_model.claude_model,
  'cli_default_model.claude_max_turns':
    values.cli_default_model.claude_max_turns,
  'cli_default_model.claude_permission_mode':
    values.cli_default_model.claude_permission_mode,
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
    ).filter((key) => {
      const a = normalized[key]
      const b = baselineRef.current[key]
      return String(a) !== String(b)
    })

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
              'Default models and parameters returned to huazhen on login. Settings take effect on the next login.'
            )}
          </FormDescription>

          {/* ── Shared defaults ── */}
          <p className='text-sm font-semibold mb-2'>{t('Shared Defaults')}</p>

          <FormField
            control={form.control}
            name='cli_default_model.model'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Default Model')}</FormLabel>
                <FormDescription>
                  {t('Fallback when no tool-specific model is set')}
                </FormDescription>
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

          {/* ── Codex parameters ── */}
          <p className='text-sm font-semibold mt-6 mb-2'>
            {t('Codex Parameters')}
          </p>

          <FormField
            control={form.control}
            name='cli_default_model.codex_model'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Codex Model')}</FormLabel>
                <FormDescription>
                  {t('Overrides Default Model for codex. Leave empty to use Default Model.')}
                </FormDescription>
                <FormControl>
                  <Input {...field} placeholder={t('(uses Default Model)')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='cli_default_model.codex_full_auto'
            render={({ field }) => (
              <FormItem className='flex flex-row items-center gap-3 max-w-sm'>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
                <div>
                  <FormLabel>{t('Full Auto Mode')}</FormLabel>
                  <FormDescription>
                    {t('Pass --dangerously-bypass-approvals-and-sandbox to codex')}
                  </FormDescription>
                </div>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='cli_default_model.codex_reasoning_effort'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Reasoning Effort')}</FormLabel>
                <FormDescription>
                  {t('Maps to -c reasoning_effort=... in codex')}
                </FormDescription>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='low'>{t('Low')}</SelectItem>
                    <SelectItem value='medium'>{t('Medium')}</SelectItem>
                    <SelectItem value='high'>{t('High')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* ── Claude parameters ── */}
          <p className='text-sm font-semibold mt-6 mb-2'>
            {t('Claude Parameters')}
          </p>

          <FormField
            control={form.control}
            name='cli_default_model.claude_model'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Claude Model')}</FormLabel>
                <FormDescription>
                  {t('Overrides Default Model for claude. Leave empty to use Default Model.')}
                </FormDescription>
                <FormControl>
                  <Input {...field} placeholder={t('(uses Default Model)')} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='cli_default_model.claude_max_turns'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Max Turns')}</FormLabel>
                <FormDescription>
                  {t('Maximum agentic turns (--max-turns). 0 = unlimited.')}
                </FormDescription>
                <FormControl>
                  <Input {...field} type='number' min={0} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name='cli_default_model.claude_permission_mode'
            render={({ field }) => (
              <FormItem className='max-w-sm'>
                <FormLabel>{t('Permission Mode')}</FormLabel>
                <FormDescription>
                  {t('Controls tool permission prompting in claude')}
                </FormDescription>
                <Select
                  onValueChange={field.onChange}
                  value={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value='default'>{t('Default (ask)')}</SelectItem>
                    <SelectItem value='acceptEdits'>{t('Accept Edits')}</SelectItem>
                    <SelectItem value='bypassPermissions'>{t('Bypass Permissions')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
