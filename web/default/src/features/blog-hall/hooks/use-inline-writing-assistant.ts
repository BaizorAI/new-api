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
import { useCallback, useRef } from 'react'

import { useStreamRequest } from '@/features/playground/hooks/use-stream-request'
import { getOrCreatePlaygroundSessionId } from '@/features/playground/lib/storage'
import type {
  ChatCompletionRequest,
  ChatCompletionMessage,
} from '@/features/playground/types'
import { useAuthStore } from '@/stores/auth-store'

export type InlineWritingAction =
  | 'polish'
  | 'expand'
  | 'shorten'
  | 'rewrite'
  | 'continue'
  | 'generate_title'
  | 'generate_summary'
  | 'image_prompt'

interface InlineAssistantContext {
  articleId?: number
  title: string
  summary: string
  content: string
  selectedText?: string
}

interface RunInlineActionOptions {
  action: InlineWritingAction
  context: InlineAssistantContext
  userPrompt?: string
  onDelta: (chunk: string) => void
  onComplete: (finalContent: string) => void
  onError?: (error: string) => void
}

const MODEL = 'huayu-v2'

function truncateContent(content: string, maxLength = 4000): string {
  return content.length > maxLength
    ? content.slice(0, maxLength) + '\n\n[...truncated]'
    : content
}

function truncateTail(content: string, maxLength = 4000): string {
  return content.length > maxLength
    ? '[...truncated]\n\n' + content.slice(-maxLength)
    : content
}

function buildModificationSystemPrompt(
  action: 'polish' | 'expand' | 'shorten' | 'rewrite',
  context: InlineAssistantContext
): string {
  const { title, content, selectedText } = context
  const actionLabel: Record<string, string> = {
    polish: '润色',
    expand: '扩写',
    shorten: '精简',
    rewrite: '改写',
  }

  const parts: string[] = [
    '你是一个专业的写作编辑助手，使用 MagicalBrush 技能。',
    '',
    '以下是当前文章的上下文：',
  ]

  if (title) parts.push(`标题：${title}`)
  parts.push('', '## 当前文章内容：', '', truncateContent(content))

  if (selectedText) {
    parts.push(
      '',
      `## 用户选中的文本进行【${actionLabel[action]}】操作：`,
      '',
      selectedText,
      '',
      '请只输出修改后的文本，用 ```revised-paragraph 代码块包裹修改内容。保持原有的格式和风格，只输出修改后的内容。'
    )
  } else {
    parts.push(
      '',
      `## 用户要求对整篇文章进行【${actionLabel[action]}】操作。`,
      '',
      '请输出修改后的完整文章（Markdown 格式），用 ```markdown 代码块包裹。'
    )
  }

  return parts.join('\n')
}

function buildContinueSystemPrompt(context: InlineAssistantContext): string {
  const { title, summary, content } = context
  const parts: string[] = [
    '你是一个专业的博客写作助手，使用 blog-v1 技能。请根据以下文章内容，续写下一段。',
    '',
    '要求：',
    '- 保持与上文一致的语气、风格和主题',
    '- 自然衔接，不要重复已经写过的内容',
    '- 只输出续写的内容，用 ```continue 代码块包裹',
  ]

  if (title) parts.push('', `标题：${title}`)
  if (summary) parts.push(`摘要：${summary}`)
  parts.push('', '## 当前文章末尾：', '', truncateTail(content))

  return parts.join('\n')
}

function buildTitleSystemPrompt(context: InlineAssistantContext): string {
  const parts: string[] = [
    '你是一个专业的博客写作助手，使用 blog-v1 技能。请根据以下内容，生成 3 个引人注目的文章标题。',
    '',
    '要求：',
    '- 每个标题不超过 20 字',
    '- 直接点明收益或问题',
    '- 有吸引力但不过度夸张',
    '- 用 ```titles 代码块包裹，每行一个标题',
  ]

  const { content } = context
  if (content) {
    parts.push('', '## 文章内容：', '', truncateContent(content))
  }

  return parts.join('\n')
}

