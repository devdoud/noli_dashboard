import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { apiRequest } from '@/shared/api/client'
import { server } from '@/test/server'

vi.mock('@/shared/config/env', () => ({
  envResult: { ok: false, variable: 'VITE_API_BASE_URL', reason: 'La variable est absente.' },
}))

describe('apiRequest avec une configuration invalide', () => {
  it('lève une erreur config sans appeler l’API', async () => {
    const calls = { count: 0 }
    server.use(
      http.all('*', () => {
        calls.count += 1
        return HttpResponse.json({})
      }),
    )

    await expect(
      apiRequest({ method: 'GET', path: '/series', schema: z.unknown(), auth: false }),
    ).rejects.toMatchObject({ kind: 'config' })
    expect(calls.count).toBe(0)
  })
})
