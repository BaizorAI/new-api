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
import type { Node, Edge, MarkerType } from '@xyflow/react'

import { NODE_LIBRARY } from './node-library'
import type {
  ComfyuiWorkflow,
  ComfyuiWorkflowNode,
  ComfyuiNodeInput,
  ComfyuiNodeConnection,
  AdjustableParam,
  NodePositions,
} from './types'

/**
 * Categorises ComfyUI class_types into layout columns.
 * Left (0) → loaders, Right (4) → outputs.
 */
const COLUMN_MAP: Record<string, number> = {
  CheckpointLoaderSimple: 0,
  UNETLoader: 0,
  CLIPLoader: 0,
  VAELoader: 0,
  DualCLIPLoader: 0,
  UpscaleModelLoader: 0,
  LatentUpscaleModelLoader: 0,
  LoadImage: 0,
  LoadImageMask: 0,
  LTXVAudioVAELoader: 0,
  LTXAVTextEncoderLoader: 0,

  CLIPTextEncode: 1,
  PrimitiveInt: 1,
  PrimitiveStringMultiline: 1,
  ComfyMathExpression: 1,
  LTXVConditioning: 1,

  EmptyLatentImage: 1,
  EmptySD3LatentImage: 1,
  EmptyHunyuanLatentVideo: 1,
  EmptyLTXVideoLatent: 1,
  EmptyLTXVLatentVideo: 1,
  LTXVEmptyLatentAudio: 1,
  LTXVConcatAVLatent: 1,
  LTXVSeparateAVLatent: 1,
  LTXVCropGuides: 1,

  KSampler: 2,
  SamplerCustomAdvanced: 2,
  KSamplerSelect: 2,
  BasicScheduler: 2,
  BasicGuider: 2,
  RandomNoise: 2,
  CFGGuider: 2,
  LTXVScheduler: 2,
  ManualSigmas: 2,
  PathchSageAttentionKJ: 2,
  LTX2SamplingPreviewOverride: 2,

  VAEDecode: 3,
  VAEEncode: 3,
  VAEEncodeForInpaint: 3,
  VAEDecodeTiled: 3,
  LTXVAudioVAEDecode: 3,
  LTXVLatentUpsampler: 3,

  SaveImage: 4,
  PreviewImage: 4,
  VHS_VideoCombine: 4,
  ImageUpscaleWithModel: 4,
  SaveVideo: 4,
  CreateVideo: 4,

  ADE_AnimateDiffLoaderWithContext: 1,
}

function columnForNode(node: ComfyuiWorkflowNode): number {
  return COLUMN_MAP[node.class_type] ?? 2
}

/** Pure sink node types that never have source handles. */
const PURE_SINK_TYPES = new Set([
  'SaveImage', 'PreviewImage', 'VHS_VideoCombine', 'SaveVideo', 'CreateVideo',
])

/** Get the number of source handles for a given class type. */
export function getNodeOutputCount(classType: string): number {
  const entry = NODE_LIBRARY.find((e) => e.classType === classType)
  if (entry) return entry.outputCount
  if (PURE_SINK_TYPES.has(classType)) return 0
  return 1
}

/** Generate positions for every node, applying saved positions first. */
function layoutNodes(
  wf: ComfyuiWorkflow,
  savedPositions?: NodePositions,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}

  // 1. Apply saved positions first
  if (savedPositions) {
    for (const [nodeId, pos] of Object.entries(savedPositions)) {
      if (wf[nodeId]) positions[nodeId] = { ...pos }
    }
  }

  // 2. Auto-layout remaining nodes in grid
  const columnRows: Record<number, number> = {}
  for (const [nodeId, node] of Object.entries(wf)) {
    if (positions[nodeId]) continue
    const col = columnForNode(node)
    const row = columnRows[col] ?? 0
    positions[nodeId] = { x: col * 300, y: row * 190 }
    columnRows[col] = row + 1
  }
  return positions
}

