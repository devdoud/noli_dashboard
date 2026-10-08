import { http, HttpResponse } from 'msw'
import { z } from 'zod'
import { apiRequest, registerSessionHooks } from '@/shared/api/client'
import { ApiError } from '@/shared/api/errors'
import { getSlowRequestCount } from '@/shared/api/slowRequests'
import { server } from '@/test/server'

const API = 'http://api.test'
const itemSchema = z.object({ data: z.object({ id: z.string() }) })

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('La promesse aurait dû échouer')
}

afterEach(() => {
  registerSessionHooks(undefined)
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('apiRequest sans session', () => {
  it('construit l’URL, envoie le JSON et vérifie la réponse', async () => {
    const seen: { url?: string; body?: unknown; contentType?: string | null } = {}
    server.use(
      http.post(`${API}/series`, async ({ request }) => {
        seen.url = request.url
        seen.body = await request.json()
        seen.contentType = request.headers.get('content-type')
        return HttpResponse.json({ data: { id: 'abc' } })
      }),
    )

    const result = await apiRequest({
      method: 'POST',
      path: '/series',
      query: { page: 2, premium: true, q: undefined },
      body: { title: 'Titre' },
      schema: itemSchema,
      auth: false,
    })

    expect(result).toEqual({ data: { id: 'abc' } })
    expect(seen.url).toBe(`${API}/series?page=2&premium=true`)
    expect(seen.body).toEqual({ title: 'Titre' })
    expect(seen.contentType).toBe('application/json')
  })

  it('lève invalid-response sans écrire les données reçues dans la console', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    server.use(
      http.get(`${API}/me`, () => HttpResponse.json({ data: { id: 42, token: 'secret' } })),
    )

    const error = await captureError(
      apiRequest({ method: 'GET', path: '/me', schema: itemSchema, auth: false }),
    )

    expect(error).toMatchObject({
      kind: 'invalid-response',
      issues: [{ path: 'data.id', code: 'invalid_type' }],
    })
    expect(JSON.stringify(consoleError.mock.calls)).not.toContain('secret')
  })

  it('convertit une erreur NestJS en ApiError http', async () => {
    server.use(
      http.delete(`${API}/categories/1`, () =>
        HttpResponse.json(
          { statusCode: 409, code: 'CATEGORY_IN_USE', seriesCount: 2, message: 'Category in use' },
          { status: 409 },
        ),
      ),
    )

    const error = await captureError(
      apiRequest({ method: 'DELETE', path: '/categories/1', schema: z.unknown(), auth: false }),
    )

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      kind: 'http',
      status: 409,
      code: 'CATEGORY_IN_USE',
      backendMessage: 'Category in use',
    })
  })

  it('accepte une page HTML d’erreur sans planter', async () => {
    server.use(
      http.get(
        `${API}/series`,
        () => new HttpResponse('<html>Service Unavailable</html>', { status: 503 }),
      ),
    )

    const error = await captureError(
      apiRequest({ method: 'GET', path: '/series', schema: z.unknown(), auth: false }),
    )

    expect(error).toMatchObject({ kind: 'http', status: 503, code: undefined })
  })

  it('lève network quand le serveur est injoignable', async () => {
    server.use(http.get(`${API}/series`, () => HttpResponse.error()))

    const error = await captureError(
      apiRequest({ method: 'GET', path: '/series', schema: z.unknown(), auth: false }),
    )

    expect(error).toMatchObject({ kind: 'network' })
  })

  it('envoie un FormData sans fixer Content-Type à la main', async () => {
    const seen: { contentType?: string | null } = {}
    server.use(
      http.put(`${API}/series/1/cover`, ({ request }) => {
        seen.contentType = request.headers.get('content-type')
        return HttpResponse.json({ ok: true })
      }),
    )
    const form = new FormData()
    form.append('file', new Blob(['x'], { type: 'image/png' }), 'cover.png')

    await apiRequest({
      method: 'PUT',
      path: '/series/1/cover',
      body: form,
      schema: z.unknown(),
      auth: false,
    })

    expect(seen.contentType).toMatch(/^multipart\/form-data; boundary=/)
  })

  it('accepte un corps vide si le schéma l’accepte', async () => {
    server.use(http.delete(`${API}/series/1`, () => new HttpResponse(null, { status: 204 })))

    await expect(
      apiRequest({ method: 'DELETE', path: '/series/1', schema: z.undefined(), auth: false }),
    ).resolves.toBeUndefined()
  })

  it('relance tel quel un abandon demandé par l’appelant', async () => {
    server.use(http.get(`${API}/series`, () => new Promise<never>(() => undefined)))
    const controller = new AbortController()

    const promise = apiRequest({
      method: 'GET',
      path: '/series',
      schema: z.unknown(),
      auth: false,
      signal: controller.signal,
    })
    controller.abort()

    await expect(promise).rejects.toMatchObject({ name: 'AbortError' })
  })
})

describe('apiRequest : délais et lenteur', () => {
  it('compte l’appel comme lent après 5 s puis abandonne à 70 s', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    server.use(http.get(`${API}/series`, () => new Promise<never>(() => undefined)))

    const promise = apiRequest({ method: 'GET', path: '/series', schema: z.unknown(), auth: false })
    const settled = captureError(promise)

    await vi.advanceTimersByTimeAsync(4_999)
    expect(getSlowRequestCount()).toBe(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(getSlowRequestCount()).toBe(1)
    await vi.advanceTimersByTimeAsync(65_000)

    expect(await settled).toMatchObject({ kind: 'timeout' })
    expect(getSlowRequestCount()).toBe(0)
  })

  it('laisse 120 s à un envoi de fichier', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    server.use(http.put(`${API}/series/1/cover`, () => new Promise<never>(() => undefined)))
    const form = new FormData()
    form.append('file', new Blob(['x']), 'a.png')

    const settled = captureError(
      apiRequest({
        method: 'PUT',
        path: '/series/1/cover',
        body: form,
        schema: z.unknown(),
        auth: false,
      }),
    )
    await vi.advanceTimersByTimeAsync(70_000)
    let done = false
    void settled.then(() => {
      done = true
    })
    await vi.advanceTimersByTimeAsync(0)
    expect(done).toBe(false)
    await vi.advanceTimersByTimeAsync(50_000)

    expect(await settled).toMatchObject({ kind: 'timeout' })
  })
})
