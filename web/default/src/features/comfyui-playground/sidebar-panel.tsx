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
import { useTranslation } from 'react-i18next'
import { Shuffle } from 'lucide-react'

import { HistoryPanel } from './history-panel'
import { readCommonParam } from './workflow-parser'
import type { AdjustableParam, ComfyuiWorkflow, GenerationEntry } from './types'

const BATCH_PRESETS = [
  { label: '480p', width: 640, height: 480 },
  { label: '720p', width: 1280, height: 720 },
  { label: '1080p', width: 1920, height: 1080 },
  { label: '1∶1', width: 1024, height: 1024 },
  { label: '9∶16', width: 720, height: 1280 },
]

function displayValue(val: unknown): string {
  if (val === undefined || val === null) return ''
  return String(val)
}

function warnClass(value: number, min: number, max: number): string {
  return value < min || value > max
    ? 'border-amber-400 ring-2 ring-amber-400/20'
    : ''
}

interface SidebarPanelProps {
  prompt: string
  enhancedPrompt: string
  enhancing: boolean
  loading: boolean
  width: number
  height: number
  frames: number
  fps: number
  steps: number
  seed: number
  cfg: number
  selectedNodeId: string | null
  selectedNodeParams: AdjustableParam[]
  workflow: ComfyuiWorkflow | null
  error: string | null
  onPromptChange: (val: string) => void
  onEnhance: () => void
  onWidthChange: (val: number) => void
  onHeightChange: (val: number) => void
  onFramesChange: (val: number) => void
  onFpsChange: (val: number) => void
  onStepsChange: (val: number) => void
  onSeedChange: (val: number) => void
  onRandomSeed: () => void
  onCfgChange: (val: number) => void
  onPresetSelect: (width: number, height: number) => void
  onNodeParamChange: (nodeId: string, field: string, value: unknown) => void
  history: GenerationEntry[]
  onHistoryLoad: (entry: GenerationEntry) => void
  onHistoryRefresh: () => void
}

