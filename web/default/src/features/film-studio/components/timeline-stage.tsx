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
import { Check, ImagePlus, Loader2, Pencil, Play, RefreshCw, Trash2, Video, X, AlertTriangle } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'

import { updateStudioShot, deleteStudioShot } from '../api'
import { SHOT_STATUS } from '../constants'
import type { StudioCharacter, StudioShot } from '../types'

interface TimelineStageProps {
  projectId: number
  stageKey: string
  shots: StudioShot[]
  characters: StudioCharacter[]
  generatingIds: Set<number>
  videoGeneratingIds: Set<number>
  onGenerateImage: (shot: StudioShot) => void
  onGenerateVideo: (shot: StudioShot) => void
}

/**
 * Horizontal timeline visualization for storyboard/image_gen/video_gen stages.
 *
 * Shots are displayed as cards positioned by cumulative duration on a
 * horizontally-scrollable timeline track. Clicking a shot opens an inline
 * editing panel below.
 */
export function TimelineStage({
  projectId, stageKey, shots, characters,
  generatingIds, videoGeneratingIds,
  onGenerateImage, onGenerateVideo,
}: TimelineStageProps) {
  const { t } = useTranslation()

  const [selectedShotId, setSelectedShotId] = useState<number | null>(null)
  const [shotForm, setShotForm] = useState({
    scene_number: 1, shot_number: 1, description: '',
    camera_angle: '', camera_move: '', duration: 5,
    image_prompt: '', video_prompt: '', character_ids: '',
  })
  const [fullscreenVideo, setFullscreenVideo] = useState<{ url: string; poster?: string; label: string } | null>(null)

  const selectedShot = shots.find(s => s.id === selectedShotId) ?? null
  const showImg = stageKey === 'image_gen' || stageKey === 'video_gen'
  const showVid = stageKey === 'video_gen'

  // Sort shots by scene then shot number
  const sortedShots = useMemo(
    () => [...shots].sort((a, b) => a.scene_number - b.scene_number || a.shot_number - b.shot_number),
    [shots],
  )

  // Compute cumulative timeline positions
  const maxDuration = useMemo(
    () => Math.max(...sortedShots.map(s => s.duration || 5), 1),
    [sortedShots],
  )

  const selectShot = useCallback((s: StudioShot) => {
    setSelectedShotId(s.id)
    setShotForm({
      scene_number: s.scene_number ?? 1, shot_number: s.shot_number ?? 1,
      description: s.description ?? '', camera_angle: s.camera_angle ?? '',
      camera_move: s.camera_move ?? '', duration: s.duration ?? 5,
      image_prompt: s.image_prompt ?? '', video_prompt: s.video_prompt ?? '',
      character_ids: s.character_ids ?? '',
    })
  }, [])

  const handleSave = useCallback(async () => {
    if (!selectedShotId || !shotForm.description.trim()) return
    try {
      await updateStudioShot(projectId, selectedShotId, shotForm)
      toast.success(t('Shot saved.'))
    } catch { toast.error(t('Failed to save shot.')) }
  }, [projectId, selectedShotId, shotForm, t])

  const handleDelete = useCallback(async () => {
    if (!selectedShotId) return
    try {
      await deleteStudioShot(projectId, selectedShotId)
      setSelectedShotId(null)
      toast.success(t('Shot deleted.'))
    } catch { toast.error(t('Failed to delete shot.')) }
  }, [projectId, selectedShotId, t])

  return (
    <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
      {/* Timeline header */}
      <div className='border-border flex items-center gap-2 border-b px-4 py-2'>
        <span className='text-muted-foreground text-xs'>
          {t('Timeline')} ({sortedShots.length} {t('shots')})
        </span>
        <span className='text-muted-foreground ml-auto text-[10px]'>
          {t('Total: {{duration}}s', { duration: sortedShots.reduce((sum, s) => sum + (s.duration || 5), 0) })}
        </span>
      </div>

      {/* Timeline track */}
      <ScrollArea className='min-h-0 flex-1' orientation='horizontal'>
        <div className='flex min-h-[140px] items-start gap-0 p-4' style={{ minWidth: Math.max(sortedShots.length * 140, 400) }}>
          {sortedShots.length > 0 ? sortedShots.map((shot) => {
            const isGen = generatingIds.has(shot.id)
            const isVidGen = videoGeneratingIds.has(shot.id)
            const isFailed = shot.status === SHOT_STATUS.FAILED
            const duration = shot.duration || 5
            const width = Math.max((duration / maxDuration) * 120, 80)

            return (
              <div
                key={shot.id}
                className='flex shrink-0 flex-col items-center'
                style={{ width }}
              >
                {/* Shot card */}
                <button
                  type='button'
                  onClick={() => selectShot(shot)}
                  className={`border-border bg-card text-card-foreground flex w-full flex-col rounded-lg border p-2 transition-colors hover:bg-accent/50 ${
                    isFailed ? 'border-destructive/30 bg-destructive/5' : ''
                  } ${
                    selectedShotId === shot.id ? 'ring-ring ring-2' : ''
                  }`}
                >
                  {/* Thumbnail */}
                  {shot.image_url ? (
                    <img src={shot.image_url} alt='' className='bg-muted mb-1.5 aspect-video w-full rounded object-cover' />
                  ) : (
                    <div className={`mb-1.5 flex aspect-video w-full items-center justify-center rounded ${isFailed ? 'bg-destructive/10' : 'bg-muted'}`}>
                      <span className={`text-[10px] font-mono ${isFailed ? 'text-destructive' : 'text-muted-foreground'}`}>
                        S{shot.scene_number}-{shot.shot_number}{isFailed ? ' ⚠' : ''}
                      </span>
                    </div>
                  )}

                  {/* Label */}
                  <span className='block truncate text-center text-[10px] font-medium'>
                    S{shot.scene_number}-{shot.shot_number}{isFailed ? <AlertTriangle className='ml-0.5 inline size-2.5 text-destructive' /> : null}
                  </span>
                  <span className='text-muted-foreground block truncate text-center text-[9px]'>
                    {shot.camera_angle || shot.description?.slice(0, 20)}
                  </span>

                  {/* Duration indicator */}
                  <div className='bg-muted mt-1 h-1 w-full overflow-hidden rounded-full'>
                    <div
                      className='bg-primary h-full rounded-full'
                      style={{ width: `${Math.min((duration / maxDuration) * 100, 100)}%` }}
                    />
                  </div>
                </button>

                {/* Action buttons */}
                <div className='mt-1 flex items-center gap-0.5'>
                  {showImg ? (
                    isFailed ? (
                      <Button size='sm' variant='outline' className='h-5 px-1.5 text-[9px] border-destructive/40 text-destructive hover:bg-destructive/10' disabled={isGen} onClick={() => onGenerateImage(shot)}>
                        {isGen ? <Loader2 className='size-3 animate-spin' /> : <RefreshCw className='size-3' />}{t('Retry')}
                      </Button>
                    ) : (
                      shot.image_url ? (
                        <Button type='button' variant='ghost' size='icon' className='size-5' disabled={isGen} onClick={() => onGenerateImage(shot)} title={t('Regenerate')}>
                          {isGen ? <Loader2 className='size-3 animate-spin' /> : <RefreshCw className='size-3' />}
                        </Button>
                      ) : (
                        <Button size='sm' variant='outline' className='h-5 px-1.5 text-[9px]' disabled={isGen} onClick={() => onGenerateImage(shot)}>
                          {isGen ? <Loader2 className='size-3 animate-spin' /> : <ImagePlus className='size-3' />}
                        </Button>
                      )
                    )
                  ) : null}
                  {showVid ? (
                    isFailed ? (
                      <Button size='sm' variant='outline' className='h-5 px-1.5 text-[9px] border-destructive/40 text-destructive hover:bg-destructive/10' disabled={isVidGen} onClick={() => onGenerateVideo(shot)}>
                        {isVidGen ? <Loader2 className='size-3 animate-spin' /> : <RefreshCw className='size-3' />}{t('Retry')}
                      </Button>
                    ) : (
                      shot.video_url ? (
                        <button type='button' className='relative size-5 cursor-pointer rounded' onClick={() => setFullscreenVideo({ url: shot.video_url!, poster: shot.image_url || undefined, label: `S${shot.scene_number}-${shot.shot_number}` })}>
                          <video src={shot.video_url} poster={shot.image_url || undefined} className='size-5 rounded object-cover' muted preload='metadata' />
                          <Play className='pointer-events-none absolute inset-0 m-auto size-3 text-white drop-shadow-md' />
                        </button>
                      ) : (
                        <Button size='sm' variant='outline' className='h-5 px-1.5 text-[9px]' disabled={isVidGen} onClick={() => onGenerateVideo(shot)}>
                          {isVidGen ? <Loader2 className='size-3 animate-spin' /> : <Video className='size-3' />}
                        </Button>
                      )
                    )
                  ) : null}
                  <Button variant='ghost' size='icon' className='size-5' onClick={() => selectShot(shot)} aria-label={t('Edit')}>
                    <Pencil className='size-3' />
                  </Button>
                </div>
              </div>
            )
          }) : (
            <div className='flex w-full items-center justify-center py-8'>
              <p className='text-muted-foreground text-xs'>{t('No shots to display on timeline.')}</p>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Inline editing panel */}
      {selectedShot ? (
        <div className='border-border flex shrink-0 flex-col border-t'>
          <ScrollArea className='max-h-[300px]'>
            <div className='p-4'>
              <div className='mx-auto max-w-2xl space-y-3'>
                {selectedShot.image_url ? (
                  <div className='bg-muted border-border flex aspect-video items-center justify-center overflow-hidden rounded-lg border'>
                    <img src={selectedShot.image_url} alt='' className='size-full object-contain' />
                  </div>
                ) : null}
                {/* Failure notice */}
                {selectedShot.status === SHOT_STATUS.FAILED ? (
                  <div className='border-destructive/30 bg-destructive/5 flex items-start gap-2 rounded-lg border p-3'>
                    <AlertTriangle className='text-destructive mt-0.5 size-4 shrink-0' />
                    <div className='min-w-0 flex-1'>
                      <p className='text-destructive text-xs font-medium'>{t('Generation failed')}</p>
                      <p className='text-muted-foreground mt-0.5 text-[11px]'>
                        {t('Edit your prompt and try again.')}
                      </p>
                    </div>
                    <Button size='sm' variant='outline' className='border-destructive/40 text-destructive hover:bg-destructive/10 h-6 shrink-0 text-[10px]'
                      onClick={() => { showImg ? onGenerateImage(selectedShot) : showVid ? onGenerateVideo(selectedShot) : null }}>
                      <RefreshCw className='mr-1 size-3' />{t('Retry')}
                    </Button>
                  </div>
                ) : null}
                <div className='grid grid-cols-3 gap-2'>
                  <div><Label className='text-[11px] font-medium'>{t('Scene')}</Label><Input type='number' min={1} value={shotForm.scene_number} onChange={e => setShotForm(f => ({ ...f, scene_number: Number(e.target.value) || 1 }))} className='mt-0.5 h-7 text-xs' /></div>
                  <div><Label className='text-[11px] font-medium'>{t('Shot')}</Label><Input type='number' min={1} value={shotForm.shot_number} onChange={e => setShotForm(f => ({ ...f, shot_number: Number(e.target.value) || 1 }))} className='mt-0.5 h-7 text-xs' /></div>
                  <div><Label className='text-[11px] font-medium'>{t('Duration (seconds)')}</Label><Input type='number' min={1} max={60} value={shotForm.duration} onChange={e => setShotForm(f => ({ ...f, duration: Number(e.target.value) || 5 }))} className='mt-0.5 h-7 text-xs' /></div>
                </div>
                <div><Label className='text-[11px] font-medium'>{t('Description')}</Label><Textarea value={shotForm.description} onChange={e => setShotForm(f => ({ ...f, description: e.target.value }))} className='mt-0.5 h-16 resize-y text-xs' /></div>
                <div className='grid grid-cols-2 gap-2'>
                  <div><Label className='text-[11px] font-medium'>{t('Camera Angle')}</Label><Input value={shotForm.camera_angle} onChange={e => setShotForm(f => ({ ...f, camera_angle: e.target.value }))} placeholder={t('e.g. Close-up')} className='mt-0.5 h-7 text-xs' /></div>
                  <div><Label className='text-[11px] font-medium'>{t('Camera Move')}</Label><Input value={shotForm.camera_move} onChange={e => setShotForm(f => ({ ...f, camera_move: e.target.value }))} placeholder={t('e.g. Pan')} className='mt-0.5 h-7 text-xs' /></div>
                </div>
                <div className='grid grid-cols-2 gap-2'>
                  <div><Label className='text-[11px] font-medium'>{t('Image Prompt')}</Label><Textarea value={shotForm.image_prompt} onChange={e => setShotForm(f => ({ ...f, image_prompt: e.target.value }))} className='mt-0.5 h-12 resize-y text-xs' /></div>
                  <div><Label className='text-[11px] font-medium'>{t('Video Prompt')}</Label><Textarea value={shotForm.video_prompt} onChange={e => setShotForm(f => ({ ...f, video_prompt: e.target.value }))} className='mt-0.5 h-12 resize-y text-xs' /></div>
                </div>
                {characters.length > 0 ? (
                  <div>
                    <Label className='text-[11px] font-medium'>{t('Characters')}</Label>
                    <div className='border-input max-h-36 space-y-2 overflow-y-auto rounded-md border p-3 mt-0.5'>
                      {characters.map((char) => {
                        const idStr = String(char.id)
                        const selectedIds = new Set(
                          (shotForm.character_ids ?? '').split(',').filter(Boolean)
                        )
                        return (
                          <Label key={char.id} className='flex cursor-pointer items-center gap-2 text-xs font-normal'>
                            <Checkbox
                              checked={selectedIds.has(idStr)}
                              onCheckedChange={(checked) => {
                                const next = new Set(selectedIds)
                                if (checked) next.add(idStr)
                                else next.delete(idStr)
                                setShotForm((f) => ({ ...f, character_ids: [...next].join(',') }))
                              }}
                            />
                            {char.name}
                          </Label>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
                <div className='flex items-center gap-2 border-t pt-3'>
                  <Button size='sm' onClick={handleSave}><Check className='mr-1.5 size-3.5' />{t('Save')}</Button>
                  <Button size='sm' variant='outline' className='text-destructive' onClick={() => { if (confirm(t('Delete this shot?'))) handleDelete() }}><Trash2 className='mr-1.5 size-3.5' />{t('Delete')}</Button>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      ) : null}

      {/* Fullscreen video */}
      {fullscreenVideo ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80' onClick={() => setFullscreenVideo(null)}>
          <video src={fullscreenVideo.url} poster={fullscreenVideo.poster} className='max-h-[90vh] max-w-[90vw]' controls autoPlay />
          <Button variant='ghost' size='icon' className='absolute right-4 top-4 text-white' onClick={() => setFullscreenVideo(null)}><X className='size-6' /></Button>
        </div>
      ) : null}
    </div>
  )
}
