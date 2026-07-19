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
import { Marked } from 'marked'

const marked = new Marked({ async: false, gfm: true })

/**
 * Split markdown content into top-level blocks using the marked lexer.
 * Each block corresponds to a paragraph, heading, list, code block, table,
 * blockquote, or other top-level markdown element.
 */
export function splitMarkdownIntoParagraphs(content: string): string[] {
  if (!content.trim()) return []

  const tokens = marked.lexer(content)
  const blocks: string[] = []

  for (const token of tokens) {
    if (token.type === 'space') continue
    blocks.push(token.raw)
  }

  return blocks
}

/**
 * Replace a specific paragraph block in the markdown content.
 * Reconstructs the full markdown string with the target paragraph replaced.
 */
export function replaceParagraph(
  content: string,
  paragraphIndex: number,
  newText: string
): string {
  const blocks = splitMarkdownIntoParagraphs(content)
  if (paragraphIndex < 0 || paragraphIndex >= blocks.length) return content

  blocks[paragraphIndex] = newText.endsWith('\n') ? newText : newText + '\n'
  return blocks.join('\n')
}

// ============================================================================
// Content extraction — parse AI responses for actionable artifacts
// ============================================================================

/** Extracted article content from an AI response. */
export interface ArticleArtifact {
  /** Full article body in markdown (from ```markdown or ```article block). */
  fullArticle: string | null
  /** Extracted title suggestion (first H1 or plain-text line matching 标题: ). */
  title: string | null
  /** Extracted summary (text following 摘要: or a leading italic paragraph). */
  summary: string | null
  /** Extracted tags as comma-separated string. */
  tags: string | null
}

/** Extracted paragraph revision from an AI response. */
export interface ParagraphArtifact {
  /** Revised paragraph text from ```revised-paragraph block. */
  revised: string | null
}

/** Extracted image prompt from an AI response. */
export interface ImageArtifact {
  /** Image generation prompt from ```image-prompt block. */
  prompt: string | null
}

/** Describes what kind of AI response this is, for rendering action buttons. */
export type ChatActionType =
  | 'revised-paragraph'   // AI returned a revised paragraph → "Apply to paragraph N"
  | 'full-article'        // AI generated/rewrote the full article → "Apply full article"
  | 'title'               // AI suggested a title → "Use as title"
  | 'summary'             // AI wrote a summary → "Use as summary"
  | 'tags'                // AI suggested tags → "Set tags"
  | 'image-prompt'        // AI generated an image prompt → "Generate image"
  | 'analysis-pass'       // Analysis passed (✅) → "Complete"
  | 'analysis-suggest'    // Analysis has suggestions (⚠️) → "Rewrite with suggestions"

/**
 * Extract a revised paragraph from an AI response.
 * Looks for a fenced code block with the language `revised-paragraph`.
 */
export function extractRevisedParagraph(response: string): string | null {
  const match = response.match(
    /```revised-paragraph\s*\n([\s\S]*?)```/
  )
  return match ? match[1].trim() : null
}

/**
 * Extract a full article body from an AI response.
 * Searches for code blocks: ```markdown, ```article, or ```blog.
 */
