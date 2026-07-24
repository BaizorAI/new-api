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
import type { NodeLibraryEntry } from './types'

export const NODE_LIBRARY: NodeLibraryEntry[] = [
  // ── Loaders ──
  {
    classType: 'CheckpointLoaderSimple', category: 'loaders', outputCount: 1,
    defaultInputs: { ckpt_name: '' },
    defaultMeta: { title: 'Load Checkpoint' },
    searchAliases: ['checkpoint', 'model'],
  },
  {
    classType: 'UNETLoader', category: 'loaders', outputCount: 1,
    defaultInputs: { unet_name: '', weight_dtype: 'default' },
    defaultMeta: { title: 'Load UNET' },
  },
  {
    classType: 'CLIPLoader', category: 'loaders', outputCount: 1,
    defaultInputs: { clip_name: '', type: 'stable_diffusion' },
    defaultMeta: { title: 'Load CLIP' },
  },
  {
    classType: 'VAELoader', category: 'loaders', outputCount: 1,
    defaultInputs: { vae_name: '' },
    defaultMeta: { title: 'Load VAE' },
  },
  {
    classType: 'DualCLIPLoader', category: 'loaders', outputCount: 1,
    defaultInputs: { clip_name1: '', clip_name2: '', type: 'sdxl' },
    defaultMeta: { title: 'Dual CLIP Loader' },
  },
  {
    classType: 'LoadImage', category: 'loaders', outputCount: 1,
    defaultInputs: { image: '' },
    defaultMeta: { title: 'Load Image' },
    searchAliases: ['image'],
  },
  {
    classType: 'LoadImageMask', category: 'loaders', outputCount: 1,
    defaultInputs: { image: '', channel: 'alpha' },
    defaultMeta: { title: 'Load Image Mask' },
  },
  {
    classType: 'LoadVideo', category: 'loaders', outputCount: 1,
    defaultInputs: { video: '', frame_load_cap: 0, force_rate: 0, select_every_nth: 1 },
    defaultMeta: { title: 'Load Video' },
    searchAliases: ['video'],
  },
  {
    classType: 'UpscaleModelLoader', category: 'loaders', outputCount: 1,
    defaultInputs: { model_name: '' },
    defaultMeta: { title: 'Load Upscale Model' },
  },
  {
    classType: 'LatentUpscaleModelLoader', category: 'loaders', outputCount: 1,
    defaultInputs: { model_name: '' },
    defaultMeta: { title: 'Load Latent Upscale Model' },
  },
  {
    classType: 'LTXVAudioVAELoader', category: 'loaders', outputCount: 1,
    defaultInputs: { audio_vae: '' },
    defaultMeta: { title: 'Load LTX Audio VAE' },
  },
  {
    classType: 'LTXAVTextEncoderLoader', category: 'loaders', outputCount: 1,
    defaultInputs: { text_encoder: '' },
    defaultMeta: { title: 'Load LTX Text Encoder' },
  },

  // ── Conditioning ──
  {
    classType: 'CLIPTextEncode', category: 'conditioning', outputCount: 1,
    defaultInputs: { clip: '', text: '' },
    defaultMeta: { title: 'CLIP Text Encode' },
    searchAliases: ['prompt', 'text'],
  },
  {
    classType: 'CLIPTextEncodeSDXL', category: 'conditioning', outputCount: 1,
    defaultInputs: { clip: '', width: 1024, height: 1024, text_g: '', text_l: '' },
    defaultMeta: { title: 'CLIP Text Encode SDXL' },
  },
  {
    classType: 'LTXVConditioning', category: 'conditioning', outputCount: 1,
    defaultInputs: { positive: '', negative: '' },
    defaultMeta: { title: 'LTX Conditioning' },
  },

  // ── Latent ──
  {
    classType: 'EmptyLatentImage', category: 'latent', outputCount: 1,
    defaultInputs: { width: 512, height: 512, batch_size: 1 },
    defaultMeta: { title: 'Empty Latent Image' },
    searchAliases: ['latent', 'resolution'],
  },
  {
    classType: 'EmptySD3LatentImage', category: 'latent', outputCount: 1,
    defaultInputs: { width: 1024, height: 1024, batch_size: 1 },
    defaultMeta: { title: 'Empty SD3 Latent' },
  },
  {
    classType: 'EmptyHunyuanLatentVideo', category: 'latent', outputCount: 1,
    defaultInputs: { width: 720, height: 480, length: 25 },
    defaultMeta: { title: 'Empty Hunyuan Latent Video' },
  },
  {
    classType: 'EmptyLTXVideoLatent', category: 'latent', outputCount: 1,
    defaultInputs: { width: 768, height: 512, length: 33, batch_size: 1 },
    defaultMeta: { title: 'Empty LTX Video Latent' },
  },
  {
    classType: 'EmptyLTXVLatentVideo', category: 'latent', outputCount: 1,
    defaultInputs: { width: 768, height: 512, length: 33 },
    defaultMeta: { title: 'Empty LTXV Latent Video' },
  },
  {
    classType: 'LTXVEmptyLatentAudio', category: 'latent', outputCount: 1,
    defaultInputs: { length: 128 },
    defaultMeta: { title: 'Empty LTXV Latent Audio' },
  },
  {
    classType: 'LTXVConcatAVLatent', category: 'latent', outputCount: 1,
    defaultInputs: { audio: '', video: '' },
    defaultMeta: { title: 'Concat AV Latent' },
  },
  {
    classType: 'LTXVSeparateAVLatent', category: 'latent', outputCount: 2,
    defaultInputs: { av_latent: '' },
    defaultMeta: { title: 'Separate AV Latent' },
  },
  {
    classType: 'LTXVCropGuides', category: 'latent', outputCount: 1,
    defaultInputs: { crop_width: 768, crop_height: 512, target_width: 768, target_height: 512 },
    defaultMeta: { title: 'LTX Crop Guides' },
  },

  // ── Sampling ──
  {
    classType: 'KSampler', category: 'sampling', outputCount: 1,
    defaultInputs: { model: '', positive: '', negative: '', latent_image: '', seed: 0, steps: 30, cfg: 7, sampler_name: 'euler', scheduler: 'normal', denoise: 1 },
    defaultMeta: { title: 'KSampler' },
    searchAliases: ['sampler'],
  },
  {
    classType: 'SamplerCustomAdvanced', category: 'sampling', outputCount: 1,
    defaultInputs: { noise: '', guider: '', sampler: '', sigmas: '', latent_image: '' },
    defaultMeta: { title: 'Sampler Custom Advanced' },
  },
  {
    classType: 'BasicScheduler', category: 'sampling', outputCount: 1,
    defaultInputs: { model: '', sigmas: '', scheduler: 'normal', steps: 30, denoise: 1 },
    defaultMeta: { title: 'Basic Scheduler' },
  },
  {
    classType: 'KSamplerSelect', category: 'sampling', outputCount: 1,
    defaultInputs: { sampler_name: 'euler' },
    defaultMeta: { title: 'KSampler Select' },
  },
  {
    classType: 'BasicGuider', category: 'sampling', outputCount: 1,
    defaultInputs: { model: '', conditioning: '' },
    defaultMeta: { title: 'Basic Guider' },
  },
  {
    classType: 'RandomNoise', category: 'sampling', outputCount: 1,
    defaultInputs: { noise_seed: 0 },
    defaultMeta: { title: 'Random Noise' },
  },
  {
    classType: 'CFGGuider', category: 'sampling', outputCount: 1,
    defaultInputs: { model: '', positive: '', negative: '', cfg: 3.6 },
    defaultMeta: { title: 'CFG Guider' },
  },
  {
    classType: 'LTXVScheduler', category: 'sampling', outputCount: 1,
    defaultInputs: { model: '', steps: 30 },
    defaultMeta: { title: 'LTX Scheduler' },
  },
  {
    classType: 'ManualSigmas', category: 'sampling', outputCount: 1,
    defaultInputs: { sigmas: '' },
    defaultMeta: { title: 'Manual Sigmas' },
  },
  {
    classType: 'LTX2SamplingPreviewOverride', category: 'sampling', outputCount: 0,
    defaultInputs: { latent: '', noise_mask: '' },
    defaultMeta: { title: 'LTX2 Sampling Preview' },
  },

  // ── VAE / Encoder-Decoder ──
  {
    classType: 'VAEDecode', category: 'output', outputCount: 1,
    defaultInputs: { samples: '', vae: '' },
    defaultMeta: { title: 'VAE Decode' },
    searchAliases: ['decode', 'vae'],
  },
  {
    classType: 'VAEEncode', category: 'output', outputCount: 1,
    defaultInputs: { pixels: '', vae: '' },
    defaultMeta: { title: 'VAE Encode' },
  },
  {
    classType: 'VAEEncodeForInpaint', category: 'output', outputCount: 1,
    defaultInputs: { pixels: '', vae: '', mask: '', grow_mask_by: 6 },
    defaultMeta: { title: 'VAE Encode For Inpaint' },
  },
  {
    classType: 'VAEDecodeTiled', category: 'output', outputCount: 1,
    defaultInputs: { samples: '', vae: '', tile_size: 512 },
    defaultMeta: { title: 'VAE Decode Tiled' },
  },
  {
    classType: 'LTXVAudioVAEDecode', category: 'output', outputCount: 1,
    defaultInputs: { samples: '', vae: '' },
    defaultMeta: { title: 'LTX Audio VAE Decode' },
  },
  {
    classType: 'LTXVLatentUpsampler', category: 'output', outputCount: 1,
    defaultInputs: { latent: '', width: 1024, height: 576 },
    defaultMeta: { title: 'LTXV Latent Upsampler' },
  },
  {
    classType: 'ImageUpscaleWithModel', category: 'output', outputCount: 1,
    defaultInputs: { upscale_model: '', image: '' },
    defaultMeta: { title: 'Image Upscale With Model' },
  },

  // ── Sinks / Output ──
  {
    classType: 'SaveImage', category: 'output', outputCount: 0,
    defaultInputs: { images: '', filename_prefix: 'ComfyUI' },
    defaultMeta: { title: 'Save Image' },
    searchAliases: ['save', 'output'],
  },
  {
    classType: 'PreviewImage', category: 'output', outputCount: 0,
    defaultInputs: { images: '' },
    defaultMeta: { title: 'Preview Image' },
  },
  {
    classType: 'VHS_VideoCombine', category: 'output', outputCount: 0,
    defaultInputs: { images: '', frame_rate: 24, format: 'video/h264-mp4', filename_prefix: 'ComfyUI' },
    defaultMeta: { title: 'VHS Video Combine' },
    searchAliases: ['video', 'combine', 'output'],
  },
  {
    classType: 'SaveVideo', category: 'output', outputCount: 0,
    defaultInputs: { video: '', filename_prefix: 'ComfyUI' },
    defaultMeta: { title: 'Save Video' },
  },
  {
    classType: 'CreateVideo', category: 'output', outputCount: 0,
    defaultInputs: { images: '', fps: 24 },
    defaultMeta: { title: 'Create Video' },
  },

  // ── Primitives ──
  {
    classType: 'PrimitiveInt', category: 'primitives', outputCount: 1,
    defaultInputs: { value: 0 },
    defaultMeta: { title: 'Int' },
    searchAliases: ['integer', 'number'],
  },
  {
    classType: 'PrimitiveFloat', category: 'primitives', outputCount: 1,
    defaultInputs: { value: 0.0 },
    defaultMeta: { title: 'Float' },
    searchAliases: ['decimal'],
  },
  {
    classType: 'PrimitiveStringMultiline', category: 'primitives', outputCount: 1,
    defaultInputs: { value: '' },
    defaultMeta: { title: 'String (Multiline)' },
    searchAliases: ['text', 'string', 'prompt'],
  },
  {
    classType: 'ComfyMathExpression', category: 'primitives', outputCount: 1,
    defaultInputs: { expression: 'a + b', a: 0, b: 0 },
    defaultMeta: { title: 'Math Expression' },
  },

  // ── Other ──
  {
    classType: 'ADE_AnimateDiffLoaderWithContext', category: 'other', outputCount: 1,
    defaultInputs: { model_name: '', context_options: '' },
    defaultMeta: { title: 'AnimateDiff Loader' },
  },
  {
    classType: 'PathchSageAttentionKJ', category: 'other', outputCount: 1,
    defaultInputs: { model: '' },
    defaultMeta: { title: 'Patch Sage Attention' },
  },
]

export const LIBRARY_CATEGORIES = ['loaders', 'conditioning', 'latent', 'sampling', 'output', 'primitives', 'other'] as const
export type LibraryCategory = (typeof LIBRARY_CATEGORIES)[number]

export function filterNodeLibrary(query: string, category: LibraryCategory | 'all'): NodeLibraryEntry[] {
  const q = query.trim().toLowerCase()
  let results = NODE_LIBRARY
  if (category !== 'all') results = results.filter((e) => e.category === category)
  if (!q) return results
  return results.filter((e) => {
    const searchText = [e.classType, e.defaultMeta?.title ?? '', ...(e.searchAliases ?? [])]
      .join(' ').toLowerCase()
    return searchText.includes(q)
  })
}
