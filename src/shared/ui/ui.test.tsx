import { notifications } from '@mantine/notifications'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ApiError } from '@/shared/api/errors'
import { trackSlowRequest } from '@/shared/api/slowRequests'
import {
  applyFieldErrors,
  DUPLICATE_FIELD_MESSAGE,
  INVALID_FIELD_MESSAGE,
} from '@/shared/ui/applyFieldErrors'
import { ConfigErrorScreen } from '@/shared/ui/ConfigErrorScreen'
import { ErrorState } from '@/shared/ui/ErrorState'
import { notifyError } from '@/shared/ui/notifyError'
import { SLOW_SERVER_MESSAGE } from '@/shared/ui/SlowServerNotice'
import { renderWithProviders } from '@/test/render'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  // Le store des notifications Mantine est global : le vider pour isoler chaque test.
  act(() => {
    notifications.clean()
    notifications.cleanQueue()
  })
})

function fakeForm() {
  const errors: Record<string, unknown> = {}
  return {
    errors,
    setFieldError(path: string, error: unknown) {
      errors[path] = error
    },
  }
}

describe('ErrorState', () => {
  it('affiche le message, le détail et relance au clic', async () => {
    const onRetry = vi.fn()
    renderWithProviders(
      <ErrorState
        error={new ApiError({ kind: 'http', status: 400, backendMessage: 'title is too long' })}
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText('Certaines informations sont invalides.')).toBeInTheDocument()
    expect(screen.getByText('title is too long')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})

describe('notifyError', () => {
  it('montre une notification rouge avec le message français', () => {
    const show = vi.spyOn(notifications, 'show')
    notifyError(new ApiError({ kind: 'http', status: 413 }))
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'red', message: 'Fichier trop lourd : 5 Mo au plus.' }),
    )
  })

  it('reste silencieux pour un abandon ou une fin de session', () => {
    const show = vi.spyOn(notifications, 'show')
    notifyError(new DOMException('annulé', 'AbortError'))
    notifyError(new ApiError({ kind: 'session-ended', reason: 'expired' }))
    expect(show).not.toHaveBeenCalled()
  })
})

describe('applyFieldErrors', () => {
  it('place « Valeur invalide. » sous le champ et notifie le reste', () => {
    const show = vi.spyOn(notifications, 'show')
    const form = fakeForm()
    const error = new ApiError({
      kind: 'http',
      status: 400,
      backendMessage: ['title must be shorter than 120 characters', 'something unrelated'],
    })

    const handled = applyFieldErrors(form, error, { title: 'title', duration: 'duration' })

    expect(handled).toBe(true)
    expect(form.errors).toEqual({ title: INVALID_FIELD_MESSAGE })
    expect(show).toHaveBeenCalledOnce()
  })

  it('ne notifie pas quand toutes les phrases ont un champ', () => {
    const show = vi.spyOn(notifications, 'show')
    const form = fakeForm()
    const error = new ApiError({ kind: 'http', status: 400, backendMessage: ['Title is required'] })

    expect(applyFieldErrors(form, error, { title: 'title' })).toBe(true)
    expect(show).not.toHaveBeenCalled()
  })

  it('place « Déjà utilisé. » sur un 409 sans code', () => {
    const form = fakeForm()
    const error = new ApiError({
      kind: 'http',
      status: 409,
      backendMessage: 'Title already exists',
    })

    expect(applyFieldErrors(form, error, { title: 'title' })).toBe(true)
    expect(form.errors).toEqual({ title: DUPLICATE_FIELD_MESSAGE })
  })

  it('envoie toute autre erreur dans une notification', () => {
    const show = vi.spyOn(notifications, 'show')
    const form = fakeForm()

    expect(applyFieldErrors(form, new ApiError({ kind: 'network' }), { title: 'title' })).toBe(
      false,
    )
    expect(form.errors).toEqual({})
    expect(show).toHaveBeenCalledOnce()
  })
})

describe('SlowServerNotice', () => {
  it('apparaît après 5 s d’attente et disparaît à la fin', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const show = vi.spyOn(notifications, 'show')
    const hide = vi.spyOn(notifications, 'hide')
    renderWithProviders(<p>page</p>)
    const pending: { resolve?: () => void } = {}

    const request = trackSlowRequest(
      () =>
        new Promise<void>((resolve) => {
          pending.resolve = resolve
        }),
    )
    await act(() => vi.advanceTimersByTimeAsync(5_000))
    expect(show).toHaveBeenCalledWith(expect.objectContaining({ message: SLOW_SERVER_MESSAGE }))

    await act(async () => {
      pending.resolve?.()
      await request
    })
    expect(hide).toHaveBeenLastCalledWith('slow-server')
  })
})

