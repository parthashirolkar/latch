import { beforeEach, describe, expect, test, vi } from 'vitest'
import { api } from '../api/client'
import { CredentialPreviewSchema, CredentialSchema } from '../api/types'

const invokeMock = vi.hoisted(() => vi.fn())

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}))

describe('credential schemas', () => {
  test('accept null optional URL fields from Rust Option values', () => {
    expect(() =>
      CredentialSchema.parse({
        id: 'entry-1',
        title: 'Example',
        username: 'user',
        password: 'secret',
        url: null,
        icon_url: null,
      })
    ).not.toThrow()

    expect(() =>
      CredentialPreviewSchema.parse({
        id: 'entry-1',
        title: 'Example',
        username: 'user',
        url: null,
        icon_url: null,
      })
    ).not.toThrow()
  })
})

describe('api client response parsing', () => {
  beforeEach(() => {
    invokeMock.mockReset()
  })

  test('addEntry returns the new id without double-parsing the response', async () => {
    invokeMock.mockResolvedValue(JSON.stringify({ status: 'success', id: 'entry-1' }))

    await expect(
      api.addEntry({ title: 'Example', username: 'user', password: 'secret' })
    ).resolves.toBe('entry-1')
  })

  test('searchEntries unwraps the success envelope', async () => {
    invokeMock.mockResolvedValue(
      JSON.stringify({
        status: 'success',
        entries: [
          {
            id: 'entry-1',
            title: 'Example',
            username: 'user',
            url: null,
            icon_url: null,
          },
        ],
      })
    )

    await expect(api.searchEntries('exa')).resolves.toEqual([
      {
        id: 'entry-1',
        title: 'Example',
        username: 'user',
        url: null,
        icon_url: null,
      },
    ])
  })

  test('getFullEntry unwraps the success envelope', async () => {
    invokeMock.mockResolvedValue(
      JSON.stringify({
        status: 'success',
        entry: {
          id: 'entry-1',
          title: 'Example',
          username: 'user',
          password: 'secret',
          url: null,
          icon_url: null,
        },
      })
    )

    await expect(api.getFullEntry('entry-1')).resolves.toMatchObject({
      id: 'entry-1',
      password: 'secret',
      url: null,
      icon_url: null,
    })
  })

  test('vaultStatus validates and unwraps the success envelope', async () => {
    invokeMock.mockResolvedValue(
      JSON.stringify({ status: 'success', has_vault: true, is_unlocked: false })
    )

    await expect(api.vaultStatus()).resolves.toEqual({
      has_vault: true,
      is_unlocked: false,
    })
  })
})