export function SidebarPanel({
  prompt,
  enhancedPrompt,
  enhancing,
  loading,
  width,
  height,
  frames,
  fps,
  steps,
  seed,
  cfg,
  selectedNodeId,
  selectedNodeParams,
  workflow,
  error,
  onPromptChange,
  onEnhance,
  onWidthChange,
  onHeightChange,
  onFramesChange,
  onFpsChange,
  onStepsChange,
  onSeedChange,
  onRandomSeed,
  onCfgChange,
  onPresetSelect,
  onNodeParamChange,
  history,
  onHistoryLoad,
  onHistoryRefresh,
}: SidebarPanelProps) {
  const { t } = useTranslation()

  return (
    <div className='flex w-72 flex-col gap-3 overflow-y-auto border-r p-4'>
      {/* Prompt */}
      <div>
        <label className='mb-1.5 block text-xs font-medium text-muted-foreground'>
          {t('Prompt')}
        </label>
        <textarea
          className='w-full rounded-lg border bg-background px-2.5 py-2 text-sm resize-none
            focus:outline-none focus:ring-2 focus:ring-primary/20'
          rows={3}
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder={t('Describe the video...')}
        />
        <button
          className='mt-1.5 w-full rounded-lg border border-dashed border-muted-foreground/30
            px-3 py-1 text-xs font-medium text-muted-foreground
            transition-colors hover:border-primary/50 hover:text-primary
            disabled:opacity-50'
          disabled={!prompt.trim() || enhancing || loading}
          onClick={onEnhance}
        >
          {enhancing ? t('Enhancing...') : t('AI Enhance Prompt')}
        </button>
      </div>

      {/* Enhanced prompt */}
      {(enhancedPrompt || enhancing) && (
        <div>
          <label className='mb-1 block text-xs font-medium text-muted-foreground'>
            {t('Enhanced Prompt')}
          </label>
          <textarea
            className='w-full rounded-lg border bg-muted/50 px-2.5 py-2 text-sm resize-none
              focus:outline-none'
            rows={3}
            value={enhancedPrompt}
            readOnly
          />
        </div>
      )}

      {/* Quick params */}
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
            {t('Width')}
          </label>
          <input
            type='number'
            className={`w-full rounded-lg border bg-background px-2 py-1 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/20 ${warnClass(width, 256, 1920)}`}
            min={64}
            max={2048}
            step={64}
            onChange={(e) => onWidthChange(Number(e.target.value))}
          />
        </div>
        <div>
          <label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
            {t('Height')}
          </label>
          <input
            type='number'
            className={`w-full rounded-lg border bg-background px-2 py-1 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/20 ${warnClass(height, 256, 1920)}`}
            min={64}
            max={2048}
            step={64}
            onChange={(e) => onHeightChange(Number(e.target.value))}
          />
        </div>
        <div>
          <label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
            {t('Frames')}
          </label>
          <input
            type='number'
            className={`w-full rounded-lg border bg-background px-2 py-1 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/20 ${warnClass(frames, 8, 60)}`}
            min={1}
            max={120}
            onChange={(e) => onFramesChange(Number(e.target.value))}
          />
        </div>
        <div>
          <label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
            {t('FPS')}
          </label>
          <input
            type='number'
            className={`w-full rounded-lg border bg-background px-2 py-1 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/20 ${warnClass(fps, 8, 60)}`}
            min={1}
            max={60}
            step={1}
            value={fps}
            onChange={(e) => onFpsChange(Number(e.target.value))}
          />
        </div>
        <div>
          <label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
            {t('Steps')}
          </label>
          <input
            type='number'
            className={`w-full rounded-lg border bg-background px-2 py-1 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/20 ${warnClass(steps, 10, 50)}`}
            min={1}
            max={100}
            onChange={(e) => onStepsChange(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Batch resolution presets */}
      <div className='flex flex-wrap gap-1.5'>
        {BATCH_PRESETS.map((preset) => (
          <button
            key={preset.label}
            className='rounded-full border border-muted-foreground/20 px-2 py-0.5 text-[10px]
              font-medium text-muted-foreground transition-colors
              hover:border-primary/50 hover:text-primary
              disabled:opacity-50'
            disabled={loading}
            onClick={() => onPresetSelect(preset.width, preset.height)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {/* Seed / CFG */}
      <div className='grid grid-cols-2 gap-2'>
        <div>
          <label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
            {t('Seed')}
          </label>
          <div className='flex gap-1'>
            <input
              type='number'
              className='w-full rounded-lg border bg-background px-2 py-1 text-sm
                focus:outline-none focus:ring-2 focus:ring-primary/20'
              value={seed}
              onChange={(e) => onSeedChange(Number(e.target.value))}
            />
            <button
              className='shrink-0 rounded-lg border border-muted-foreground/20 p-1.5
                text-muted-foreground transition-colors hover:border-primary/50
                hover:text-primary disabled:opacity-50'
              disabled={loading}
              onClick={onRandomSeed}
              title={t('Random')}
            >
              <Shuffle className='h-3 w-3' />
            </button>
          </div>
        </div>
        <div>
          <label className='mb-1 block text-[11px] font-medium text-muted-foreground'>
            {t('CFG')}
          </label>
          <input
            type='number'
            className='w-full rounded-lg border bg-background px-2 py-1 text-sm
              focus:outline-none focus:ring-2 focus:ring-primary/20'
            min={1}
            max={20}
            step={0.5}
            value={cfg}
            onChange={(e) => onCfgChange(Number(e.target.value))}
          />
        </div>
      </div>

      {/* Node inspector */}
      {selectedNodeId && (
        <div className='rounded-lg border p-3'>
          <p className='text-xs font-semibold text-muted-foreground mb-2'>
            {t('Node Parameters')}: {selectedNodeId}
          </p>
          {selectedNodeParams.length > 0 ? (
            <div className='space-y-2'>
              {selectedNodeParams.map((param) => {
                const currentVal = readCommonParam(
                  workflow,
                  param.node_id,
                  param.field_name,
                )
                return (
                  <div key={param.field_name} className='flex flex-col gap-0.5'>
                    <label className='text-[10px] text-muted-foreground'>
                      {param.field_name} ({param.type})
                    </label>
                    {param.type === 'boolean' ? (
                      <input
                        type='checkbox'
                        className='h-4 w-4'
                        checked={!!currentVal}
                        onChange={(e) =>
                          onNodeParamChange(
                            param.node_id,
                            param.field_name,
                            e.target.checked,
                          )
                        }
                      />
                    ) : (
                      <input
                        type={param.type === 'number' ? 'number' : 'text'}
                        className='w-full rounded border bg-background px-2 py-1 text-xs
                          focus:outline-none focus:ring-1 focus:ring-primary/30'
                        value={displayValue(currentVal)}
                        onChange={(e) =>
                          onNodeParamChange(
                            param.node_id,
                            param.field_name,
                            param.type === 'number'
                              ? Number(e.target.value)
                              : e.target.value,
                          )
                        }
                      />
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <p className='text-[11px] text-muted-foreground'>
              {t('This node has no adjustable parameters.')}
            </p>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className='rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700'>
          {error}
        </div>
      )}

      {/* Generation history */}
      <HistoryPanel
        history={history}
        onLoad={onHistoryLoad}
        onRefresh={onHistoryRefresh}
      />
    </div>
  )
}