describe('ConfigErrorScreen', () => {
  it('nomme la variable en cause', () => {
    renderWithProviders(
      <ConfigErrorScreen variable="VITE_API_BASE_URL" reason="La variable est absente." />,
    )
    expect(screen.getByRole('heading', { name: 'Configuration invalide' })).toBeInTheDocument()
    expect(screen.getByText('VITE_API_BASE_URL')).toBeInTheDocument()
  })
})

describe('ErrorState, cas limites (AC-13)', () => {
  it('s’annonce comme une alerte, sans bouton ni détail quand rien n’est fourni', () => {
    renderWithProviders(<ErrorState error={new ApiError({ kind: 'network' })} />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.',
    )
    expect(screen.queryByRole('button', { name: 'Réessayer' })).not.toBeInTheDocument()
    expect(screen.queryByText('Détails')).not.toBeInTheDocument()
  })

  it('le bouton Réessayer est atteignable au clavier', async () => {
    const onRetry = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<ErrorState error={new ApiError({ kind: 'timeout' })} onRetry={onRetry} />)

    await user.tab()
    expect(screen.getByRole('button', { name: 'Réessayer' })).toHaveFocus()
    await user.keyboard('{Enter}')

    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('applique les remplacements de message', () => {
    renderWithProviders(
      <ErrorState
        error={new ApiError({ kind: 'http', status: 404 })}
        overrides={{ '404': 'Série introuvable.' }}
      />,
    )

    expect(screen.getByText('Série introuvable.')).toBeInTheDocument()
  })
})

describe('notifyError, affichage (AC-10, AC-13)', () => {
  it('affiche le message et un détail repliable dans la notification', async () => {
    renderWithProviders(<p>page</p>)

    act(() => {
      notifyError(
        new ApiError({ kind: 'http', status: 400, backendMessage: 'title should not be empty' }),
      )
    })

    expect(await screen.findByText('Certaines informations sont invalides.')).toBeInTheDocument()
    expect(screen.getByText('Détails')).toBeInTheDocument()
    expect(screen.getByText('title should not be empty')).toBeInTheDocument()
  })
})

describe('applyFieldErrors, cas limites (AC-13)', () => {
  it('notifie et renvoie false pour un 400 sans phrase du backend', () => {
    const show = vi.spyOn(notifications, 'show')
    const form = fakeForm()

    const handled = applyFieldErrors(form, new ApiError({ kind: 'http', status: 400 }), {
      title: 'title',
    })

    expect(handled).toBe(false)
    expect(form.errors).toEqual({})
    expect(show).toHaveBeenCalledOnce()
  })

  it('ne place qu’une erreur par champ même avec plusieurs phrases', () => {
    const form = fakeForm()
    const setFieldError = vi.spyOn(form, 'setFieldError')
    const error = new ApiError({
      kind: 'http',
      status: 400,
      backendMessage: ['TITLE should not be empty', 'title must be a string'],
    })

    expect(applyFieldErrors(form, error, { title: 'title' })).toBe(true)
    expect(setFieldError).toHaveBeenCalledOnce()
    expect(form.errors).toEqual({ title: INVALID_FIELD_MESSAGE })
  })

  it('notifie un 409 qui porte un code au lieu de toucher un champ', () => {
    const show = vi.spyOn(notifications, 'show')
    const form = fakeForm()
    const error = new ApiError({
      kind: 'http',
      status: 409,
      code: 'CATEGORY_IN_USE',
      body: { seriesCount: 2 },
    })

    expect(applyFieldErrors(form, error, { name: 'name' })).toBe(false)
    expect(form.errors).toEqual({})
    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "Cette catégorie est encore utilisée par 2 série(s). Retirez la de ces séries d'abord.",
      }),
    )
  })

  it('reste silencieux pour une fin de session', () => {
    const show = vi.spyOn(notifications, 'show')
    const form = fakeForm()

    expect(
      applyFieldErrors(form, new ApiError({ kind: 'session-ended', reason: 'expired' }), {
        title: 'title',
      }),
    ).toBe(false)
    expect(show).not.toHaveBeenCalled()
  })
})
