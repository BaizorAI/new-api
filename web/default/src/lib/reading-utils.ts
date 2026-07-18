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
export interface MarkdownHeading {
  id: string
  level: number
  text: string
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '')
    .replace(/^-+|-+$/g, '')
}

export function extractMarkdownHeadings(text: string): MarkdownHeading[] {
  const headings: MarkdownHeading[] = []
  const seen = new Map<string, number>()

  const matches = text.matchAll(/^(#{1,6})\s+(.+)$/gm)
  for (const match of matches) {
    const level = match[1].length
    const rawText = match[2].trim().replace(/#+\s*$/, '').trim()
    if (!rawText) continue

    let baseId = slugify(rawText)
    if (!baseId) {
      baseId = `heading-${headings.length + 1}`
    }

    const count = (seen.get(baseId) ?? 0) + 1
    seen.set(baseId, count)
    const id = count > 1 ? `${baseId}-${count}` : baseId

    headings.push({ id, level, text: rawText })
  }

  return headings
}

export function countWordsAndChars(text: string): {
  words: number
  chars: number
} {
  const trimmed = text.trim()
  if (!trimmed) {
    return { words: 0, chars: 0 }
  }

  const cjk = (trimmed.match(/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/g) || []).length
  const latinWords = (trimmed.match(/[a-zA-Z0-9]+/g) || []).length
  return {
    words: cjk + latinWords,
    chars: trimmed.length,
  }
}

export function estimateReadingTime(text: string): number {
  const trimmed = text.trim()
  if (!trimmed) return 0

  const { words } = countWordsAndChars(trimmed)
  // CJK characters are already counted as "words" for reading-time purposes.
  const minutes = words / 250
  return Math.max(1, Math.round(minutes))
}