function buildSummarySystemPrompt(context: InlineAssistantContext): string {
  const parts: string[] = [
    '你是一个专业的博客写作助手，使用 blog-v1 技能。请根据以下文章内容，生成一段简洁的摘要。',
    '',
    '要求：',
    '- 一句话说清「谁 / 做什么 / 有什么好处」',
    '- 不超过 80 字',
    '- 用 ```summary 代码块包裹摘要',
  ]

  const { title, content } = context
  if (title) parts.push('', `标题：${title}`)
  if (content) parts.push('', '## 文章内容：', '', truncateContent(content))

  return parts.join('\n')
}

function buildImagePromptSystemPrompt(context: InlineAssistantContext): string {
  const { content, selectedText } = context
  const parts: string[] = [
    '你是一个专业的 AI 图像生成提示词专家，使用 blog-v1 技能。',
    '请根据上下文生成一段高质量的英文图像生成 prompt（用于 Stable Diffusion / DALL-E）。',
    '',
    '要求：',
    '- 描述具体的视觉场景、风格、色彩、构图',
    '- 适合博客配图，风格简洁专业',
    '- 不超过 250 字符',
    '- 用 ```image-prompt 代码块包裹 prompt',
  ]

  if (selectedText) {
    parts.push('', '## 选定段落：', '', selectedText)
  } else if (content) {
    parts.push('', '## 文章内容（以此为上下文）：', '', truncateContent(content))
  }

  return parts.join('\n')
}

function buildMessages(
  action: InlineWritingAction,
  context: InlineAssistantContext,
  userPrompt: string
): ChatCompletionMessage[] {
  const messages: ChatCompletionMessage[] = []

  if (
    action === 'polish' ||
    action === 'expand' ||
    action === 'shorten' ||
    action === 'rewrite'
  ) {
    messages.push({
      role: 'system',
      content: buildModificationSystemPrompt(action, context),
    })
  } else if (action === 'continue') {
    messages.push({ role: 'system', content: buildContinueSystemPrompt(context) })
  } else if (action === 'generate_title') {
    messages.push({ role: 'system', content: buildTitleSystemPrompt(context) })
  } else if (action === 'generate_summary') {
    messages.push({ role: 'system', content: buildSummarySystemPrompt(context) })
  } else if (action === 'image_prompt') {
    messages.push({
      role: 'system',
      content: buildImagePromptSystemPrompt(context),
    })
  }

  messages.push({
    role: 'user',
    content: userPrompt || '请执行上述操作。',
  })

  return messages
}

export function useInlineWritingAssistant() {
  const { sendStreamRequest, stopStream, isStreaming } = useStreamRequest()
  const abortRef = useRef<(() => void) | null>(null)

  const runAction = useCallback(
    ({
      action,
      context,
      userPrompt = '',
      onDelta,
      onComplete,
      onError,
    }: RunInlineActionOptions) => {
      if (isStreaming) return

      const userId = useAuthStore.getState().auth.user?.id ?? 'anon'
      const sessionKey = context.articleId
        ? `skill_blog_a${context.articleId}_u${userId}_inline`
        : `skill_blog_new_u${userId}_inline`
      const hermesSessionId = getOrCreatePlaygroundSessionId(sessionKey)

      const requestHeaders: Record<string, string> = {
        'X-Baizor-Playground': 'hermes',
        'X-Baizor-Hermes-Session': hermesSessionId,
        'X-Baizor-Hermes-Workspace': 'skill_blog',
        'X-Baizor-Hermes-Skill-Activate': '/blog-v1',
      }

      const payload: ChatCompletionRequest = {
        model: MODEL,
        messages: buildMessages(action, context, userPrompt),
        stream: true,
      }

      let accumulated = ''
      sendStreamRequest(
        payload,
        requestHeaders,
        (_type, chunk) => {
          accumulated += chunk
          onDelta(chunk)
        },
        () => {
          abortRef.current = null
          onComplete(accumulated)
        },
        (error) => {
          abortRef.current = null
          onError?.(error)
        }
      )
    },
    [isStreaming, sendStreamRequest]
  )

  const stopAction = useCallback(() => {
    stopStream()
    abortRef.current = null
  }, [stopStream])

  return {
    runAction,
    stopAction,
    isStreaming,
  }
}
