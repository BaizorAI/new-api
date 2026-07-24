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
import { useState, useCallback, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Upload, X, ImageIcon } from 'lucide-react'

import { generateComfyuiI2V, pollI2VStatus } from '@/features/comfyui-playground/api'
import type { ComfyuiI2VStatusResponse } from '@/features/comfyui-playground/types'

const DEFAULT_PARAMS = { width: 768, height: 512, frames: 33, fps: 24 }

function readBase64File(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      const result = reader.result as string
      resolve(result.startsWith('data:') ? result.split(',')[1] : result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function ImageToVideo() {
  const { t } = useTranslation()

  const [imageBase64, setImageBase64] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [prompt, setPrompt] = useState('')
  const [width, setWidth] = useState(DEFAULT_PARAMS.width)
  const [height, setHeight] = useState(DEFAULT_PARAMS.height)
  const [frames, setFrames] = useState(DEFAULT_PARAMS.frames)
  const [fps, setFps] = useState(DEFAULT_PARAMS.fps)
  const [pasteInput, setPasteInput] = useState('')

  const [loading, setLoading] = useState(false)
  const [jobId, setJobId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    id: string
    videos: { name: string; url: string }[]
  } | null>(null)

  const fileRef = useRef<HTMLInputElement>(null)
  const pollTimer = useRef<ReturnType<typeof setTimeout>>(null)

  // Clean up poll timer
  useEffect(() => {
    return () => {
      if (pollTimer.current) clearTimeout(pollTimer.current)
    }
  }, [])

  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const b64 = await readBase64File(file)
      setImageBase64(b64)
      setImagePreview(URL.createObjectURL(file))
    } catch {
      setError(t('Failed to read image file'))
    }
  }, [t])

  const handlePasteApply = useCallback(() => {
    const trimmed = pasteInput.trim()
    if (!trimmed) return
    const b64 = trimmed.replace(/^data:image\/[^;]+;base64,/, '')
    // Detect if it's a data URL or raw base64
    if (trimmed.startsWith('data:image/')) {
      setImagePreview(trimmed)
    }
    setImageBase64(b64)
    setPasteInput('')
  }, [pasteInput])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    try {
      const b64 = await readBase64File(file)
      setImageBase64(b64)
      setImagePreview(URL.createObjectURL(file))
    } catch {
      setError(t('Failed to read image file'))
    }
  }, [t])

  const handleClearImage = useCallback(() => {
    setImageBase64(null)
    setImagePreview(null)
  }, [])

  const handleGenerate = useCallback(async () => {
    if (!imageBase64 || !prompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await generateComfyuiI2V(imageBase64, prompt.trim(), {
        width, height, num_frames: frames, fps,
      })

      if (res.status === 'completed' && res.data) {
        const videos = res.data.map((d, i) => ({
          name: `${res.id}_${i}.mp4`,
          url: `data:video/mp4;base64,${d.b64_json}`,
        }))
        setResult({ id: res.id, videos })
        setLoading(false)
        return
      }

      // Async job - start polling
      setJobId(res.id)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || t('Generation failed'))
      setLoading(false)
    }
  }, [imageBase64, prompt, width, height, frames, fps, t])

  // Poll i2v job status
  useEffect(() => {
    if (!jobId) return
    let cancelled = false

    const poll = async () => {
      try {
        const status: ComfyuiI2VStatusResponse = await pollI2VStatus(jobId)
        if (cancelled) return
        if (status.status === 'completed') {
          const videos = (status.data ?? []).map((d, i) => ({
            name: `${jobId}_${i}.mp4`,
            url: `data:video/mp4;base64,${d.b64_json}`,
          }))
          setResult({ id: jobId, videos })
          setLoading(false)
          setJobId(null)
          return
        }
        if (status.status === 'failed') {
          const msg = typeof status.error === 'string' ? status.error : status.error?.message ?? 'Unknown error'
          setError(msg)
          setLoading(false)
          setJobId(null)
          return
        }
        pollTimer.current = setTimeout(poll, 3000)
      } catch {
        if (!cancelled) pollTimer.current = setTimeout(poll, 5000)
      }
    }

    poll()
    return () => { cancelled = true }
  }, [jobId])

  const canGenerate = !!imageBase64 && !!prompt.trim() && !loading

  return (
    <div className='grid h-full grid-cols-[360px_1fr]'>
      {/* Left: Form */}
      <div className='flex flex-col gap-5 overflow-y-auto border-r p-6'>
        <h1 className='text-lg font-semibold'>{t('Image to Video')}</h1>

        {/* Image upload */}
        <div>
          <Label className='mb-1.5 block text-xs font-medium text-muted-foreground'>
            {t('Source Image')} <span className='text-red-500'>*</span>
          </Label>
          {imagePreview ? (
            <div className='relative rounded-lg border overflow-hidden'>
              <img src={imagePreview} alt={t('Source')} className='w-full h-40 object-cover' />
              <button
                className='absolute top-1.5 right-1.5 rounded-full bg-black/40 p-1 text-white hover:bg-black/60'
                onClick={handleClearImage}
              >
                <X className='h-3.5 w-3.5' />
              </button>
            </div>
          ) : (
            <div
              className='rounded-lg border-2 border-dashed border-muted-foreground/25 p-4
                transition-colors hover:border-primary/40'
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <div className='flex flex-col items-center gap-3'>
                <ImageIcon className='h-8 w-8 text-muted-foreground/40' />
                <div className='flex flex-col items-center gap-2'>
                  <input ref={fileRef} type='file' accept='image/*' className='hidden' onChange={handleFileUpload} />
                  <button
                    className='rounded-md border px-3 py-1.5 text-xs font-medium
                      text-muted-foreground hover:border-primary/50 hover:text-primary'
                    onClick={() => fileRef.current?.click()}
                    type='button'
                  >
                    <Upload className='mr-1.5 inline h-3.5 w-3.5' />
                    {t('Upload Image')}
                  </button>
                  <span className='text-[11px] text-muted-foreground/50'>{t('or')}</span>
                  <div className='flex w-full gap-1.5'>
                    <input
                      className='flex-1 rounded-md border bg-background px-2.5 py-1.5 text-xs
                        focus:outline-none focus:ring-1 focus:ring-primary/30'
                      placeholder={t('Paste base64 or data URL...')}
                      value={pasteInput}
                      onChange={(e) => setPasteInput(e.target.value)}
                    />
                    <button
                      className='rounded-md border px-3 py-1.5 text-xs font-medium
                        text-muted-foreground hover:border-primary/50 hover:text-primary
                        disabled:opacity-40'
                      disabled={!pasteInput.trim()}
                      onClick={handlePasteApply}
                    >
                      {t('OK')}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Prompt */}
        <div>
          <Label className='mb-1.5 block text-xs font-medium text-muted-foreground'>
            {t('Prompt')} <span className='text-red-500'>*</span>
          </Label>
          <textarea
            className='w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-primary/20'
            rows={3}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t('Describe the desired video...')}
          />
        </div>

        {/* Params */}
        <div className='grid grid-cols-2 gap-3'>
          <div>
            <Label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
              {t('Width')}
            </Label>
            <input
              type='number'
              className='w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/20'
              min={64} max={2048} step={64}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
              {t('Height')}
            </Label>
            <input
              type='number'
              className='w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/20'
              min={64} max={2048} step={64}
              value={height}
              onChange={(e) => setHeight(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
              {t('Frames')}
            </Label>
            <input
              type='number'
              className='w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/20'
              min={1} max={120}
              value={frames}
              onChange={(e) => setFrames(Number(e.target.value))}
            />
          </div>
          <div>
            <Label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
              {t('FPS')}
            </Label>
            <input
              type='number'
              className='w-full rounded-lg border bg-background px-2.5 py-1.5 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/20'
              min={1} max={60}
              value={fps}
              onChange={(e) => setFps(Number(e.target.value))}
            />
          </div>
        </div>

        {/* Generate */}
        <button
          className='flex items-center justify-center gap-2 rounded-lg bg-rose-500 px-4 py-2.5
            text-sm font-medium text-white transition-colors hover:bg-rose-600
            disabled:opacity-50'
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          {loading ? (
            <>
              <span className='h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent' />
              {t('Generating...')}
            </>
          ) : (
            t('Generate Video')
          )}
        </button>

        {error && (
          <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
            {error}
          </div>
        )}
      </div>

      {/* Right: Result */}
      <div className='overflow-y-auto p-6'>
        {!result && !loading && (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            {t('Upload an image and enter a prompt to generate a video')}
          </div>
        )}

        {loading && !result && (
          <div className='flex h-full items-center justify-center gap-3 text-sm text-muted-foreground'>
            <span className='h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent' />
            {t('Your video is being generated...')}
          </div>
        )}

        {result && (
          <div className='space-y-4'>
            <div className='flex items-center justify-between'>
              <h2 className='text-sm font-medium'>{t('Result')}</h2>
              <code className='rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground'>
                {result.id}
              </code>
            </div>
            {result.videos.map((video, i) => (
              <div key={i} className='overflow-hidden rounded-lg border'>
                <div className='border-b bg-muted/50 px-3 py-2 text-xs font-medium'>
                  {video.name}
                </div>
                <video controls className='w-full' src={video.url} />
                <div className='px-3 py-2'>
                  <a
                    href={video.url}
                    download={video.name}
                    className='text-xs text-primary hover:underline'
                  >
                    {t('Download')}
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function Label({ className, children, htmlFor }: {
  className?: string
  children: React.ReactNode
  htmlFor?: string
}) {
  return (
    <label className={className} htmlFor={htmlFor}>
      {children}
    </label>
  )
}
