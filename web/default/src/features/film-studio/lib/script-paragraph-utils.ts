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

export interface Paragraph {
  index: number
  /** Full text of this paragraph */
  text: string
  /** Start offset in the original content */
  startOffset: number
  /** End offset in the original content (exclusive) */
  endOffset: number
}

export interface Sentence {
  text: string
  startOffset: number
  endOffset: number
}

/**
 * Split plain-text script content into paragraphs.
 * A paragraph is separated by one or more blank lines (\n\n+).
 */
export function splitScriptIntoParagraphs(content: string): Paragraph[] {
  if (!content) return []

  // Split by two or more consecutive newlines.
  // We use a regex with a capturing group to preserve the separators
  // so we can compute correct character offsets.
  const paragraphs: Paragraph[] = []
  let pos = 0
  let index = 0

  // Split on \n\n+ while tracking positions
  const parts = content.split(/\n{2,}/)
  for (const part of parts) {
    const startOffset = pos
    const endOffset = pos + part.length
    if (part.trim()) {
      paragraphs.push({
        index: index++,
        text: part.trim(),
        startOffset,
        endOffset,
      })
    }
    // Move position: part length + separator length
    // The separator is the original newlines between this part and the next
    const nextStart = endOffset
    // Find the actual separator length by looking at original content
    const remaining = content.slice(nextStart)
    const sepMatch = remaining.match(/^(\n{2,})/)
    pos = nextStart + (sepMatch ? sepMatch[1].length : 0)
  }

  return paragraphs
}

/**
 * Find the paragraph that contains the given cursor position.
 */
export function getParagraphAtCursor(
  content: string,
  cursorPos: number
): Paragraph | null {
  const paragraphs = splitScriptIntoParagraphs(content)
  for (const p of paragraphs) {
    if (cursorPos >= p.startOffset && cursorPos <= p.endOffset) {
      return p
    }
  }
  return null
}

/**
 * Find the sentence at the given cursor position.
 * Sentences are delimited by . ! ? 。！？
 */
export function getSentenceAtCursor(
  content: string,
  cursorPos: number
): Sentence | null {
  if (!content || cursorPos < 0 || cursorPos >= content.length) return null

  // Find sentence start: look backwards for a sentence delimiter or start of content
  let start = cursorPos
  while (start > 0) {
    const prev = content[start - 1]
    if (/[.!?。！？]\s*/.test(prev) && start < cursorPos) {
      // Found a delimiter with content after it — the sentence starts after this delimiter
      break
    }
    if (prev === '\n' && content.slice(Math.max(0, start - 2), start) === '\n\n') {
      // Paragraph boundary
      break
    }
    start--
  }

  // Skip past the delimiter and whitespace
  while (start < cursorPos && /[.!?。！？\s]/.test(content[start]) && start < content.length) {
    start++
  }

  // Find sentence end: look forward for a sentence delimiter or end of content
  let end = cursorPos
  while (end < content.length) {
    if (/[.!?。！？]/.test(content[end])) {
      end++ // include the delimiter
      break
    }
    if (content[end] === '\n' && content.slice(end, end + 2) === '\n\n') {
      // Paragraph boundary
      break
    }
    end++
  }

  const text = content.slice(start, end).trim()
  if (!text) return null

  return { text, startOffset: start, endOffset: end }
}
