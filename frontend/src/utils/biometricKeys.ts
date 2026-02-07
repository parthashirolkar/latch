import {
  setData,
  getData,
  hasData,
  removeData,
} from '@choochmeque/tauri-plugin-biometry-api'

const KEYCHAIN_DOMAIN = 'com.latch.vault'
const KEYCHAIN_NAME = 'vault-encryption-key'

export async function generateAndStoreKey(): Promise<string> {
  const keyBytes = crypto.getRandomValues(new Uint8Array(32))
  const keyHex = Array.from(keyBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  await setData({ domain: KEYCHAIN_DOMAIN, name: KEYCHAIN_NAME, data: keyHex })
  return keyHex
}

export async function retrieveKey(): Promise<string> {
  const result = await getData({
    domain: KEYCHAIN_DOMAIN,
    name: KEYCHAIN_NAME,
    reason: 'Unlock Latch'
  })
  return result.data
}

export async function hasStoredKey(): Promise<boolean> {
  return await hasData({ domain: KEYCHAIN_DOMAIN, name: KEYCHAIN_NAME })
}

export async function clearStoredKey(): Promise<void> {
  await removeData({ domain: KEYCHAIN_DOMAIN, name: KEYCHAIN_NAME })
}
