import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { DEFAULT_AUTH_REDIRECT, normalizeLocalRedirect } from './redirect'

describe('auth redirect normalization', () => {
  test('keeps local redirect paths with query strings', () => {
    assert.equal(
      normalizeLocalRedirect('/team-workspace?team_id=3&panel=results'),
      '/team-workspace?team_id=3&panel=results'
    )
  })

  test('keeps local redirect paths with hash fragments', () => {
    assert.equal(
      normalizeLocalRedirect('/team-workspace?team_id=3#results'),
      '/team-workspace?team_id=3#results'
    )
  })

  test('rejects external redirect targets', () => {
    assert.equal(
      normalizeLocalRedirect('https://example.com/team-workspace'),
      DEFAULT_AUTH_REDIRECT
    )
  })

  test('rejects auth pages to avoid redirect loops', () => {
    assert.equal(
      normalizeLocalRedirect('/sign-in?redirect=%2Fteam-workspace'),
      DEFAULT_AUTH_REDIRECT
    )
  })
})
