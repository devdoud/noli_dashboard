import { parseEnv } from '@/shared/config/env'

describe('parseEnv', () => {
  it('accepte une adresse https et retire la barre finale', () => {
    expect(parseEnv({ VITE_API_BASE_URL: 'https://api.example.com/' })).toEqual({
      ok: true,
      env: { apiBaseUrl: 'https://api.example.com' },
    })
  })

  it('signale une variable absente', () => {
    const result = parseEnv({})
    expect(result).toMatchObject({ ok: false, variable: 'VITE_API_BASE_URL' })
  })

  it('refuse une adresse qui n’est pas http(s)', () => {
    expect(parseEnv({ VITE_API_BASE_URL: 'ftp://api.example.com' }).ok).toBe(false)
    expect(parseEnv({ VITE_API_BASE_URL: 'pas une url' }).ok).toBe(false)
  })
})