export function extractFullArticle(content: string): string | null {
  for (const lang of ['markdown', 'article', 'blog']) {
    const match = content.match(
      new RegExp(`\`\`\`${lang}\\s*\\n([\\s\\S]*?)\`\`\``)
    )
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return null
}

/**
 * Extract title suggestion from AI response text.
 * Looks for: H1 heading (# Title), bold title (**Title**), or 标题: label.
 */
export function extractTitle(content: string): string | null {
  // titles block — AI generates multiple candidates, take the first one
  const titlesMatch = content.match(/```titles\s*\n([\s\S]*?)```/)
  if (titlesMatch?.[1]?.trim()) {
    const lines = titlesMatch[1].trim().split(/\n/).filter(Boolean)
    if (lines.length > 0) return lines[0].trim().replace(/^[\d.]+\s*/, '')
  }

  // # Title style heading
  const h1Match = content.match(/^#\s+(.+?)(?:\n|$)/m)
  if (h1Match?.[1]?.trim()) return h1Match[1].trim().replace(/\*\*/g, '')

  // **Title** on its own line
  const boldMatch = content.match(/^\*\*(.+?)\*\*\s*$/m)
  if (boldMatch?.[1]?.trim()) return boldMatch[1].trim()

  // 标题：/ 标题: style
  const labelMatch = content.match(/(?:标题|Title)[：:]\s*(.+?)(?:\n|$)/im)
  if (labelMatch?.[1]?.trim()) return labelMatch[1].trim().replace(/[\*\"]/g, '')

  return null
}

/**
 * Extract summary from AI response text.
 * Looks for 摘要: / Summary: label or a leading italic paragraph.
 */
export function extractSummary(content: string): string | null {
  // ```summary block — AI-generated summary
  const summaryMatch = content.match(/```summary\s*\n([\s\S]*?)```/)
  if (summaryMatch?.[1]?.trim()) return summaryMatch[1].trim()

  const labelMatch = content.match(/(?:摘要|Summary)[：:]\s*(.+?)(?:\n|$)/im)
  if (labelMatch?.[1]?.trim()) return labelMatch[1].trim()

  return null
}

/**
 * Extract tags from AI response.
 * Looks for 标签: / Tags: label followed by comma-separated or #tag style list.
 */
export function extractTags(content: string): string | null {
  const labelMatch = content.match(/(?:标签|Tags)[：:]\s*(.+?)(?:\n|$)/im)
  if (labelMatch?.[1]?.trim()) {
    // Clean up — remove # prefix and extra spaces
    return labelMatch[1]
      .trim()
      .split(/[,，、\s]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean)
      .join(', ')
  }
  return null
}

/**
 * Extract an image generation prompt from AI response.
 * Looks for ```image-prompt or ```image blocks.
 */
export function extractImagePrompt(content: string): string | null {
  for (const lang of ['image-prompt', 'image']) {
    const match = content.match(
      new RegExp(`\`\`\`${lang}\\s*\\n([\\s\\S]*?)\`\`\``)
    )
    if (match?.[1]?.trim()) return match[1].trim()
  }
  return null
}

/**
 * Extract continued text from an AI response.
 * Looks for a fenced code block with the language `continue`.
 */
export function extractContinue(content: string): string | null {
  const match = content.match(/```continue\s*\n([\s\S]*?)```/)
  return match ? match[1].trim() : null
}

/**
 * Detect analysis result markers in AI response.
 * Returns the analysis type: 'pass' (✅), 'suggest' (⚠️), or null.
 */
export function detectAnalysis(content: string): 'pass' | 'suggest' | null {
  // Don't treat normal chat as analysis
  if (extractRevisedParagraph(content) || extractFullArticle(content)) return null
  if (/✅/.test(content)) return 'pass'
  if (/⚠️/.test(content)) return 'suggest'
  return null
}

/**
 * Build a sorted list of available action types for an AI response,
 * so the chat bubble knows which buttons to show.
 */
export function getChatActions(content: string): ChatActionType[] {
  const actions: ChatActionType[] = []

  if (extractRevisedParagraph(content)) {
    actions.push('revised-paragraph')
  }
  if (extractFullArticle(content)) {
    actions.push('full-article')
  }
  if (extractTitle(content)) {
    actions.push('title')
  }
  if (extractSummary(content)) {
    actions.push('summary')
  }
  if (extractTags(content)) {
    actions.push('tags')
  }
  if (extractImagePrompt(content)) {
    actions.push('image-prompt')
  }

  const analysis = detectAnalysis(content)
  if (analysis === 'pass') {
    actions.push('analysis-pass')
  } else if (analysis === 'suggest') {
    actions.push('analysis-suggest')
  }

  // If nothing specific detected but the message is substantial,
  // treat it as a full article (AI likely wrote the whole thing)
  if (actions.length === 0 && content.trim().length > 80) {
    actions.push('full-article')
  }

  return actions
}

/**
 * Insert an image at a specific position in markdown content.
 * If paragraphIndex is provided, insert after that paragraph block.
 * Otherwise append at the end.
 */
export function insertImageIntoContent(
  content: string,
  imageUrl: string,
  altText: string,
  paragraphIndex?: number | null
): string {
  const imgMd = `\n\n![${altText}](${imageUrl})\n\n`
  if (paragraphIndex != null) {
    const blocks = splitMarkdownIntoParagraphs(content)
    if (paragraphIndex >= 0 && paragraphIndex < blocks.length) {
      blocks[paragraphIndex] = blocks[paragraphIndex].trimEnd() + imgMd
      return blocks.join('\n')
    }
  }
  return (content.trimEnd() + imgMd)
}
