import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { checkIsActive } from './url-utils'

describe('sidebar active URL matching', () => {
  test('distinguishes profile sections that share the same pathname', () => {
    assert.equal(
      checkIsActive('/profile?section=sidebar', {
        title: 'Profile',
        url: '/profile?section=profile',
      }),
      false
    )
    assert.equal(
      checkIsActive('/profile?section=sidebar', {
        title: 'Sidebar Personal Settings',
        url: '/profile?section=sidebar',
      }),
      true
    )
  })
})
