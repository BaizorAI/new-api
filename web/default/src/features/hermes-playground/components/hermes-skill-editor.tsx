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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftIcon, CheckIcon, DownloadIcon, EyeIcon, FileIcon, FolderIcon, PencilIcon, PlayIcon, SparklesIcon, Trash2Icon, UploadIcon, Wand2Icon, XIcon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Main } from '@/components/layout'
import { Textarea } from '@/components/ui/textarea'
import { Skeleton } from '@/components/ui/skeleton'
import { Markdown } from '@/components/ui/markdown'

import {
  createHermesSkill,
  deleteHermesSkill,
  deleteHermesSkillAsset,
  generateHermesSkillContent,
  renameHermesSkillAsset,
  listHermesSkills,
  listHermesSkillAssets,
  createHermesSkill,
  deleteHermesSkill,
  deleteHermesSkillAsset,
  generateHermesSkillContent,
  renameHermesSkillAsset,
  listHermesSkills,
  listHermesSkillAssets,
  uploadHermesSkillAsset,
  updateHermesSkill,
  type HermesSkill,
  type HermesSkillAsset,
} from '../api'
import {
  createHermesExecutionTask,
  getHermesExecutionTask,
} from '../api'

interface HermesSkillEditorProps {
  editSkill?: HermesSkill | null
  teamId?: number
  onChanged?: () => void
  onCancel?: () => void
  /** Optional workspace context so the test AI can access files from the session. */
  testContext?: { conversationId?: string; storageScope?: string; workspaceMode?: string }
}

const HERMES_SKILL_NAME_PATTERN = /^[a-z0-9][a-z0-9._-]*$/

/** Parsed SKILL.md content. */
interface SkillContent {
  name: string
  description: string
  version?: string
  author?: string
  license?: string
  tags?: string
  relatedSkills?: string
  /** The markdown body after the frontmatter (excluding the # heading line). */
  body: string
}