/** Class types that are connection-only — their inputs are always edges. */
const CONNECTION_ONLY_TYPES = new Set([
  'VAEDecode',
  'VAEEncode',
  'VAEEncodeForInpaint',
  'ImageUpscaleWithModel',
  'ADE_AnimateDiffLoaderWithContext',
  'ComfyMathExpression',
  'LTXVConcatAVLatent',
  'LTXVSeparateAVLatent',
  'LTXVCropGuides',
  'PathchSageAttentionKJ',
  'LTX2SamplingPreviewOverride',
])

/** Fields that represent model name selections (shown as labels, not inputs). */
const MODEL_NAME_FIELDS = new Set([
  'ckpt_name',
  'unet_name',
  'clip_name1',
  'clip_name2',
  'vae_name',
  'model_name',
  'lora_name',
  'text_encoder',
  'audio_vae',
  'upscale_model',
])

/**
 * Build a compact one-line summary of the key values on this node.
 * Returns null for fully connection-based nodes (e.g. VAEDecode).
 */
function nodeSummary(node: ComfyuiWorkflowNode): string | null {
  if (CONNECTION_ONLY_TYPES.has(node.class_type)) return null
  const inputs = node.inputs ?? {}
  const parts: string[] = []

  for (const [key, val] of Object.entries(inputs)) {
    if (Array.isArray(val)) continue
    if (MODEL_NAME_FIELDS.has(key)) {
      const s = String(val)
      parts.push(s.length > 22 ? s.slice(0, 20) + '..' : s)
    } else if (key === 'text' || key === 'value') {
      const s = String(val)
      parts.push(s.length > 28 ? s.slice(0, 26) + '..' : s)
    } else if (typeof val === 'number' || typeof val === 'boolean') {
      parts.push(`${key}: ${String(val)}`)
    }
  }
  return parts.length > 0 ? parts.join('  ·  ') : null
}

export interface ParsedGraph {
  nodes: Node[]
  edges: Edge[]
}

export function parseWorkflowToGraph(
  wf: ComfyuiWorkflow,
  onInputChange: (nodeId: string, fieldName: string, value: unknown) => void,
  savedPositions?: NodePositions,
  onDeleteNode?: (nodeId: string) => void,
): ParsedGraph {
  const positions = layoutNodes(wf, savedPositions)
  const nodes: Node[] = []
  const edges: Edge[] = []

  for (const [nodeId, node] of Object.entries(wf)) {
    const { class_type: classType, inputs } = node
    const meta = node._meta ?? { title: classType }
    const title = meta.title || classType

    const adjustable: Array<{
      fieldName: string
      type: 'string' | 'number' | 'boolean'
      value: unknown
    }> = []

    // Build target handles: one per input field
    const targetHandles: string[] = Object.keys(inputs ?? {})
    // Build source handles: one per output index
    const outputCount = getNodeOutputCount(classType)
    const sourceHandles: number[] = Array.from({ length: outputCount }, (_, i) => i)

    for (const [fieldName, val] of Object.entries(inputs ?? {})) {
      if (Array.isArray(val) && val.length === 2 && typeof val[0] === 'string') {
        edges.push({
          id: `${val[0]}-${nodeId}-${fieldName}`,
          source: val[0],
          target: nodeId,
          sourceHandle: String(val[1]),
          targetHandle: fieldName,
          type: 'smoothstep',
          animated: true,
          label: fieldName,
          labelStyle: { fontSize: 9, fill: 'var(--muted-foreground)' },
          labelBgStyle: { fill: 'var(--background)', fillOpacity: 0.8 },
          style: { stroke: 'var(--primary)', strokeWidth: 1.5 },
          markerEnd: { type: 'arrowclosed' as typeof MarkerType.ArrowClosed },
          data: {
            targetNodeId: nodeId,
            targetField: fieldName,
            sourceNodeId: val[0] as string,
            sourceOutput: val[1] as number,
          },
        })
      } else {
        const t =
          typeof val === 'boolean'
            ? ('boolean' as const)
            : typeof val === 'number'
              ? ('number' as const)
              : ('string' as const)
        adjustable.push({ fieldName, type: t, value: val })
      }
    }

    const pos = positions[nodeId] ?? { x: 0, y: 0 }
    const summary = nodeSummary(node)

    nodes.push({
      id: nodeId,
      type: 'comfyui',
      position: pos,
      data: {
        classType,
        title,
        summary,
        adjustable,
        targetHandles,
        sourceHandles,
        dimmed: false,
        onInputChange: (fieldName: string, value: unknown) =>
          onInputChange(nodeId, fieldName, value),
        onDelete: onDeleteNode ? () => onDeleteNode(nodeId) : undefined,
      },
    })
  }

  return { nodes, edges }
}

