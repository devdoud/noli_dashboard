import { QueryClient } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import { delay, http, HttpResponse } from 'msw'
import { z } from 'zod'
import { apiRequest } from '@/shared/api/client'
import { isApiError } from '@/shared/api/errors'
import {
  endSession,
  login,
  logout,
  refreshAccessToken,
  registerQueryClient,
  resetSessionForTests,
  restoreSession,
} from '@/shared/session/session'
import { getAccessToken, getSessionState, REFRESH_TOKEN_KEY } from '@/shared/session/store'
import { TAB_CHANNEL_NAME, type TabMessage } from '@/shared/session/tabs'
import { useSession } from '@/shared/session/useSession'
import { server } from '@/test/server'

const API = 'http://api.test'
const okSchema = z.object({ ok: z.literal(true) })

const adminUser = { id: 'u1', email: 'admin@noli.test', username: 'admin', role: 'admin' }

function loginHandler(role = 'admin') {
  return http.post(`${API}/auth/login`, () =>
    HttpResponse.json({
      message: 'Login successful',
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { ...adminUser, role },
    }),
  )
}

function profileHandler(role = 'admin') {
  return http.get(`${API}/auth/profile`, () =>
    HttpResponse.json({ message: 'Profile retrieved', user: { ...adminUser, _id: 'u1', role } }),
  )
}

/** Route protégée : accepte seulement `Bearer <validToken>`. */
function protectedHandler(path: string, validToken: string) {
  return http.get(`${API}${path}`, ({ request }) =>
    request.headers.get('authorization') === `Bearer ${validToken}`
      ? HttpResponse.json({ ok: true })
      : HttpResponse.json({ statusCode: 401, message: 'Unauthorized' }, { status: 401 }),
  )
}

const getOk = (path: string) => apiRequest({ method: 'GET', path, schema: okSchema })

async function captureError(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise
  } catch (error) {
    return error
  }
  throw new Error('La promesse aurait dû échouer')
}

const otherTabs: BroadcastChannel[] = []

function openOtherTab(onMessage?: (message: TabMessage, tab: BroadcastChannel) => void) {
  const tab = new BroadcastChannel(TAB_CHANNEL_NAME)
  const received: TabMessage[] = []
  tab.onmessage = (event: MessageEvent<TabMessage>) => {
    received.push(event.data)
    onMessage?.(event.data, tab)
  }
  otherTabs.push(tab)
  return { tab, received }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 20))

beforeEach(() => {
  window.sessionStorage.clear()
  resetSessionForTests()
})

afterEach(() => {
  otherTabs.splice(0).forEach((tab) => {
    tab.close()
  })
  resetSessionForTests()
})

describe('login', () => {
  it('ouvre la session d’un admin : token en mémoire, refresh en sessionStorage', async () => {
    server.use(loginHandler(), protectedHandler('/items', 'access-1'))

    const user = await login('admin@noli.test', 'secret')

    expect(user).toEqual(adminUser)
    expect(getSessionState()).toEqual({ status: 'authenticated', user: adminUser })
    expect(getAccessToken()).toBe('access-1')
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1')
    expect(window.localStorage.length).toBe(0)
    await expect(getOk('/items')).resolves.toEqual({ ok: true })
  })

  it('refuse un compte non admin sans rien stocker', async () => {
    server.use(loginHandler('user'))

    const error = await captureError(login('user@noli.test', 'secret'))

    expect(error).toMatchObject({ kind: 'not-admin' })
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    expect(getAccessToken()).toBeUndefined()
    expect(getSessionState().status).not.toBe('authenticated')
  })

  it('remonte un 401 de mauvais identifiants sans tenter de renouvellement', async () => {
    const refreshCalls = { count: 0 }
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ statusCode: 401, message: 'Invalid credentials' }, { status: 401 }),
      ),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls.count += 1
        return HttpResponse.json({ accessToken: 'x' })
      }),
    )

    const error = await captureError(login('admin@noli.test', 'faux'))

    expect(error).toMatchObject({ kind: 'http', status: 401 })
    expect(refreshCalls.count).toBe(0)
  })
})

