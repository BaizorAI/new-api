import { api } from '@/lib/api'

import type {
  AdjustableParam,
  ComfyuiChatResponse,
  ComfyuiI2VStatusResponse,
  ComfyuiI2VSubmitResponse,
  ComfyuiWorkflow,
  QueueStatus,
  WorkflowDetail,
  WorkflowListItem,
  WorkflowListResponse,
} from './types'

const COMPYUI_PG_ENDPOINT = '/pg/chat/completions'
const COMPYUI_I2V_ENDPOINT = '/pg/hermes/comfyui-i2v'

export async function generateComfyuiVideo(
  prompt: string,
  params?: {
    width?: number
    height?: number
    frames?: number
    steps?: number
    cfg?: number
    fps?: number
    seed?: number
    negative_prompt?: string
    workflow?: ComfyuiWorkflow
  }
): Promise<ComfyuiChatResponse> {
  const body: Record<string, unknown> = {
    model: 'comfyui-sulphur',
    messages: [{ role: 'user', content: prompt }],
  }
  if (params?.width) body.width = params.width
  if (params?.height) body.height = params.height
  if (params?.frames) body.frames = params.frames
  if (params?.steps) body.steps = params.steps
  if (params?.cfg) body.cfg = params.cfg
  if (params?.fps) body.fps = params.fps
  if (params?.seed) body.seed = params.seed
  if (params?.negative_prompt) body.negative_prompt = params.negative_prompt
  if (params?.workflow) body.workflow = params.workflow

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

export async function generateComfyuiI2V(
  imageBase64: string,
  prompt: string,
  params?: {
    width?: number
    height?: number
    num_frames?: number
    fps?: number
    seed?: number
    model?: string
  }
): Promise<ComfyuiI2VSubmitResponse> {
  const body: Record<string, unknown> = {
    image: imageBase64,
    prompt,
    model: params?.model ?? 'sulphur-2-fast',
  }
  if (params?.width) body.width = params.width
  if (params?.height) body.height = params.height
  if (params?.num_frames) body.num_frames = params.num_frames
  if (params?.fps) body.fps = params.fps
  if (params?.seed) body.seed = params.seed

  const res = await api.post<ComfyuiI2VSubmitResponse>(COMPYUI_I2V_ENDPOINT, body, {
    skipBusinessError: true,
  })

  return res.data
}

export async function pollI2VStatus(jobId: string): Promise<ComfyuiI2VStatusResponse> {
  const res = await api.get<ComfyuiI2VStatusResponse>(
    `${COMPYUI_I2V_ENDPOINT}/${jobId}`,
    { skipBusinessError: true },
  )
  return res.data
}

export async function fetchWorkflows(): Promise<WorkflowListItem[]> {
  const res = await api.get<WorkflowListResponse>('/pg/hermes/comfyui-workflows')
  return res.data?.workflows ?? []
}

export async function fetchWorkflow(name: string): Promise<WorkflowDetail> {
  const res = await api.get<WorkflowDetail>(`/pg/hermes/comfyui-workflows/${name}`)
  return res.data
}

export async function pollQueueStatus(promptId: string): Promise<QueueStatus> {
  const res = await api.get<QueueStatus>(
    `/pg/hermes/comfyui-queue/${promptId}`,
    { skipBusinessError: true },
  )
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

/**
 * Parse a raw ComfyUI workflow JSON string into a WorkflowDetail.
 * Replicates the backend get_workflow_meta() parsing logic client-side.
 */
export function parseImportedWorkflow(rawJson: string): WorkflowDetail {
  const wf: ComfyuiWorkflow = JSON.parse(rawJson)
  const adjustableParams: AdjustableParam[] = []

  for (const [nodeId, node] of Object.entries(wf)) {
    if (typeof node !== 'object' || node === null) continue
    const classType = (node as Record<string, unknown>).class_type as string ?? ''
    const meta = (node as Record<string, unknown>)._meta as { title?: string } | null
    const title = meta?.title ?? classType
    const inputs = (node as Record<string, unknown>).inputs as Record<string, unknown> ?? {}

    for (const [inputName, inputVal] of Object.entries(inputs)) {
      if (Array.isArray(inputVal)) continue
      const t =
        typeof inputVal === 'boolean'
          ? ('boolean' as const)
          : typeof inputVal === 'number'
            ? ('number' as const)
            : ('string' as const)
      adjustableParams.push({
        node_id: nodeId,
        class_type: classType,
        title,
        field_name: inputName,
        type: t,
        default_value: inputVal,
      })
    }
  }

  return { name: 'Imported', workflow: wf, adjustable_params: adjustableParams }
}