// ── Workflow mutation functions ───────────────────────────────────────────

/** Add a new node to the workflow. */
export function addNodeToWorkflow(
  wf: ComfyuiWorkflow,
  nodeId: string,
  classType: string,
  defaultInputs: Record<string, ComfyuiNodeInput>,
  meta?: { title: string },
): ComfyuiWorkflow {
  return {
    ...wf,
    [nodeId]: {
      class_type: classType,
      _meta: meta ?? { title: classType },
      inputs: { ...defaultInputs },
    },
  }
}

/** Remove a node and clean up all connections referencing it from other nodes. */
export function removeNodeFromWorkflow(
  wf: ComfyuiWorkflow,
  nodeId: string,
): ComfyuiWorkflow {
  const { [nodeId]: _removed, ...rest } = wf

  for (const [id, node] of Object.entries(rest)) {
    let needsUpdate = false
    const cleanedInputs: Record<string, ComfyuiNodeInput> = {}
    for (const [field, value] of Object.entries(node.inputs ?? {})) {
      if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'string' && value[0] === nodeId) {
        cleanedInputs[field] = ''
        needsUpdate = true
      } else {
        cleanedInputs[field] = value
      }
    }
    if (needsUpdate) {
      rest[id] = { ...node, inputs: cleanedInputs }
    }
  }
  return rest
}

/** Add a connection between two nodes. Overwrites existing value at targetField. */
export function addConnectionToWorkflow(
  wf: ComfyuiWorkflow,
  sourceId: string,
  sourceOutput: number,
  targetId: string,
  targetField: string,
): ComfyuiWorkflow {
  const node = wf[targetId]
  if (!node) return wf
  return {
    ...wf,
    [targetId]: {
      ...node,
      inputs: {
        ...node.inputs,
        [targetField]: [sourceId, sourceOutput] as ComfyuiNodeConnection,
      },
    },
  }
}

/** Remove a connection from a node's input, resetting to empty string. */
export function removeConnectionFromWorkflow(
  wf: ComfyuiWorkflow,
  nodeId: string,
  fieldName: string,
): ComfyuiWorkflow {
  const node = wf[nodeId]
  if (!node) return wf
  const currentValue = node.inputs[fieldName]
  if (!Array.isArray(currentValue)) return wf
  return {
    ...wf,
    [nodeId]: {
      ...node,
      inputs: {
        ...node.inputs,
        [fieldName]: '',
      },
    },
  }
}

// ── Common params detection ───────────────────────────────────────────────

/**
 * Find common top-level params in a workflow by scanning adjustable_params
 * for known field names. Handles both SD-style (single latent/sampler node
 * with multiple fields) and LTX-style (separate PrimitiveInt/CFGGuider/etc.
 * nodes per field).
 */
export interface CommonParams {
  promptNodeId: string | null
  promptField: string | null
  widthNodeId: string | null
  heightNodeId: string | null
  framesNodeId: string | null
  fpsNodeId: string | null
  widthField: string | null
  heightField: string | null
  framesField: string | null
  fpsField: string | null
  stepsNodeId: string | null
  stepsField: string | null
  seedNodeId: string | null
  seedField: string | null
  cfgNodeId: string | null
  cfgField: string | null
}

