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
import { memo, useCallback } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { X } from 'lucide-react'

const COLOR_MAP: Record<string, string> = {
  CLIPTextEncode: 'border-yellow-400',
  CheckpointLoaderSimple: 'border-blue-400',
  UNETLoader: 'border-blue-400',
  CLIPLoader: 'border-blue-400',
  VAELoader: 'border-blue-400',
  DualCLIPLoader: 'border-blue-400',
  UpscaleModelLoader: 'border-blue-400',
  LatentUpscaleModelLoader: 'border-blue-400',
  LTXVAudioVAELoader: 'border-blue-400',
  LTXAVTextEncoderLoader: 'border-blue-400',
  LoadImage: 'border-green-400',
  LoadImageMask: 'border-green-400',
  EmptyLatentImage: 'border-purple-400',
  EmptySD3LatentImage: 'border-purple-400',
  EmptyHunyuanLatentVideo: 'border-purple-400',
  EmptyLTXVideoLatent: 'border-purple-400',
  EmptyLTXVLatentVideo: 'border-purple-400',
  LTXVEmptyLatentAudio: 'border-purple-400',
  LTXVConcatAVLatent: 'border-purple-400',
  LTXVSeparateAVLatent: 'border-purple-400',
  LTXVCropGuides: 'border-purple-400',
  PrimitiveInt: 'border-teal-400',
  PrimitiveStringMultiline: 'border-teal-400',
  ComfyMathExpression: 'border-teal-300',
  LTXVConditioning: 'border-teal-400',
  KSampler: 'border-orange-400',
  SamplerCustomAdvanced: 'border-orange-400',
  BasicScheduler: 'border-orange-300',
  BasicGuider: 'border-orange-300',
  RandomNoise: 'border-orange-300',
  KSamplerSelect: 'border-orange-300',
  CFGGuider: 'border-orange-300',
  LTXVScheduler: 'border-orange-300',
  ManualSigmas: 'border-orange-300',
  PathchSageAttentionKJ: 'border-gray-300',
  LTX2SamplingPreviewOverride: 'border-gray-300',
  VAEDecode: 'border-pink-400',
  VAEEncode: 'border-pink-400',
  VAEEncodeForInpaint: 'border-pink-400',
  VAEDecodeTiled: 'border-pink-400',
  LTXVAudioVAEDecode: 'border-pink-400',
  LTXVLatentUpsampler: 'border-pink-400',
  SaveImage: 'border-red-400',
  PreviewImage: 'border-red-400',
  VHS_VideoCombine: 'border-red-400',
  ImageUpscaleWithModel: 'border-pink-400',
  SaveVideo: 'border-red-400',
  CreateVideo: 'border-red-400',
  ADE_AnimateDiffLoaderWithContext: 'border-blue-400',
}

export interface ComfyuiNodeData {
  classType: string
  title: string
  summary: string | null
  adjustable: Array<{
    fieldName: string
    type: 'string' | 'number' | 'boolean'
    value: unknown
  }>
  targetHandles: string[]
  sourceHandles: number[]
  dimmed: boolean
  onInputChange: (fieldName: string, value: unknown) => void
  onDelete?: () => void
}

function fieldLabel(fieldName: string): string {
  return fieldName.replace(/_/g, ' ')
}

function handleTop(idx: number, total: number): string {
  if (total <= 1) return '50%'
  return `${25 + (idx / (total - 1)) * 55}%`
}

export const ComfyuiNode = memo(function ComfyuiNode({
  data,
  selected,
}: NodeProps) {
  const {
    classType, title, summary, adjustable,
    targetHandles, sourceHandles, dimmed,
    onInputChange, onDelete,
  } = data as unknown as ComfyuiNodeData

  const borderColor = COLOR_MAP[classType] ?? 'border-gray-300'

  const handleChange = useCallback(
    (fieldName: string, type: string) =>
      (e: React.ChangeEvent<HTMLInputElement>) => {
        if (type === 'number') {
          onInputChange(fieldName, Number(e.target.value))
        } else if (type === 'boolean') {
          onInputChange(fieldName, e.target.checked)
        } else {
          onInputChange(fieldName, e.target.value)
        }
      },
    [onInputChange]
  )

  return (
    <div
      className={`group w-56 rounded-lg border-2 bg-card shadow-md transition-all duration-200 ${borderColor} ${
        selected ? 'ring-2 ring-primary/50' : ''
      } ${dimmed ? 'opacity-25' : ''}`}
    >
      {/* Header */}
      <div className='relative rounded-t-md bg-muted/60 px-3 py-1.5 border-b'>
        <p className='text-[11px] font-semibold leading-tight truncate text-foreground/80'>
          {title}
        </p>
        <p className='text-[10px] text-muted-foreground pr-5'>{classType}</p>
        {onDelete && (
          <button
            className='absolute right-1.5 top-1.5 rounded p-0.5 text-muted-foreground
              opacity-0 hover:bg-muted hover:text-red-500 transition-all
              group-hover:opacity-100'
            title='Delete node'
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <X className='h-3 w-3' />
          </button>
        )}
      </div>

      {/* Body: summary or editable inputs */}
      {adjustable.length > 0 ? (
        <div className='space-y-1 px-2.5 py-2'>
          {adjustable.map((field) => (
            <div key={field.fieldName} className='flex items-center gap-1.5'>
              <label className='w-16 shrink-0 text-[10px] text-muted-foreground truncate'>
                {fieldLabel(field.fieldName)}
              </label>
              {field.type === 'boolean' ? (
                <input
                  type='checkbox'
                  checked={!!field.value}
                  onChange={handleChange(field.fieldName, 'boolean')}
                  className='h-3.5 w-3.5'
                />
              ) : (
                <input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={String(field.value ?? '')}
                  onChange={handleChange(field.fieldName, field.type)}
                  className='min-w-0 flex-1 rounded border bg-background px-1.5 py-0.5 text-[11px]
                    focus:outline-none focus:ring-1 focus:ring-primary/30'
                />
              )}
            </div>
          ))}
        </div>
      ) : summary ? (
        <div className='px-2.5 py-2'>
          <p className='text-[10px] text-muted-foreground leading-snug break-all'>
            {summary}
          </p>
        </div>
      ) : null}

      {/* Target handles (left) — one per input field */}
      {(targetHandles ?? []).map((fieldName, idx, arr) => (
        <Handle
          key={`t-${fieldName}`}
          id={fieldName}
          type='target'
          position={Position.Left}
          style={{ top: handleTop(idx, arr.length) }}
          className='!h-2.5 !w-2.5 !bg-primary'
        />
      ))}

      {/* Source handles (right) — one per output */}
      {(sourceHandles ?? []).map((outputIdx, idx, arr) => (
        <Handle
          key={`s-${outputIdx}`}
          id={String(outputIdx)}
          type='source'
          position={Position.Right}
          style={{ top: handleTop(idx, arr.length) }}
          className='!h-2.5 !w-2.5 !bg-primary'
        />
      ))}
    </div>
  )
})
