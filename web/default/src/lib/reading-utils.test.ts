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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  countWordsAndChars,
  estimateReadingTime,
  extractMarkdownHeadings,
} from './reading-utils.ts'

describe('extractMarkdownHeadings', () => {
  test('extracts headings with slugs', () => {
    const text = '# Hello World\n## Second Heading\n### Third'
    const headings = extractMarkdownHeadings(text)
    assert.equal(headings.length, 3)
    assert.deepEqual(headings[0], { id: 'hello-world', level: 1, text: 'Hello World' })
    assert.deepEqual(headings[1], { id: 'second-heading', level: 2, text: 'Second Heading' })
    assert.deepEqual(headings[2], { id: 'third', level: 3, text: 'Third' })
  })

  test('deduplicates heading ids', () => {
    const text = '# Duplicate\n# Duplicate'
    const headings = extractMarkdownHeadings(text)
    assert.equal(headings.length, 2)
    assert.equal(headings[0].id, 'duplicate')
    assert.equal(headings[1].id, 'duplicate-2')
  })

  test('handles CJK headings', () => {
    const text = '# 你好世界\n## 第二标题'
    const headings = extractMarkdownHeadings(text)
    assert.equal(headings.length, 2)
    assert.equal(headings[0].id, '你好世界')
    assert.equal(headings[0].text, '你好世界')
  })
})

describe('countWordsAndChars', () => {
  test('counts latin words', () => {
    const result = countWordsAndChars('Hello world, this is a test.')
    assert.equal(result.words, 6)
    assert.equal(result.chars, 28)
  })

  test('counts CJK as words', () => {
    const result = countWordsAndChars('你好世界')
    assert.equal(result.words, 4)
    assert.equal(result.chars, 4)
  })
})

describe('estimateReadingTime', () => {
  test('returns at least 1 minute for short text', () => {
    assert.equal(estimateReadingTime('Hello world'), 1)
  })

  test('estimates longer text', () => {
    const words = Array.from({ length: 500 }, () => 'word').join(' ')
    assert.equal(estimateReadingTime(words), 2)
  })
})