describe('renouvellement du token', () => {
  it('fait un seul refresh pour plusieurs 401 simultanés, puis rejoue', async () => {
    const refreshCalls = { count: 0 }
    server.use(
      loginHandler(),
      protectedHandler('/a', 'access-2'),
      protectedHandler('/b', 'access-2'),
      protectedHandler('/c', 'access-2'),
      http.post(`${API}/auth/refresh`, async () => {
        refreshCalls.count += 1
        await delay(30)
        return HttpResponse.json({ message: 'Token refreshed', accessToken: 'access-2' })
      }),
    )
    await login('admin@noli.test', 'secret')

    const results = await Promise.all([getOk('/a'), getOk('/b'), getOk('/c')])

    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(refreshCalls.count).toBe(1)
    expect(getAccessToken()).toBe('access-2')
  })

  it('rejoue sans nouveau refresh une requête partie avec un token déjà remplacé', async () => {
    const refreshCalls = { count: 0 }
    server.use(
      loginHandler(),
      http.get(`${API}/slow`, async ({ request }) => {
        await delay(80)
        return request.headers.get('authorization') === 'Bearer access-2'
          ? HttpResponse.json({ ok: true })
          : HttpResponse.json({ statusCode: 401 }, { status: 401 })
      }),
      protectedHandler('/fast', 'access-2'),
      http.post(`${API}/auth/refresh`, () => {
        refreshCalls.count += 1
        return HttpResponse.json({ accessToken: 'access-2' })
      }),
    )
    await login('admin@noli.test', 'secret')

    const slow = getOk('/slow')
    await getOk('/fast')
    await expect(slow).resolves.toEqual({ ok: true })

    expect(refreshCalls.count).toBe(1)
  })

  it('met fin à la session si le refresh est refusé : tokens, cache, onglets', async () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['series'], ['donnée de l’admin'])
    registerQueryClient(queryClient)
    server.use(
      loginHandler(),
      protectedHandler('/items', 'jamais'),
      http.get(`${API}/pending`, () => new Promise<never>(() => undefined)),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ statusCode: 401 }, { status: 401 }),
      ),
    )
    await login('admin@noli.test', 'secret')
    const { received } = openOtherTab()
    const pending = captureError(getOk('/pending'))

    const error = await captureError(getOk('/items'))

    expect(error).toMatchObject({ kind: 'session-ended', reason: 'expired' })
    expect(getSessionState()).toEqual({
      status: 'anonymous',
      endReason: 'expired',
      endMessage: 'Votre session a expiré, reconnectez vous.',
    })
    expect(getAccessToken()).toBeUndefined()
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    expect(queryClient.getQueryData(['series'])).toBeUndefined()
    expect(await pending).toMatchObject({ name: 'AbortError' })
    await flush()
    expect(received).toEqual([{ type: 'logout' }])
  })

  it('garde la première raison de fin de session', async () => {
    server.use(loginHandler())
    await login('admin@noli.test', 'secret')

    logout()
    endSession('expired', { broadcast: true })

    expect(getSessionState()).toEqual({ status: 'anonymous', endReason: 'logout' })
  })

  it('refuse le renouvellement sans refresh token', async () => {
    const error = await captureError(refreshAccessToken())
    expect(isApiError(error) && error.kind).toBe('session-ended')
  })
})

describe('403 en pleine session', () => {
  it('met fin à la session sur un 403 sans code', async () => {
    server.use(
      loginHandler(),
      http.get(`${API}/admin-only`, () =>
        HttpResponse.json({ statusCode: 403, message: 'Forbidden' }, { status: 403 }),
      ),
    )
    await login('admin@noli.test', 'secret')

    const error = await captureError(getOk('/admin-only'))

    expect(error).toMatchObject({ kind: 'session-ended', reason: 'forbidden' })
    expect(getSessionState()).toMatchObject({
      status: 'anonymous',
      endReason: 'forbidden',
      endMessage: "Ce compte n'a plus accès au tableau de bord.",
    })
  })

  it('garde la session sur un 403 qui porte un code', async () => {
    server.use(
      loginHandler(),
      http.get(`${API}/play`, () =>
        HttpResponse.json(
          { statusCode: 403, code: 'PREMIUM_REQUIRED', message: 'Premium subscription required' },
          { status: 403 },
        ),
      ),
    )
    await login('admin@noli.test', 'secret')

    const error = await captureError(getOk('/play'))

    expect(error).toMatchObject({ kind: 'http', status: 403, code: 'PREMIUM_REQUIRED' })
    expect(getSessionState().status).toBe('authenticated')
  })
})

