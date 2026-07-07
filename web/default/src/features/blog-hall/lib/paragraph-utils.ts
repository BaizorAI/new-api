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