/** Resolve the node ID for a param, preferring the specific field node ID. */
export function paramNodeId(specific: string | null, fallback: string | null): string | null {
  return specific || fallback
}

export function detectCommonParams(params: AdjustableParam[]): CommonParams {
  const result: CommonParams = {
    promptNodeId: null,
    promptField: null,
    widthNodeId: null,
    heightNodeId: null,
    framesNodeId: null,
    fpsNodeId: null,
    widthField: null,
    heightField: null,
    framesField: null,
    fpsField: null,
    stepsNodeId: null,
    stepsField: null,
    seedNodeId: null,
    seedField: null,
    cfgNodeId: null,
    cfgField: null,
  }

  for (const p of params) {
    const { node_id: nid, class_type: ct, field_name: fn, title } = p

    // Prompt — CLIPTextEncode or PrimitiveStringMultiline with text/value fields
    if (fn === 'text' || fn === 'value') {
      if (ct === 'CLIPTextEncode' || ct === 'PrimitiveStringMultiline' || title === 'Prompt') {
        result.promptNodeId = nid
        result.promptField = fn
      }
    }

    // Width — latent node width field, or PrimitiveInt titled "Width"
    if (fn === 'width' || (ct === 'PrimitiveInt' && title === 'Width' && fn === 'value')) {
      result.widthNodeId = nid
      result.widthField = fn
    }

    // Height — latent node height field, or PrimitiveInt titled "Height"
    if (fn === 'height' || (ct === 'PrimitiveInt' && title === 'Height' && fn === 'value')) {
      result.heightNodeId = nid
      result.heightField = fn
    }

    // Frames — latent node length/frames field, or PrimitiveInt titled "Length"
    if (
      fn === 'length' || fn === 'frames' ||
      (ct === 'PrimitiveInt' && title === 'Length' && fn === 'value')
    ) {
      result.framesNodeId = nid
      result.framesField = fn
    }

    // FPS — PrimitiveInt titled "Frame Rate" with value field
    if (
      fn === 'fps' || fn === 'frame_rate' ||
      (ct === 'PrimitiveInt' && title === 'Frame Rate' && fn === 'value')
    ) {
      result.fpsNodeId = nid
      result.fpsField = fn
    }

    // Steps — KSampler, LTXVScheduler, BasicScheduler, or SamplerCustomAdvanced
    if (fn === 'steps') {
      if (ct === 'KSampler' || ct === 'LTXVScheduler' || ct === 'BasicScheduler') {
        result.stepsNodeId = nid
        result.stepsField = fn
      }
    }

    // Seed — KSampler seed, or RandomNoise noise_seed
    if (fn === 'seed' || fn === 'noise_seed') {
      if (ct === 'KSampler' || ct === 'RandomNoise') {
        result.seedNodeId = nid
        result.seedField = fn
      }
    }

    // CFG — KSampler cfg, or CFGGuider cfg
    if (fn === 'cfg') {
      if (ct === 'KSampler' || ct === 'CFGGuider') {
        result.cfgNodeId = nid
        result.cfgField = fn
      }
    }
  }

  return result
}

/**
 * Read and write common params from/to the workflow.
 */
export function readCommonParam(
  wf: ComfyuiWorkflow | null,
  nodeId: string | null,
  field: string | null
): unknown {
  if (!wf || !nodeId || !field) return undefined
  return wf[nodeId]?.inputs?.[field]
}

export function writeCommonParam(
  wf: ComfyuiWorkflow,
  nodeId: string | null,
  field: string | null,
  value: unknown
): ComfyuiWorkflow {
  if (!nodeId || !field) return wf
  const node = wf[nodeId]
  const updatedInputs: Record<string, ComfyuiNodeInput> = {
    ...node.inputs,
    [field]: value as ComfyuiNodeInput,
  }
  return {
    ...wf,
    [nodeId]: { ...node, inputs: updatedInputs },
  }
}