/** Parse a SKILL.md content string into structured fields. */
function parseSkillContent(content?: string): SkillContent {
  const empty: SkillContent = { name: '', description: '', body: '' }
  if (!content) return empty

  // Split on YAML frontmatter delimiters
  const fmMatch = content.match(/^---\n([\s\S]*?)\n---/)
  if (!fmMatch) {
    // No frontmatter — treat entire content as body
    return { ...empty, body: content.trim() }
  }

  const fm = fmMatch[1]
  const rest = content.slice(fmMatch[0].length).trim()

  // Parse simple YAML scalars (no library dependency needed for these fields)
  const get = (key: string): string => {
    const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'))
    return (m?.[1] ?? '').replace(/^['"]|['"]$/g, '').trim()
  }

  // Parse tags array: tags: [tag1, tag2]
  let tags = ''
  const tagsMatch = fm.match(/^\s{4}tags:\s*\[(.*?)\]$/m)
  if (tagsMatch) {
    tags = tagsMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).join(', ')
  }

  // Parse related_skills array
  let relatedSkills = ''
  const relMatch = fm.match(/^\s{6}related_skills:\s*\[(.*?)\]$/m)
  if (relMatch) {
    relatedSkills = relMatch[1].split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')).join(', ')
  }

  // Body: skip the # heading line and any trailing blank lines, keep everything else
  let body = rest
  const lines = body.split('\n')
  let start = 0
  while (start < lines.length && lines[start].trim() === '') start++
  if (start < lines.length && lines[start].trim().startsWith('#')) start++
  while (start < lines.length && lines[start].trim() === '') start++
  body = lines.slice(start).join('\n').trim()

  return {
    name: get('name'),
    description: get('description'),
    version: get('version') || undefined,
    author: get('author') || undefined,
    license: get('license') || undefined,
    tags: tags || undefined,
    relatedSkills: relatedSkills || undefined,
    body,
  }
}

/** Rebuild a SKILL.md string from structured fields. */
function buildSkillContent(sc: SkillContent): string {
  const frontmatter: string[] = []
  frontmatter.push(`name: ${quoteYaml(sc.name)}`)
  frontmatter.push(`description: ${quoteYaml(sc.description)}`)
  if (sc.version) frontmatter.push(`version: ${quoteYaml(sc.version)}`)
  if (sc.author) frontmatter.push(`author: ${quoteYaml(sc.author)}`)
  if (sc.license) frontmatter.push(`license: ${quoteYaml(sc.license)}`)
  if (sc.tags || sc.relatedSkills) {
    frontmatter.push('metadata:')
    frontmatter.push('  hermes:')
    if (sc.tags) {
      const tagList = sc.tags.split(',').map((s) => s.trim()).filter(Boolean)
      frontmatter.push(`    tags: [${tagList.join(', ')}]`)
    }
    if (sc.relatedSkills) {
      const relList = sc.relatedSkills.split(',').map((s) => s.trim()).filter(Boolean)
      frontmatter.push(`    related_skills: [${relList.join(', ')}]`)
    }
  }

  return `---
${frontmatter.join('\n')}
---

# ${sc.name}

${sc.body}
`
}

function quoteYaml(value: string): string {
  // Only quote if value contains special YAML characters
  if (/[:\{\}\[\],&\*\#\?\|><=!%@`'"]/.test(value) || value.includes('  ')) {
    return JSON.stringify(value)
  }
  return value
}

export function HermesSkillEditor(props: HermesSkillEditorProps) {
  const { t } = useTranslation()
  const isEditing = Boolean(props.editSkill)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [version, setVersion] = useState('')
  const [author, setAuthor] = useState('')
  const [license, setLicense] = useState('')
  const [tags, setTags] = useState('')
  const [relatedSkills, setRelatedSkills] = useState('')
  const [body, setBody] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showDeleteAsset, setShowDeleteAsset] = useState<string | null>(null)
  const [renamePath, setRenamePath] = useState<string | null>(null)
  const [renameName, setRenameName] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState('')
  const [isTesting, setIsTesting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const handleRenameAsset = async () => {
    if (!props.editSkill || !renamePath || !renameName.trim()) return
    try {
      await renameHermesSkillAsset(props.editSkill.name, renamePath, renameName.trim(), { teamId: props.teamId })
      toast.success(t('Asset renamed'))
      setRenamePath(null)
      setRenameName('')
      invalidateAssets()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Failed to rename asset'))
    }
  }

  const invalidateAssets = () => {
    void queryClient.invalidateQueries({
      queryKey: ['hermes-skill-editor', 'assets', props.editSkill?.name, props.teamId],
    })
  }

  const handleUploadAsset = async (file: File) => {
    if (!props.editSkill) return
    try {
      await uploadHermesSkillAsset(props.editSkill.name, file, {
        teamId: props.teamId,
      })
      toast.success(t('Asset uploaded'))
      invalidateAssets()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Failed to upload asset'))
    }
  }

  const handleDeleteAsset = async () => {
    if (!props.editSkill || !showDeleteAsset) return
    try {
      await deleteHermesSkillAsset(props.editSkill.name, showDeleteAsset, {
        teamId: props.teamId,
      })
      toast.success(t('Asset deleted'))
      setShowDeleteAsset(null)
      invalidateAssets()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('Failed to delete asset'))
    }
  }

  const handleAIGenerate = async () => {
    if (!name.trim()) {
      toast.error(t('Please enter a skill name first'))
      return
    }
    setIsGenerating(true)
    try {
      const content = await generateHermesSkillContent(
        name.trim(),
        description.trim() || name.trim(),
        { teamId: props.teamId },
      )
      if (!content) {
        toast.error(t('AI generation returned empty content. Please try again.'))
        return
      }
      // Parse the generated content to fill in fields
      const sc = parseSkillContent(content)
      if (sc.description && !description.trim()) setDescription(sc.description)
      if (sc.version) setVersion(sc.version)
      if (sc.author) setAuthor(sc.author)
      if (sc.license) setLicense(sc.license)
      if (sc.tags) setTags(sc.tags)
      if (sc.body) setBody(sc.body)
      if (sc.name && sc.name !== name && !isEditing) setName(sc.name)
      toast.success(t('Skill content generated! Review and edit before saving.'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('AI generation failed'))
    } finally {
      setIsGenerating(false)
    }
  }

  const handleTestRun = async () => {
    if (!testInput.trim() || !name.trim()) return
    setIsTesting(true)
    setTestResult('')
    try {
      const sc: SkillContent = {
        name: name.trim(), description: description.trim(),
        version: version.trim() || undefined, author: author.trim() || undefined,
        license: license.trim() || undefined, tags: tags.trim() || undefined,
        relatedSkills: relatedSkills.trim() || undefined, body: body.trim(),
      }
      const { default: mod } = await import('@/features/hermes-playground/api')
      const ctx = props.testContext || {}
      const task = await mod.createHermesExecutionTask({
        title: 'Skill test: ' + name.trim(),
        workspaceMode: ctx.workspaceMode || 'personal',
        conversationId: ctx.conversationId || '',
        storageScope: ctx.storageScope || '',
        hermesSessionId: '',
        teamId: props.teamId,
        payload: {
          model: 'hermes-agent', stream: false, max_tokens: 4000,
          messages: [
            { role: 'system', content: `Test this skill. If the user's input is in Chinese, you MUST respond entirely in Chinese.

${buildSkillContent(sc).replace(/<skill_dir>/g, '/opt/data/skills/productivity/' + (name.trim()))}` },
            { role: 'user', content: testInput.trim() },
          ],
        },
      })
      // Poll until done
      let result = ''
      for (let i = 0; i < 60; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const updated = await mod.getHermesExecutionTask(task.taskId)
        if (updated.status === 'succeeded') {
          result = typeof updated.responsePayload === 'object'
            ? (updated.responsePayload as any)?.choices?.[0]?.message?.content || JSON.stringify(updated.responsePayload)
            : String(updated.responsePayload || '')
          break
        }
        if (updated.status === 'failed' || updated.status === 'canceled') {
          result = updated.error || updated.status
          break
        }
      }
      setTestResult(result || t('Test timed out'))
    } catch (error) {
      setTestResult(error instanceof Error ? error.message : t('Test failed'))
    } finally { setIsTesting(false) }
  }

  // Sync state when editSkill loads
  useEffect(() => {
    if (props.editSkill) {
      const sc = parseSkillContent(props.editSkill.content)
      setName(props.editSkill.name)
      setCategory(props.editSkill.category ?? '')
      setDescription(sc.description || props.editSkill.description || '')
      setVersion(sc.version ?? '')
      setAuthor(sc.author ?? '')
      setLicense(sc.license ?? '')
      setTags(sc.tags ?? '')
      setRelatedSkills(sc.relatedSkills ?? '')
      setBody(sc.body || '')
    } else {
      setName('')
      setCategory('')
      setDescription('')
      setVersion('')
      setAuthor('')
      setLicense('')
      setTags('')
      setRelatedSkills('')
      setBody('')
    }
  }, [props.editSkill?.name, props.editSkill?.content, Boolean(props.editSkill)])

  // Load assets for editing skills
  const { data: assets = [] } = useQuery({
    queryKey: ['hermes-skill-editor', 'assets', props.editSkill?.name, props.teamId],
    queryFn: () =>
      props.editSkill?.name
        ? listHermesSkillAssets(props.editSkill.name, { teamId: props.teamId })
        : Promise.resolve([]),
    enabled: isEditing && Boolean(props.editSkill?.name),
    staleTime: 30_000,
  })

  const assetFileUrl = (assetPath: string): string => {
    const skillName = props.editSkill?.name ?? ''
    const params = new URLSearchParams({ name: skillName, path: assetPath })
    if (props.teamId) params.set('team_id', String(props.teamId))
    return `/pg/hermes/skills/assets/file?${params}`
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim() || !description.trim() || !body.trim()) {
      toast.error(
        t('Please complete the skill name, description, and instructions')
      )
      return
    }
    if (!isEditing && !HERMES_SKILL_NAME_PATTERN.test(name.trim())) {
      toast.error(
        t(
          'Skill name must use lowercase letters, numbers, dots, underscores, or hyphens, and start with a letter or number.'
        )
      )
      return
    }
    if (category.trim() && !HERMES_SKILL_NAME_PATTERN.test(category.trim())) {
      toast.error(
        t(
          'Category must use lowercase letters, numbers, dots, underscores, or hyphens.'
        )
      )
      return
    }

    setIsSubmitting(true)
    try {
      const sc: SkillContent = {
        name: name.trim(),
        description: description.trim(),
        version: version.trim() || undefined,
        author: author.trim() || undefined,
        license: license.trim() || undefined,
        tags: tags.trim() || undefined,
        relatedSkills: relatedSkills.trim() || undefined,
        body: body.trim(),
      }
      const content = buildSkillContent(sc)

      if (isEditing && props.editSkill) {
        try {
          await apiPutHermesSkill(
            props.editSkill.name,
            name.trim(),
            content,
            props.teamId,
          )
          toast.success(t('Skill updated'))
          props.onChanged?.()
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t('Failed to update skill')
          toast.error(message)
        }
      } else {
        try {
          await createHermesSkill(
            { name: name.trim(), description: description.trim(), instructions: body.trim(), category: category.trim() || undefined },
            { teamId: props.teamId },
          )
          toast.success(t('Skill added'))
          props.onChanged?.()
        } catch (error) {
          const message =
            error instanceof Error ? error.message : t('Failed to add skill')
          toast.error(message)
        }
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to add skill')
      toast.error(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!props.editSkill) return
    setIsDeleting(true)
    try {
      await deleteHermesSkill(props.editSkill.name, { teamId: props.teamId })
      toast.success(t('Skill deleted'))
      props.onChanged?.()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t('Failed to delete skill')
      toast.error(message)
    } finally {
      setIsDeleting(false)
      setShowDeleteConfirm(false)
    }
  }

  return (
    <Main className='flex min-h-[calc(100vh-var(--app-header-height,0px))] flex-col'>
      {/* Header */}
      <header className='flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-6'>
        <div className='flex items-center gap-3'>
          <Button
            disabled={isSubmitting || isDeleting}
            onClick={props.onCancel}
            size='sm'
            type='button'
            variant='ghost'
          >
            <ArrowLeftIcon className='size-4' />
            {t('Back')}
          </Button>
          <h1 className='text-base font-semibold'>
            {isEditing ? t('Edit skill') : t('Add Hermes skill')}
          </h1>
          {isEditing && name && (
            <span className='text-muted-foreground font-mono text-sm'>
              {name}
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          {isEditing && (
            <Button
              disabled={isSubmitting || isDeleting}
              onClick={() => setShowDeleteConfirm(true)}
              size='sm'
              type='button'
              variant='destructive'
            >
              <Trash2Icon className='size-4' />
              <span className='hidden sm:inline'>{t('Delete')}</span>
            </Button>
          )}
          <Button
            disabled={isSubmitting || isDeleting}
            form='hermes-skill-editor-form'
            size='sm'
            type='submit'
          >
            {isSubmitting
              ? t('Saving...')
              : isEditing
                ? t('Save')
                : t('Add Hermes skill')}
          </Button>
        </div>
      </header>

      {/* Form */}
      <div className='min-h-0 flex-1 overflow-auto'>
        <div className='mx-auto max-w-2xl space-y-6 p-4 sm:p-6'>
          {props.teamId && (
            <div className='bg-muted/40 text-muted-foreground rounded-lg border px-3 py-2 text-sm'>
              {t('This skill will be saved in the selected team workspace.')}
            </div>
          )}

          <form
            className='space-y-6'
            id='hermes-skill-editor-form'
            onSubmit={handleSubmit}
          >
            {/* Basic Info */}
            <fieldset className='space-y-4'>
              <legend className='text-sm font-semibold'>{t('Basic info')}</legend>

              <div className='grid gap-1.5'>
                <Label htmlFor='hermes-skill-editor-name'>{t('Skill name')}</Label>
                <Input
                  disabled={isSubmitting || isDeleting || isEditing}
                  id='hermes-skill-editor-name'
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t('e.g. project-release-review')}
                  value={name}
                />
                {isEditing && (
                  <p className='text-muted-foreground text-xs'>
                    {t('The skill name cannot be changed after creation.')}
                  </p>
                )}
              </div>

              <div className='grid gap-1.5'>
                <Label htmlFor='hermes-skill-editor-category'>{t('Category')}</Label>
                <Input
                  disabled={isSubmitting || isDeleting}
                  id='hermes-skill-editor-category'
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder={t('e.g. productivity')}
                  value={category}
                />
              </div>

              <div className='grid gap-1.5'>
                <Label htmlFor='hermes-skill-editor-description'>{t('Description')}</Label>
                <Input
                  disabled={isSubmitting || isDeleting}
                  id='hermes-skill-editor-description'
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder={t('When Hermes should use this skill')}
                  value={description}
                />
              </div>
            </fieldset>

            {/* Metadata */}
            <fieldset className='space-y-4'>
              <legend className='text-sm font-semibold'>{t('Metadata')}</legend>

              <div className='grid grid-cols-1 gap-4 sm:grid-cols-2'>
                <div className='grid gap-1.5'>
                  <Label htmlFor='hermes-skill-editor-version'>{t('Version')}</Label>
                  <Input
                    disabled={isSubmitting || isDeleting}
                    id='hermes-skill-editor-version'
                    onChange={(event) => setVersion(event.target.value)}
                    placeholder={t('e.g. 1.0.0')}
                    value={version}
                  />
                </div>
                <div className='grid gap-1.5'>
                  <Label htmlFor='hermes-skill-editor-author'>{t('Author')}</Label>
                  <Input
                    disabled={isSubmitting || isDeleting}
                    id='hermes-skill-editor-author'
                    onChange={(event) => setAuthor(event.target.value)}
                    placeholder={t('e.g. Hermes Agent')}
                    value={author}
                  />
                </div>
              </div>

              <div className='grid gap-1.5'>
                <Label htmlFor='hermes-skill-editor-license'>{t('License')}</Label>
                <Input
                  disabled={isSubmitting || isDeleting}
                  id='hermes-skill-editor-license'
                  onChange={(event) => setLicense(event.target.value)}
                  placeholder={t('e.g. MIT')}
                  value={license}
                />
              </div>

              <div className='grid gap-1.5'>
                <Label htmlFor='hermes-skill-editor-tags'>
                  {t('Tags')}
                  <span className='text-muted-foreground ml-1 text-xs font-normal'>
                    ({t('comma-separated')})
                  </span>
                </Label>
                <Input
                  disabled={isSubmitting || isDeleting}
                  id='hermes-skill-editor-tags'
                  onChange={(event) => setTags(event.target.value)}
                  placeholder={t('e.g. ppt, template, business')}
                  value={tags}
                />
              </div>

              <div className='grid gap-1.5'>
                <Label htmlFor='hermes-skill-editor-related'>
                  {t('Related skills')}
                  <span className='text-muted-foreground ml-1 text-xs font-normal'>
                    ({t('comma-separated')})
                  </span>
                </Label>
                <Input
                  disabled={isSubmitting || isDeleting}
                  id='hermes-skill-editor-related'
                  onChange={(event) => setRelatedSkills(event.target.value)}
                  placeholder={t('e.g. powerpoint, pdf')}
                  value={relatedSkills}
                />
              </div>
            </fieldset>

            {/* Content */}
            <fieldset className='space-y-3'>
              <legend className='text-sm font-semibold'>
                {t('Instructions')}
                <span className='text-muted-foreground ml-1 text-xs font-normal'>
                  ({t('Full SKILL.md body')})
                </span>
              </legend>
              <div className='flex items-center gap-2'>
                <Button
                  disabled={isSubmitting || isDeleting || isGenerating || !name.trim()}
                  onClick={handleAIGenerate}
                  size='sm'
                  type='button'
                  variant='outline'
                >
                  <Wand2Icon className='size-4' />
                  {isGenerating ? t('Generating...') : t('AI Generate')}
                </Button>
                <Button
                  disabled={!body.trim()}
                  onClick={() => setPreviewMode((v) => !v)}
                  size='sm'
                  type='button'
                  variant='outline'
                >
                  <EyeIcon className='size-4' />
                  {previewMode ? t('Edit') : t('Preview')}
                </Button>
                <span className='text-muted-foreground text-xs'>
                  {t('Auto-fill from name and description using AI')}
                </span>
              </div>
              {previewMode ? (
                <div className='bg-muted/30 min-h-96 rounded-lg border p-6'>
                  <Markdown>{body || t('No content to preview')}</Markdown>
                </div>
              ) : (
                <>
                  <p className='text-muted-foreground text-xs'>
                    {t(
                      'Write the complete skill instructions in markdown. Sections like Overview, When to Use, Procedure, Hard Rules, Verification are recommended.'
                    )}
                  </p>
                  <Textarea
                    className='min-h-96 font-mono text-sm'
                    disabled={isSubmitting || isDeleting}
                    id='hermes-skill-editor-body'
                    onChange={(event) => setBody(event.target.value)}
                    placeholder={t('Write the skill instructions in markdown...')}
                    value={body}
                  />
                </>
              )}
            </fieldset>

            {/* Assets (edit mode only) */}
            {isEditing && (
              <fieldset className='space-y-3'>
                <legend className='text-sm font-semibold'>
                  {t('Assets')}
                  <span className='text-muted-foreground ml-1 text-xs font-normal'>
                    ({assets.filter((a) => !a.dir).length})
                  </span>
                </legend>

                <div className='flex items-center gap-2'>
                  <input
                    ref={fileInputRef}
                    type='file'
                    className='hidden'
                    accept='.pptx,.pdf,.png,.jpg,.jpeg,.gif,.csv,.doc,.docx,.ppt,.xlsx,.txt,.md,.json,.zip'
                    onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        handleUploadAsset(file)
                        event.target.value = ''
                      }
                    }}
                  />
                  <Button
                    disabled={isSubmitting || isDeleting}
                    onClick={() => fileInputRef.current?.click()}
                    size='sm'
                    type='button'
                    variant='outline'
                  >
                    <UploadIcon className='size-4' />
                    {t('Upload asset')}
                  </Button>
                </div>

                {renamePath && (
                  <div className='flex items-center gap-2'>
                    <Input
                      className='flex-1 text-sm'
                      onChange={(event) => setRenameName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') handleRenameAsset()
                        if (event.key === 'Escape') { setRenamePath(null); setRenameName('') }
                      }}
                      placeholder={t('New filename')}
                      value={renameName}
                    />
                    <Button
                      disabled={!renameName.trim()}
                      onClick={handleRenameAsset}
                      size='sm'
                      type='button'
                      variant='outline'
                    >
                      <CheckIcon className='size-4' />
                    </Button>
                    <Button
                      onClick={() => { setRenamePath(null); setRenameName('') }}
                      size='icon-sm'
                      type='button'
                      variant='ghost'
                    >
                      <XIcon className='size-4' />
                    </Button>
                  </div>
                )}

                {assets.filter((a) => !a.dir).length === 0 ? (
                  <p className='text-muted-foreground text-sm'>
                    {t('No assets. Upload PPTX templates, images, or reference files to the skill directory.')}
                  </p>
                ) : (
                  <div className='space-y-1'>
                    {assets
                      .filter((a) => !a.dir)
                      .map((asset) => (
                        <div
                          key={asset.path}
                          className='hover:bg-muted flex items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors'
                        >
                          <a
                            href={assetFileUrl(asset.path)}
                            target='_blank'
                            rel='noopener noreferrer'
                            className='min-w-0 flex flex-1 items-center gap-2'
                          >
                            <FileIcon className='text-muted-foreground size-4 shrink-0' />
                            <span className='min-w-0 flex-1 truncate font-mono text-xs'>
                              {asset.path}
                            </span>
                            <span className='text-muted-foreground shrink-0 text-xs'>
                              {formatFileSize(asset.size)}
                            </span>
                            <DownloadIcon className='text-muted-foreground size-3.5 shrink-0' />
                          </a>
                          <button
                            aria-label={t('Rename')}
                            className='text-muted-foreground hover:text-foreground shrink-0 rounded p-0.5 transition-colors'
                            onClick={() => { setRenamePath(asset.path); setRenameName(asset.name || asset.path.split('/').pop() || '') }}
                            title={t('Rename asset')}
                            type='button'
                          >
                            <PencilIcon className='size-3' />
                          </button>
                          <button
                            aria-label={t('Delete')}
                            className='text-muted-foreground hover:text-destructive shrink-0 rounded p-0.5 transition-colors'
                            onClick={() => setShowDeleteAsset(asset.path)}
                            title={t('Delete asset')}
                            type='button'
                          >
                            <Trash2Icon className='size-3' />
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </fieldset>
            )}

            {/* Test Run (edit/create mode) */}
            {name.trim() && body.trim() && (
              <fieldset className='space-y-3'>
                <legend className='text-sm font-semibold'>
                  {t('Quick test')}
                </legend>
                <p className='text-muted-foreground text-xs'>
                  {t('Test the skill with a sample instruction before saving. The current skill content will be used.')}
                </p>
                <div className='flex gap-2'>
                  <Input
                    className='flex-1'
                    disabled={isTesting}
                    onChange={(event) => setTestInput(event.target.value)}
                    placeholder={t('e.g. Create a yearly summary report')}
                    value={testInput}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault()
                        handleTestRun()
                      }
                    }}
                  />
                  <Button
                    disabled={isTesting || !testInput.trim()}
                    onClick={handleTestRun}
                    size='sm'
                    type='button'
                  >
                    <PlayIcon className='size-4' />
                    {isTesting ? t('Running...') : t('Run test')}
                  </Button>
                </div>
                {isTesting && (
                  <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                    <Skeleton className='h-4 w-4 rounded-full' />
                    {t('Running test...')}
                  </div>
                )}
                {testResult && (
                  <div className='bg-muted/30 max-h-96 overflow-y-auto rounded-lg border p-4'>
                    <div className='mb-2 flex items-center justify-between'>
                      <span className='text-muted-foreground text-xs font-medium'>
                        {t('Test result')}
                      </span>
                      <button
                        className='text-muted-foreground hover:text-foreground text-xs transition-colors'
                        onClick={() => setTestResult('')}
                        type='button'
                      >
                        {t('Clear')}
                      </button>
                    </div>
                    <Markdown>{testResult}</Markdown>
                  </div>
                )}
              </fieldset>
            )}
          </form>
        </div>
      </div>

      {/* Delete asset confirmation dialog */}
      <Dialog open={Boolean(showDeleteAsset)} onOpenChange={() => setShowDeleteAsset(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Delete asset')}</DialogTitle>
          </DialogHeader>
          <p className='text-muted-foreground text-sm'>
            {t('Are you sure you want to delete this file?', { name: showDeleteAsset ?? '' })}
          </p>
          <DialogFooter>
            <Button
              onClick={() => setShowDeleteAsset(null)}
              type='button'
              variant='outline'
            >
              {t('Cancel')}
            </Button>
            <Button onClick={handleDeleteAsset} type='button' variant='destructive'>
              {t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete skill confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('Delete skill')}</DialogTitle>
          </DialogHeader>
          <p className='text-muted-foreground text-sm'>
            {t('Are you sure you want to delete skill "{{name}}"?', {
              name: props.editSkill?.name ?? '',
            })}
          </p>
          <DialogFooter>
            <Button
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
              type='button'
              variant='outline'
            >
              {t('Cancel')}
            </Button>
            <Button
              disabled={isDeleting}
              onClick={handleDelete}
              type='button'
              variant='destructive'
            >
              {isDeleting ? t('Deleting...') : t('Delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Main>
  )
}

/** Low-level PUT that sends raw content directly (bypasses buildSkillContent). */
async function apiPutHermesSkill(
  originalName: string,
  newName: string,
  content: string,
  teamId?: number,
) {
  const apiMod = await import('@/lib/api')
  const headers: Record<string, string> = {}
  if (teamId) headers['X-Baizor-Team-Id'] = String(teamId)
  await apiMod.api.put(
    '/pg/hermes/skills',
    { name: originalName, content },
    { headers, skipBusinessError: true, skipErrorHandler: true },
  )
}

/**
 * Hook-friendly wrapper that resolves the skill to edit from a skill name search param.
 */
export function useSkillEditorSkill(skillName?: string, teamId?: number) {
  const { data: skills = [] } = useQuery({
    queryKey: ['hermes-skill-editor', 'skills', teamId],
    queryFn: () => listHermesSkills(teamId ? { teamId } : undefined),
    staleTime: 2 * 60 * 1000,
  })

  const editSkill = skills.find((s) => s.name === skillName) ?? null
  return skillName ? editSkill : null
}
