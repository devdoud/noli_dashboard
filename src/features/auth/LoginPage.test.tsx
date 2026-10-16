import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/routes'
import { API, categoriesHandler, seriesListHandlers } from '@/test/seriesApi'
import { SESSION_EXPIRED_MESSAGE, SESSION_FORBIDDEN_MESSAGE } from '@/shared/api/messages'
import { resetSessionForTests } from '@/shared/session/session'
import { getSessionState, setSessionState } from '@/shared/session/store'
import { renderRoutes } from '@/test/render'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

interface LoginBody {
  readonly email: string
  readonly password: string
}

function loginHandler(role = 'admin', calls: LoginBody[] = []) {
  return http.post(`${API}/auth/login`, async ({ request }) => {
    calls.push((await request.json()) as LoginBody)
    return HttpResponse.json({
      accessToken: 'access-1',
      refreshToken: 'refresh-1',
      user: { id: 'u1', email: 'admin@noli.test', username: 'admin', role },
    })
  })
}

async function fillAndSubmit(email = 'admin@noli.test', password = 'secret') {
  if (email !== '') await userEvent.type(screen.getByLabelText('Email'), email)
  if (password !== '') await userEvent.type(screen.getByLabelText('Mot de passe'), password)
  await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))
}

function currentPath(router: { state: { location: { pathname: string; search: string } } }) {
  return router.state.location.pathname + router.state.location.search
}

beforeEach(() => {
  setSessionState({ status: 'anonymous' })
})

afterEach(() => {
  resetSessionForTests()
})

describe('page de connexion (AC-1)', { timeout: 15_000 }, () => {
  it('affiche la carte, hors de la mise en page, avec le focus sur l’email', async () => {
    renderRoutes(routes, '/connexion')

    expect(await screen.findByRole('heading', { level: 1, name: 'Noli' })).toBeInTheDocument()
    expect(screen.getByText("Espace d'administration")).toBeInTheDocument()
    expect(screen.getByLabelText('Email')).toHaveFocus()
    expect(screen.getByLabelText('Mot de passe')).toHaveAttribute('type', 'password')
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Menu principal' })).not.toBeInTheDocument()
    expect(document.title).toBe('Connexion · Noli Admin')
  })

  it('affiche puis masque le mot de passe', async () => {
    renderRoutes(routes, '/connexion')
    const password = await screen.findByLabelText('Mot de passe')

    await userEvent.click(screen.getByRole('button', { name: 'Afficher le mot de passe' }))
    expect(password).toHaveAttribute('type', 'text')
    await userEvent.click(screen.getByRole('button', { name: 'Masquer le mot de passe' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})

describe('validation (AC-2)', { timeout: 15_000 }, () => {
  it('montre les messages sous les champs sans appeler l’API', async () => {
    const calls: LoginBody[] = []
    server.use(loginHandler('admin', calls))
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit('pas-un-email', '')

    expect(await screen.findByText('Adresse email invalide.')).toBeInTheDocument()
    expect(screen.getByText('Mot de passe requis.')).toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })

  it('envoie l’email sans les espaces autour', async () => {
    const calls: LoginBody[] = []
    server.use(loginHandler('admin', calls), ...seriesListHandlers(0))
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit('  admin@noli.test  ', 'secret')

    await waitFor(() => {
      expect(calls).toEqual([{ email: 'admin@noli.test', password: 'secret' }])
    })
  })
})

describe('connexion et redirection (AC-3, AC-7)', { timeout: 15_000 }, () => {
  it('mène sur /series sans retour', async () => {
    server.use(loginHandler(), ...seriesListHandlers(0))
    const { router } = renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit()

    expect(await screen.findByRole('heading', { level: 1, name: 'Séries' })).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series')
    expect(getSessionState().status).toBe('authenticated')
  })

  it('mène sur l’adresse de retour quand elle est sûre', async () => {
    server.use(loginHandler(), ...seriesListHandlers(45))
    const { router } = renderRoutes(
      routes,
      `/connexion?retour=${encodeURIComponent('/series?page=2')}`,
    )
    await screen.findByLabelText('Email')

    await fillAndSubmit()

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series?page=2')
    })
  })

  it('ignore une adresse de retour vers un autre site', async () => {
    server.use(loginHandler(), ...seriesListHandlers(0))
    const { router } = renderRoutes(routes, `/connexion?retour=${encodeURIComponent('//evil.com')}`)
    await screen.findByLabelText('Email')

    await fillAndSubmit()

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series')
    })
  })

  it('redirige un admin déjà connecté (AC-7)', async () => {
    signInForTests()
    server.use(...seriesListHandlers(0))
    const { router } = renderRoutes(routes, '/connexion')

    expect(await screen.findByRole('heading', { level: 1, name: 'Séries' })).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series')
  })

  it('affiche le chargement plein écran pendant la reprise de session', async () => {
    setSessionState({ status: 'restoring' })
    renderRoutes(routes, '/connexion')

    expect(await screen.findByRole('status')).toHaveTextContent('Chargement…')
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })
})

describe('refus (AC-4)', { timeout: 15_000 }, () => {
  it('affiche « Email ou mot de passe incorrect. » sur un 401', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 }),
      ),
    )
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.')
    expect(getSessionState().status).toBe('anonymous')
  })

  it('refuse un compte qui n’est pas admin', async () => {
    server.use(loginHandler('user'))
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce compte n'a pas accès au tableau de bord.",
    )
    expect(getSessionState().status).toBe('anonymous')
  })

  it('n’envoie qu’une demande pendant le chargement', async () => {
    const calls: LoginBody[] = []
    const release: { resolve?: () => void } = {}
    server.use(
      http.post(`${API}/auth/login`, async ({ request }) => {
        calls.push((await request.json()) as LoginBody)
        await new Promise<void>((resolve) => {
          release.resolve = resolve
        })
        return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
      }),
    )
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit()
    const loading = await screen.findByRole('button', { name: 'Connexion en cours' })
    expect(loading).toBeDisabled()
    await userEvent.click(loading)

    await waitFor(() => {
      expect(release.resolve).toBeDefined()
    })
    release.resolve?.()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(calls).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeEnabled()
  })
})