describe('reprise au démarrage', () => {
  it('reprend la session depuis sessionStorage', async () => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1')
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'access-9' })),
      profileHandler(),
    )

    expect(getSessionState().status).toBe('restoring')
    const first = restoreSession()
    const second = restoreSession()
    await first

    expect(second).toBe(first)
    expect(getSessionState()).toEqual({ status: 'authenticated', user: adminUser })
    expect(getAccessToken()).toBe('access-9')
  })

  it('passe à anonymous sans message si le refresh est refusé', async () => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, 'perime')
    server.use(
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ statusCode: 401 }, { status: 401 }),
      ),
    )

    await restoreSession()

    expect(getSessionState()).toEqual({ status: 'anonymous' })
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
  })

  it('passe à anonymous et efface les tokens si le profil n’est pas admin', async () => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1')
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'access-9' })),
      profileHandler('user'),
    )

    await restoreSession()

    expect(getSessionState()).toEqual({ status: 'anonymous' })
    expect(getAccessToken()).toBeUndefined()
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
  })
})

describe('onglets', () => {
  it('passe à anonymous si aucun onglet ne répond', async () => {
    await restoreSession()
    expect(getSessionState()).toEqual({ status: 'anonymous' })
  })

  it('reprend avec le refresh token d’un autre onglet, et seul le premier partage compte', async () => {
    const refreshBodies: unknown[] = []
    server.use(
      http.post(`${API}/auth/refresh`, async ({ request }) => {
        refreshBodies.push(await request.json())
        return HttpResponse.json({ accessToken: 'access-9' })
      }),
      profileHandler(),
    )
    openOtherTab((message, tab) => {
      if (message.type === 'request') tab.postMessage({ type: 'share', refreshToken: 'du-1er' })
    })
    const lateShare = { sent: false }
    openOtherTab((message, tab) => {
      if (message.type === 'request') {
        setTimeout(() => {
          tab.postMessage({ type: 'share', refreshToken: 'du-2e' })
          lateShare.sent = true
        }, 10)
      }
    })

    await restoreSession()
    await flush()

    expect(lateShare.sent).toBe(true)
    expect(getSessionState().status).toBe('authenticated')
    expect(refreshBodies).toEqual([{ refreshToken: 'du-1er' }])
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('du-1er')
  })

  it('partage son token quand un autre onglet le demande, et se déconnecte sans rediffuser', async () => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1')
    server.use(
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'access-9' })),
      profileHandler(),
    )
    await restoreSession()
    const { tab, received } = openOtherTab()

    tab.postMessage({ type: 'request' })
    await flush()
    expect(received).toEqual([{ type: 'share', refreshToken: 'refresh-1' }])

    tab.postMessage({ type: 'logout' })
    await flush()

    expect(getSessionState()).toEqual({ status: 'anonymous', endReason: 'logout' })
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    expect(received).toEqual([{ type: 'share', refreshToken: 'refresh-1' }])
  })

  it('diffuse la déconnexion aux autres onglets', async () => {
    server.use(loginHandler())
    await login('admin@noli.test', 'secret')
    const { received } = openOtherTab()

    logout()
    await flush()

    expect(received).toEqual([{ type: 'logout' }])
    expect(getSessionState()).toEqual({ status: 'anonymous', endReason: 'logout' })
  })
})

