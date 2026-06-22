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
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createHermesSkill } from '../api'

interface HermesSkillDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HermesSkillDialog({
  open,
  onOpenChange,
}: HermesSkillDialogProps) {
  const { t } = useTranslation()
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [instructions, setInstructions] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const reset = () => {
    setName('')
    setCategory('')
    setDescription('')
    setInstructions('')
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !description.trim() || !instructions.trim()) {
      toast.error(t('Please complete the skill name, description, and instructions'))
      return
    }

    setIsSubmitting(true)
    try {
      await createHermesSkill({
        name,
        category,
        description,
        instructions,
      })
      toast.success(t('Skill added'))
      reset()
      onOpenChange(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to add skill')
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen)
        if (!nextOpen) reset()
      }}
      title={t('Add Hermes skill')}
      description={t('Create a reusable Hermes skill for future conversations.')}
      footer={
        <>
          <Button
            type='button'
            variant='outline'
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t('Cancel')}
          </Button>
          <Button type='submit' form='hermes-skill-form' disabled={isSubmitting}>
            {isSubmitting ? t('Saving') : t('Add skill')}
          </Button>
        </>
      }
    >
      <form id='hermes-skill-form' onSubmit={handleSubmit} className='space-y-4'>
        <div className='grid gap-1.5'>
          <Label htmlFor='hermes-skill-name'>{t('Skill name')}</Label>
          <Input
            id='hermes-skill-name'
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={t('e.g. project-release-review')}
            disabled={isSubmitting}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='hermes-skill-category'>{t('Category')}</Label>
          <Input
            id='hermes-skill-category'
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            placeholder={t('Optional')}
            disabled={isSubmitting}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='hermes-skill-description'>{t('Description')}</Label>
          <Input
            id='hermes-skill-description'
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={t('When Hermes should use this skill')}
            disabled={isSubmitting}
          />
        </div>
        <div className='grid gap-1.5'>
          <Label htmlFor='hermes-skill-instructions'>{t('Instructions')}</Label>
          <Textarea
            id='hermes-skill-instructions'
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
            placeholder={t('Write the reusable procedure Hermes should follow.')}
            disabled={isSubmitting}
            className='min-h-40'
          />
        </div>
      </form>
    </Dialog>
  )
}