describe('garde et fin de session (AC-5, AC-6)', { timeout: 15_000 }, () => {
  it('envoie une page protégée vers la connexion avec son adresse de retour', async () => {
    const { router } = renderRoutes(routes, '/series?page=3')

    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(currentPath(router)).toBe(`/connexion?retour=${encodeURIComponent('/series?page=3')}`)
  })

  it('protège aussi la page introuvable', async () => {
    const { router } = renderRoutes(routes, '/nimporte-quoi')

    await screen.findByLabelText('Email')
    expect(router.state.location.pathname).toBe('/connexion')
  })

  it('affiche le chargement plein écran pendant la reprise, sans la page protégée', async () => {
    setSessionState({ status: 'restoring' })
    renderRoutes(routes, '/series')

    expect(await screen.findByRole('status')).toHaveTextContent('Chargement…')
    expect(screen.queryByRole('heading', { name: 'Séries' })).not.toBeInTheDocument()
    expect(screen.queryByLabelText('Email')).not.toBeInTheDocument()
  })

  it('affiche le message d’expiration, garde le retour, et le masque à l’envoi', async () => {
    setSessionState({
      status: 'anonymous',
      endReason: 'expired',
      endMessage: SESSION_EXPIRED_MESSAGE,
    })
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 }),
      ),
    )
    const { router } = renderRoutes(routes, '/series?page=2')

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument()
    expect(currentPath(router)).toBe(`/connexion?retour=${encodeURIComponent('/series?page=2')}`)
    expect(screen.getByLabelText('Email')).toHaveFocus()

    await fillAndSubmit()

    await screen.findByRole('alert')
    expect(screen.queryByText(SESSION_EXPIRED_MESSAGE)).not.toBeInTheDocument()
  })

  it('après « Se déconnecter », montre la connexion sans message ni retour', async () => {
    signInForTests()
    server.use(...seriesListHandlers(45))
    const { router } = renderRoutes(routes, '/series?page=2')
    await screen.findByRole('heading', { level: 1, name: 'Séries' })

    const [logoutButton] = screen.getAllByRole('button', { name: 'Se déconnecter' })
    if (logoutButton === undefined) throw new Error('Bouton « Se déconnecter » introuvable')
    await userEvent.click(logoutButton)

    expect(await screen.findByLabelText('Email')).toBeInTheDocument()
    expect(currentPath(router)).toBe('/connexion')
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('redirige vers la connexion quand la session finit pendant le chargement de la liste', async () => {
    signInForTests()
    server.use(
      http.get(`${API}/series/admin`, () => new HttpResponse(null, { status: 401 })),
      categoriesHandler(),
      http.post(`${API}/auth/refresh`, () => new HttpResponse(null, { status: 401 })),
    )
    const { router } = renderRoutes(routes, '/series')

    expect(await screen.findByText(SESSION_EXPIRED_MESSAGE)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/connexion')
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
  })
})

describe('fin de session refusée (AC-6)', { timeout: 15_000 }, () => {
  it('affiche le message d’accès retiré et garde l’adresse de retour', async () => {
    setSessionState({
      status: 'anonymous',
      endReason: 'forbidden',
      endMessage: SESSION_FORBIDDEN_MESSAGE,
    })
    const { router } = renderRoutes(routes, '/series?page=3')

    expect(await screen.findByRole('status')).toHaveTextContent(SESSION_FORBIDDEN_MESSAGE)
    expect(currentPath(router)).toBe(`/connexion?retour=${encodeURIComponent('/series?page=3')}`)
  })

  it('masque le message dès un envoi invalide, sans appeler l’API', async () => {
    setSessionState({
      status: 'anonymous',
      endReason: 'expired',
      endMessage: SESSION_EXPIRED_MESSAGE,
    })
    const calls: LoginBody[] = []
    server.use(loginHandler('admin', calls))
    renderRoutes(routes, '/connexion')
    await screen.findByText(SESSION_EXPIRED_MESSAGE)

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    expect(screen.queryByText(SESSION_EXPIRED_MESSAGE)).not.toBeInTheDocument()
    expect(calls).toHaveLength(0)
  })
})

describe('erreurs de connexion, cas restants (AC-4)', { timeout: 15_000 }, () => {
  it('annonce une erreur réseau dans la carte', async () => {
    server.use(http.post(`${API}/auth/login`, () => HttpResponse.error()))
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.',
    )
    expect(getSessionState().status).toBe('anonymous')
  })

  it('refuse un compte non admin signalé par un 403 de l’API', async () => {
    server.use(
      http.post(`${API}/auth/login`, () =>
        HttpResponse.json({ message: 'Forbidden' }, { status: 403 }),
      ),
    )
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Ce compte n'a pas accès au tableau de bord.",
    )
  })

  it('efface l’erreur précédente pendant un nouvel envoi', async () => {
    const release: { resolve?: () => void } = {}
    const attempts = { count: 0 }
    server.use(
      http.post(`${API}/auth/login`, async () => {
        attempts.count += 1
        if (attempts.count === 2) {
          await new Promise<void>((resolve) => {
            release.resolve = resolve
          })
        }
        return HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
      }),
    )
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')
    await fillAndSubmit()
    await screen.findByRole('alert')

    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }))

    await screen.findByRole('button', { name: 'Connexion en cours' })
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    release.resolve?.()
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})