describe('cas limites relevés en revue', () => {
  it('annule la reprise quand un autre onglet se déconnecte pendant qu’elle tourne', async () => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-1')
    const profileCalls = { count: 0 }
    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        await delay(80)
        return HttpResponse.json({ accessToken: 'access-9' })
      }),
      http.get(`${API}/auth/profile`, () => {
        profileCalls.count += 1
        return HttpResponse.json({ user: { ...adminUser, _id: 'u1' } })
      }),
    )
    const { tab } = openOtherTab()

    const restoring = restoreSession()
    await flush()
    tab.postMessage({ type: 'logout' })
    await restoring

    expect(getSessionState()).toEqual({ status: 'anonymous' })
    expect(getAccessToken()).toBeUndefined()
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBeNull()
    expect(profileCalls.count).toBe(0)
  })

  it('une connexion pendant la reprise garde le token de la connexion', async () => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, 'refresh-ancien')
    server.use(
      http.post(`${API}/auth/refresh`, async () => {
        await delay(80)
        return HttpResponse.json({ accessToken: 'access-ancien-compte' })
      }),
      profileHandler(),
      loginHandler(),
    )

    const restoring = restoreSession()
    await flush()
    await login('admin@noli.test', 'secret')
    await restoring

    expect(getAccessToken()).toBe('access-1')
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1')
    expect(getSessionState()).toEqual({ status: 'authenticated', user: adminUser })
  })

  it('une connexion vide le cache du compte précédent', async () => {
    const queryClient = new QueryClient()
    registerQueryClient(queryClient)
    server.use(loginHandler())
    await login('admin@noli.test', 'secret')
    queryClient.setQueryData(['series'], ['donnée du premier compte'])

    await login('admin@noli.test', 'secret')

    expect(queryClient.getQueryData(['series'])).toBeUndefined()
  })

  it('transforme un 403 à la connexion en refus d’accès', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ statusCode: 403, message: 'Forbidden' }, { status: 403 }),
      ),
    )

    expect(await captureError(login('admin@noli.test', 'secret'))).toMatchObject({
      kind: 'not-admin',
    })
  })

  it('met fin à la session si la requête rejouée reçoit encore 401', async () => {
    server.use(
      loginHandler(),
      protectedHandler('/items', 'jamais'),
      http.post(`${API}/auth/refresh`, () => HttpResponse.json({ accessToken: 'access-2' })),
    )
    await login('admin@noli.test', 'secret')

    const error = await captureError(getOk('/items'))

    expect(error).toMatchObject({ kind: 'session-ended', reason: 'expired' })
    expect(getSessionState()).toMatchObject({ status: 'anonymous', endReason: 'expired' })
  })

  it('garde la session si le refresh échoue sur le réseau', async () => {
    server.use(
      loginHandler(),
      protectedHandler('/items', 'jamais'),
      http.post(`${API}/auth/refresh`, () => HttpResponse.error()),
    )
    await login('admin@noli.test', 'secret')

    const error = await captureError(getOk('/items'))

    expect(error).toMatchObject({ kind: 'network' })
    expect(getSessionState().status).toBe('authenticated')
    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1')
  })

  it('traite un 400 sur le refresh comme un refus', async () => {
    server.use(
      loginHandler(),
      protectedHandler('/items', 'jamais'),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json(
          { statusCode: 400, message: ['refreshToken must be a string'] },
          { status: 400 },
        ),
      ),
    )
    await login('admin@noli.test', 'secret')

    const error = await captureError(getOk('/items'))

    expect(error).toMatchObject({ kind: 'session-ended', reason: 'expired' })
    expect(getSessionState()).toMatchObject({ status: 'anonymous', endReason: 'expired' })
  })

  it('garde la raison logout quand la déconnexion survient pendant le renouvellement', async () => {
    server.use(
      loginHandler(),
      protectedHandler('/items', 'jamais'),
      http.post(`${API}/auth/refresh`, async () => {
        await delay(80)
        return HttpResponse.json({ accessToken: 'access-2' })
      }),
    )
    await login('admin@noli.test', 'secret')

    const pending = captureError(getOk('/items'))
    await flush()
    logout()
    const error = await pending

    expect(error).toMatchObject({ kind: 'session-ended', reason: 'logout' })
    expect(getSessionState()).toEqual({ status: 'anonymous', endReason: 'logout' })
    expect(getAccessToken()).toBeUndefined()
  })

  it('annule les requêtes en cours à la déconnexion', async () => {
    server.use(
      loginHandler(),
      http.get(`${API}/pending`, () => new Promise<never>(() => undefined)),
    )
    await login('admin@noli.test', 'secret')

    const pending = captureError(getOk('/pending'))
    await flush()
    logout()

    expect(await pending).toMatchObject({ name: 'AbortError' })
  })

  it('garde le refresh token en mémoire si sessionStorage est bloqué', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    server.use(
      loginHandler(),
      protectedHandler('/items', 'access-2'),
      http.post(`${API}/auth/refresh`, async ({ request }) => {
        const body = (await request.json()) as { refreshToken?: string }
        return body.refreshToken === 'refresh-1'
          ? HttpResponse.json({ accessToken: 'access-2' })
          : HttpResponse.json({ statusCode: 401 }, { status: 401 })
      }),
    )
    await login('admin@noli.test', 'secret')

    await expect(getOk('/items')).resolves.toEqual({ ok: true })
    expect(getSessionState().status).toBe('authenticated')
    vi.restoreAllMocks()
  })
})

