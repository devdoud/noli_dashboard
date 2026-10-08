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
