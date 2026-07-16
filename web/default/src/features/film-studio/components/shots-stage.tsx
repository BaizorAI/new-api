/*
Copyright (C) 2023-2026 QuantumNous
This program is free software ... (full license header omitted for brevity)
For commercial licensing, please contact support@quantumnous.com
*/
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronDown, ChevronUp, ImagePlus, Loader2, Pencil, Play, RefreshCw, Trash2, Video } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'

import { updateStudioShot, deleteStudioShot, createStudioShots } from '../api'
import { STUDIO_QUERY_KEYS } from '../constants'
import type { StudioShot } from '../types'

type DialogType = 'create' | 'update' | 'delete'

interface ShotsStageProps {
  projectId: number
  stageKey: string
  shots: StudioShot[]
  generatingIds: Set<number>
  videoGeneratingIds: Set<number>
  onGenerateImage: (shot: StudioShot) => void
  onGenerateVideo: (shot: StudioShot) => void
  onSwapOrder: (shotA: {id:number,sort_order:number}, shotB: {id:number,sort_order:number}) => void
}

export function ShotsStage({
  projectId, stageKey, shots,
  generatingIds, videoGeneratingIds,
  onGenerateImage, onGenerateVideo, onSwapOrder,
}: ShotsStageProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const [selectedShotId, setSelectedShotId] = useState<number|null>(null)
  const [shotForm, setShotForm] = useState({ scene_number:1, shot_number:1, description:'', camera_angle:'', camera_move:'', duration:5, image_prompt:'', video_prompt:'' })
  const [dialog, setDialog] = useState<{type:DialogType, shot?:StudioShot}|null>(null)
  const [fullscreenVideo, setFullscreenVideo] = useState<{url:string,poster?:string,label:string}|null>(null)

  const selectedShot = shots.find(s=>s.id===selectedShotId) ?? null

  const selectShot = useCallback((s:StudioShot)=>{
    setSelectedShotId(s.id)
    setShotForm({scene_number:s.scene_number??1,shot_number:s.shot_number??1,description:s.description??'',camera_angle:s.camera_angle??'',camera_move:s.camera_move??'',duration:s.duration??5,image_prompt:s.image_prompt??'',video_prompt:s.video_prompt??''})
  },[])

  const handleSave = useCallback(async()=>{
    if(!selectedShotId||!shotForm.description.trim())return
    try{
      await updateStudioShot(projectId,selectedShotId,shotForm)
      void queryClient.invalidateQueries({queryKey:[...STUDIO_QUERY_KEYS.shots(projectId)]})
      toast.success(t('Shot saved.'))
    }catch{toast.error(t('Failed to save shot.'))}
  },[projectId,selectedShotId,shotForm,queryClient,t])

  const handleDelete = useCallback(async()=>{
    if(!selectedShotId)return
    try{
      await deleteStudioShot(projectId,selectedShotId)
      setSelectedShotId(null)
      void queryClient.invalidateQueries({queryKey:[...STUDIO_QUERY_KEYS.shots(projectId)]})
      toast.success(t('Shot deleted.'))
    }catch{toast.error(t('Failed to delete shot.'))}
  },[projectId,selectedShotId,queryClient,t])

  const handleCreate = useCallback(async()=>{
    try{
      const n=shots.length+1
      await createStudioShots(projectId,[{scene_number:1,shot_number:n,description:t('New shot'),camera_angle:'',camera_move:'',duration:5,image_prompt:''}])
      void queryClient.invalidateQueries({queryKey:[...STUDIO_QUERY_KEYS.shots(projectId)]})
      toast.success(t('Shot created.'))
    }catch{toast.error(t('Failed to create shot.'))}
  },[projectId,shots.length,queryClient,t])

  return (<>
    <div className='flex min-h-0 flex-1'>
      {/* Left sidebar — shot list */}
      <div className='border-border w-[280px] shrink-0 space-y-1 overflow-auto border-r p-3'>
        <div className='flex items-center justify-between pb-1'><h2 className='text-sm font-medium'>{t('Shots')} ({shots.length})</h2></div>
        <div className='flex flex-wrap items-center gap-2 pb-2'>
          <Button size='sm' variant='outline' onClick={handleCreate}><ImagePlus className='mr-1.5 size-3.5'/>{t('Add Shot')}</Button>
        </div>
        {shots.length>0?shots.map((shot,shotIndex)=>{
          const isGen=generatingIds.has(shot.id)
          const isVidGen=videoGeneratingIds.has(shot.id)
          const showImg=stageKey==='image_gen'||stageKey==='video_gen'
          const showVid=stageKey==='video_gen'
          return (<div key={shot.id} className={`border-border bg-card text-card-foreground rounded-lg border p-2 ${selectedShotId===shot.id?'ring-ring ring-2':''}`}>
            <button type='button' onClick={()=>selectShot(shot)} className='hover:bg-muted/60 flex w-full items-center gap-2 text-left text-xs transition-colors rounded p-1'>
              {shot.image_url?<img src={shot.image_url} alt='' className='bg-muted size-8 shrink-0 rounded object-cover'/>:<span className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded text-[10px] font-mono'>S{shot.scene_number}-{shot.shot_number}</span>}
              <span className='min-w-0'><span className='block truncate text-xs font-medium'>S{shot.scene_number}-{shot.shot_number}</span><span className='text-muted-foreground block truncate text-[10px]'>{shot.description}</span></span>
            </button>
            <div className='mt-1.5 flex items-center gap-1 border-t pt-1.5'>
              {/* Reorder */}
              {stageKey==='storyboard'?<><Button type='button' variant='ghost' size='icon' className='size-5' disabled={shotIndex===0} onClick={()=>{const p=shots[shotIndex-1];onSwapOrder({id:shot.id,sort_order:shot.sort_order},{id:p.id,sort_order:p.sort_order})}} title={t('Move up')}><ChevronUp className='size-3'/></Button><Button type='button' variant='ghost' size='icon' className='size-5' disabled={shotIndex===shots.length-1} onClick={()=>{const n=shots[shotIndex+1];onSwapOrder({id:shot.id,sort_order:shot.sort_order},{id:n.id,sort_order:n.sort_order})}} title={t('Move down')}><ChevronDown className='size-3'/></Button></>:null}
              {/* Generate image */}
              {showImg?shot.image_url?<Button type='button' variant='ghost' size='icon' className='size-5' disabled={isGen} onClick={()=>onGenerateImage(shot)} title={t('Regenerate')}>{isGen?<Loader2 className='size-3 animate-spin'/>:<RefreshCw className='size-3'/>}</Button>:<Button size='sm' variant='outline' className='h-5 flex-1 text-[10px]' disabled={isGen} onClick={()=>onGenerateImage(shot)}>{isGen?<Loader2 className='size-3 animate-spin'/>:<ImagePlus className='size-3'/>}{isGen?t('Gen...'):t('Generate')}</Button>:null}
              {/* Generate video */}
              {showVid?shot.video_url?<button type='button' className='relative size-5 cursor-pointer rounded' onClick={()=>setFullscreenVideo({url:shot.video_url!,poster:shot.image_url||undefined,label:`S${shot.scene_number}-${shot.shot_number}`})}><video src={shot.video_url} poster={shot.image_url||undefined} className='size-5 rounded object-cover' muted preload='metadata'/><Play className='pointer-events-none absolute inset-0 m-auto size-3 text-white drop-shadow-md'/></button>:<Button size='sm' variant='outline' className='h-5 flex-1 text-[10px]' disabled={isVidGen} onClick={()=>onGenerateVideo(shot)}>{isVidGen?<Loader2 className='size-3 animate-spin'/>:<Video className='size-3'/>}{isVidGen?t('Gen...'):t('Generate')}</Button>:null}
              <div className='ml-auto flex gap-0.5'>
                <Button variant='ghost' size='icon' className='size-5' onClick={()=>{setDialog({type:'update',shot})}} aria-label={t('Edit')}><Pencil className='size-3'/></Button>
                <Button variant='ghost' size='icon' className='text-destructive size-5' onClick={()=>{setDialog({type:'delete',shot})}} aria-label={t('Delete')}><Trash2 className='size-3'/></Button>
              </div>
            </div>
          </div>)
        }):<p className='text-muted-foreground px-1 text-xs'>{t('No shots found.')}</p>}
      </div>

      {/* Center: detail editing */}
      <div className='min-w-0 flex-1 overflow-auto p-4'>
        {selectedShot?(
          <div className='mx-auto max-w-2xl space-y-3'>
            {selectedShot.image_url?<div className='bg-muted border-border flex aspect-video items-center justify-center overflow-hidden rounded-lg border'><img src={selectedShot.image_url} alt='' className='size-full object-contain'/></div>:null}
            <div className='grid grid-cols-3 gap-2'>
              <div><Label className='text-[11px] font-medium'>{t('Scene')}</Label><Input type='number' min={1} value={shotForm.scene_number} onChange={e=>setShotForm(f=>({...f,scene_number:Number(e.target.value)||1}))} className='mt-0.5 h-7 text-xs'/></div>
              <div><Label className='text-[11px] font-medium'>{t('Shot')}</Label><Input type='number' min={1} value={shotForm.shot_number} onChange={e=>setShotForm(f=>({...f,shot_number:Number(e.target.value)||1}))} className='mt-0.5 h-7 text-xs'/></div>
              <div><Label className='text-[11px] font-medium'>{t('Duration (seconds)')}</Label><Input type='number' min={1} max={60} value={shotForm.duration} onChange={e=>setShotForm(f=>({...f,duration:Number(e.target.value)||5}))} className='mt-0.5 h-7 text-xs'/></div>
            </div>
            <div><Label className='text-[11px] font-medium'>{t('Description')}</Label><Textarea value={shotForm.description} onChange={e=>setShotForm(f=>({...f,description:e.target.value}))} className='mt-0.5 h-16 resize-y text-xs'/></div>
            <div className='grid grid-cols-2 gap-2'>
              <div><Label className='text-[11px] font-medium'>{t('Camera Angle')}</Label><Input value={shotForm.camera_angle} onChange={e=>setShotForm(f=>({...f,camera_angle:e.target.value}))} placeholder={t('e.g. Close-up')} className='mt-0.5 h-7 text-xs'/></div>
              <div><Label className='text-[11px] font-medium'>{t('Camera Move')}</Label><Input value={shotForm.camera_move} onChange={e=>setShotForm(f=>({...f,camera_move:e.target.value}))} placeholder={t('e.g. Pan')} className='mt-0.5 h-7 text-xs'/></div>
            </div>
            <div className='grid grid-cols-2 gap-2'>
              <div><Label className='text-[11px] font-medium'>{t('Image Prompt')}</Label><Textarea value={shotForm.image_prompt} onChange={e=>setShotForm(f=>({...f,image_prompt:e.target.value}))} className='mt-0.5 h-12 resize-y text-xs'/></div>
              <div><Label className='text-[11px] font-medium'>{t('Video Prompt')}</Label><Textarea value={shotForm.video_prompt} onChange={e=>setShotForm(f=>({...f,video_prompt:e.target.value}))} className='mt-0.5 h-12 resize-y text-xs'/></div>
            </div>
            <div className='flex items-center gap-2 border-t pt-3'>
              <Button size='sm' onClick={handleSave}><Check className='mr-1.5 size-3.5'/>{t('Save')}</Button>
              <Button size='sm' variant='outline' className='text-destructive' onClick={()=>setDialog({type:'delete',shot:selectedShot})}><Trash2 className='mr-1.5 size-3.5'/>{t('Delete')}</Button>
            </div>
          </div>
        ):(<div className='flex h-full items-center justify-center'><p className='text-muted-foreground text-xs'>{t('Select a shot to edit.')}</p></div>)}
      </div>
    </div>

    {/* Fullscreen video */}
    {fullscreenVideo?<div className='fixed inset-0 z-50 flex items-center justify-center bg-black/80' onClick={()=>setFullscreenVideo(null)}><video src={fullscreenVideo.url} poster={fullscreenVideo.poster} className='max-h-[90vh] max-w-[90vw]' controls autoPlay/><Button variant='ghost' size='icon' className='absolute right-4 top-4 text-white' onClick={()=>setFullscreenVideo(null)}><ChevronDown className='size-6'/></Button></div>:null}
  </>)
}