describe('sécurité et hook de session', () => {
  it('un onglet non connecté ne partage jamais de token (AC-8, AC-15)', async () => {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, 'perime')
    server.use(
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ statusCode: 401 }, { status: 401 }),
      ),
    )
    await restoreSession()
    const { tab, received } = openOtherTab()

    tab.postMessage({ type: 'request' })
    await flush()

    expect(getSessionState().status).toBe('anonymous')
    expect(received).toEqual([])
  })

  it('ignore les messages d’onglet mal formés (AC-8)', async () => {
    server.use(loginHandler())
    await login('admin@noli.test', 'secret')
    const { tab, received } = openOtherTab()

    tab.postMessage({ type: 'logout-tout' })
    tab.postMessage({ type: 'share' })
    tab.postMessage('logout')
    await flush()

    expect(getSessionState().status).toBe('authenticated')
    expect(received).toEqual([])
  })

  it('n’accepte pas un partage non sollicité (AC-8)', async () => {
    server.use(loginHandler())
    await login('admin@noli.test', 'secret')
    const { tab } = openOtherTab()

    tab.postMessage({ type: 'share', refreshToken: 'injecte' })
    await flush()

    expect(window.sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-1')
  })

  it('n’écrit aucun token dans la console pendant connexion, refresh refusé et fin de session (AC-15)', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    )
    server.use(
      loginHandler(),
      protectedHandler('/items', 'jamais'),
      http.post(`${API}/auth/refresh`, () =>
        HttpResponse.json({ statusCode: 401 }, { status: 401 }),
      ),
    )

    await login('admin@noli.test', 'secret')
    await captureError(getOk('/items'))

    const printed = JSON.stringify(spies.map((spy) => spy.mock.calls))
    expect(printed).not.toContain('access-1')
    expect(printed).not.toContain('refresh-1')
    vi.restoreAllMocks()
  })

  it('ne diffuse rien quand on se déconnecte sans session (AC-4)', async () => {
    await restoreSession()
    const { received } = openOtherTab()

    logout()
    await flush()

    expect(received).toEqual([])
    expect(getSessionState()).toEqual({ status: 'anonymous' })
  })

  it('useSession suit l’état de session (AC-6, AC-7)', async () => {
    server.use(loginHandler())
    const { result } = renderHook(() => useSession())
    expect(result.current.status).toBe('restoring')

    await act(() => login('admin@noli.test', 'secret'))
    expect(result.current).toEqual({ status: 'authenticated', user: adminUser })

    act(() => {
      logout()
    })
    expect(result.current).toEqual({ status: 'anonymous', endReason: 'logout' })
  })
})
