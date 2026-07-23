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
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import { generateComfyuiVideo, enhancePrompt } from './api'

function parseVideoUrls(content: string): { promptId: string; videos: { name: string; url: string }[] } {
  const promptId = content.match(/Prompt ID:\s*(\S+)/)?.[1] ?? ''
  const videoLines = content.matchAll(/^- (.+\.mp4)\s+(.+)$/gm)
  const videos = Array.from(videoLines, ([_, name, url]) => ({
    name: name.trim(),
    url: url.trim(),
  }))
  return { promptId, videos }
}

export function ComfyuiPlayground() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState('')
  const [enhancedPrompt, setEnhancedPrompt] = useState('')
  const [enhancing, setEnhancing] = useState(false)
  const [width, setWidth] = useState(768)
  const [height, setHeight] = useState(512)
  const [frames, setFrames] = useState(33)
  const [steps, setSteps] = useState(30)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    promptId: string
    videos: { name: string; url: string }[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  const effectivePrompt = enhancedPrompt || prompt

  const handleEnhance = useCallback(async () => {
    if (!prompt.trim()) return
    setEnhancing(true)
    setEnhancedPrompt('')
    try {
      const enhanced = await enhancePrompt(prompt.trim())
      setEnhancedPrompt(enhanced)
    } catch {
      setError(t('Prompt enhancement failed'))
    } finally {
      setEnhancing(false)
    }
  }, [prompt, t])

  const handleGenerate = useCallback(async () => {
    const targetPrompt = enhancedPrompt || prompt
    if (!targetPrompt.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const res = await generateComfyuiVideo(targetPrompt.trim(), {
        width,
        height,
        frames,
        steps,
      })
      const content = res.choices[0]?.message?.content ?? ''
      const parsed = parseVideoUrls(content)
      setResult(parsed)
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      setError(msg || t('Video generation failed'))
    } finally {
      setLoading(false)
    }
  }, [enhancedPrompt, prompt, width, height, frames, steps, t])

  return (
    <div className='flex h-full flex-col'>
      {/* Header */}
      <div className='border-b px-6 py-4'>
        <h1 className='text-xl font-semibold'>{t('ComfyUI Video Lab')}</h1>
        <p className='mt-1 text-sm text-muted-foreground'>
          {t('AI video generation powered by ComfyUI with LTX 2.3.')}
        </p>
      </div>

      {/* Main content */}
      <div className='flex flex-1 overflow-hidden'>
        {/* Left: controls */}
        <div className='flex w-80 flex-col gap-4 border-r p-6'>
          {/* Prompt */}
          <div>
            <label className='mb-1.5 block text-sm font-medium'>
              {t('Prompt')}
            </label>
            <textarea
              className='w-full rounded-lg border bg-background px-3 py-2 text-sm resize-none
                focus:outline-none focus:ring-2 focus:ring-primary/20'
              rows={4}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={t('Describe the video you want to generate...')}
            />
            <button
              className='mt-1.5 w-full rounded-lg border border-dashed border-muted-foreground/30
                px-3 py-1.5 text-xs font-medium text-muted-foreground
                transition-colors hover:border-primary/50 hover:text-primary
                disabled:opacity-50'
              disabled={!prompt.trim() || enhancing || loading}
              onClick={handleEnhance}
            >
              {enhancing ? t('Enhancing...') : t('AI Enhance Prompt')}
            </button>
          </div>

          {/* Enhanced prompt display */}
          {(enhancedPrompt || enhancing) && (
            <div>
              <label className='mb-1.5 block text-sm font-medium'>
                {t('Enhanced Prompt')}
              </label>
              <textarea
                className='w-full rounded-lg border bg-muted/50 px-3 py-2 text-sm resize-none
                  focus:outline-none'
                rows={4}
                value={enhancedPrompt}
                readOnly
                placeholder={t('Generating enhanced prompt...')}
              />
            </div>
          )}

          {/* Parameters */}
          <div className='grid grid-cols-2 gap-3'>
            <div>
              <label className='mb-1 block text-xs font-medium text-muted-foreground'>
                {t('Width')}
              </label>
              <input
                type='number'
                className='w-full rounded-lg border bg-background px-2 py-1.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20'
                value={width}
                min={64}
                max={2048}
                step={64}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </div>
            <div>
              <label className='mb-1 block text-xs font-medium text-muted-foreground'>
                {t('Height')}
              </label>
              <input
                type='number'
                className='w-full rounded-lg border bg-background px-2 py-1.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20'
                value={height}
                min={64}
                max={2048}
                step={64}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </div>
            <div>
              <label className='mb-1 block text-xs font-medium text-muted-foreground'>
                {t('Frames')}
              </label>
              <input
                type='number'
                className='w-full rounded-lg border bg-background px-2 py-1.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20'
                value={frames}
                min={1}
                max={120}
                onChange={(e) => setFrames(Number(e.target.value))}
              />
            </div>
            <div>
              <label className='mb-1 block text-xs font-medium text-muted-foreground'>
                {t('Steps')}
              </label>
              <input
                type='number'
                className='w-full rounded-lg border bg-background px-2 py-1.5 text-sm
                  focus:outline-none focus:ring-2 focus:ring-primary/20'
                value={steps}
                min={1}
                max={100}
                onChange={(e) => setSteps(Number(e.target.value))}
              />
            </div>
          </div>

          {/* Generate button */}
          <button
            className='mt-2 w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-medium
              text-white transition-colors hover:bg-rose-600 disabled:opacity-50'
            disabled={loading || !effectivePrompt.trim()}
            onClick={handleGenerate}
          >
            {loading ? t('Generating...') : t('Generate Video')}
          </button>

          {/* Error */}
          {error && (
            <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
              {error}
            </div>
          )}
        </div>

        {/* Right: result */}
        <div className='flex-1 overflow-auto p-6'>
          {loading && (
            <div className='flex h-full items-center justify-center'>
              <div className='flex flex-col items-center gap-3'>
                <div className='h-8 w-8 animate-spin rounded-full border-2 border-rose-500 border-t-transparent' />
                <p className='text-sm text-muted-foreground'>
                  {t('Generating video, this may take a few minutes...')}
                </p>
              </div>
            </div>
          )}

          {!loading && !result && !error && (
            <div className='flex h-full items-center justify-center'>
              <div className='text-center'>
                <p className='text-sm text-muted-foreground'>
                  {t('Enter a prompt and click Generate to create a video.')}
                </p>
              </div>
            </div>
          )}

          {result && (
            <div className='space-y-6'>
              <div className='text-sm text-muted-foreground'>
                Prompt ID: <code className='rounded bg-muted px-1.5 py-0.5 text-xs'>{result.promptId}</code>
              </div>

              {result.videos.map((video, i) => (
                <div key={i} className='overflow-hidden rounded-lg border'>
                  <div className='border-b bg-muted/50 px-4 py-2 text-sm font-medium'>
                    {video.name}
                  </div>
                  <div className='p-4'>
                    <video
                      controls
                      className='w-full max-h-96 rounded'
                      src={video.url}
                    >
                      {t('Your browser does not support video playback.')}
                    </video>
                    <div className='mt-2 flex items-center gap-2'>
                      <a
                        href={video.url}
                        download={video.name}
                        className='text-xs text-primary hover:underline'
                        target='_blank'
                        rel='noreferrer'
                      >
                        {t('Download')}
                      </a>
                      <span className='text-xs text-muted-foreground'>
                        {video.url}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