describe('sécurité du mot de passe', { timeout: 15_000 }, () => {
  it('ne garde le mot de passe ni dans le stockage ni dans la console', async () => {
    const consoleCalls: unknown[][] = []
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation((...args: unknown[]) => {
        consoleCalls.push(args)
      }),
    )
    server.use(loginHandler(), ...seriesListHandlers(0))
    renderRoutes(routes, '/connexion')
    await screen.findByLabelText('Email')

    await fillAndSubmit('admin@noli.test', 'MotDePasseUnique42')
    await screen.findByRole('heading', { level: 1, name: 'Séries' })

    const stored = [window.sessionStorage, window.localStorage]
      .flatMap((storage) => Object.keys(storage).map((key) => storage.getItem(key) ?? ''))
      .join(' ')
    expect(stored).not.toContain('MotDePasseUnique42')
    expect(JSON.stringify(consoleCalls)).not.toContain('MotDePasseUnique42')
    spies.forEach((spy) => {
      spy.mockRestore()
    })
  })
})

describe('accessibilité du formulaire (AC-1, AC-2)', { timeout: 15_000 }, () => {
  it('relie chaque message d’erreur à son champ', async () => {
    renderRoutes(routes, '/connexion')
    const email = await screen.findByLabelText('Email')

    await fillAndSubmit('pas-un-email', '')

    expect(email).toHaveAttribute('aria-invalid', 'true')
    expect(email).toHaveAccessibleDescription('Adresse email invalide.')
    expect(screen.getByLabelText('Mot de passe')).toHaveAccessibleDescription(
      'Mot de passe requis.',
    )
  })

  it('suit l’ordre Email, bouton de l’œil, Mot de passe, Se connecter au clavier', async () => {
    renderRoutes(routes, '/connexion')
    const email = await screen.findByLabelText('Email')
    expect(email).toHaveFocus()

    await userEvent.tab()
    expect(screen.getByLabelText('Mot de passe')).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Afficher le mot de passe' })).toHaveFocus()
    await userEvent.tab()
    expect(screen.getByRole('button', { name: 'Se connecter' })).toHaveFocus()
  })
})
