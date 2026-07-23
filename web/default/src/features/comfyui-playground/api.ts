import { api } from '@/lib/api'

import type { ComfyuiChatResponse } from './types'

const COMPYUI_PG_ENDPOINT = '/pg/chat/completions'

export async function generateComfyuiVideo(
  prompt: string,
  params?: {
    width?: number
    height?: number
    frames?: number
    steps?: number
  }
): Promise<ComfyuiChatResponse> {
  const body = {
    model: 'comfyui-sulphur',
    messages: [{ role: 'user', content: prompt }],
    ...(params?.width && { width: params.width }),
    ...(params?.height && { height: params.height }),
    ...(params?.frames && { frames: params.frames }),
    ...(params?.steps && { steps: params.steps }),
  }

  const res = await api.post(COMPYUI_PG_ENDPOINT, body, {
    headers: {
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Skill-Activate': 'comfyui',
      'X-Baizor-Hermes-Workspace': 'user_workspace',
    },
    skipBusinessError: true,
  })

  return res.data
}

const PROMPT_ENGINEER_SYSTEM = `You are an expert prompt engineer for AI video generation. Transform the user's short description into a detailed, vivid English prompt optimized for text-to-video models.

Guidelines:
- Write in English only
- Describe the scene with concrete visual details: subjects, setting, colors, textures
- Include lighting direction and quality (e.g. "golden hour backlight")
- Describe camera framing and movement (e.g. "medium close-up, slow dolly in")
- Specify the motion and action happening in the scene
- Add atmospheric elements (e.g. "dust motes floating in sunbeams")
- Keep it concise (2-4 sentences)

Output ONLY the prompt, no introduction or explanation.`

export async function enhancePrompt(userPrompt: string): Promise<string> {
  const body = {
    model: 'gpt-4o-mini',
    messages: [
      { role: 'system', content: PROMPT_ENGINEER_SYSTEM },
      { role: 'user', content: userPrompt },
    ],
  }

  const res = await api.post(COMPYUI_PG_ENDPOINT, body, {
    headers: {
      'X-Baizor-Playground': 'hermes',
      'X-Baizor-Hermes-Workspace': 'user_workspace',
    },
    skipBusinessError: true,
  })

  return res.data?.choices?.[0]?.message?.content ?? ''
}
