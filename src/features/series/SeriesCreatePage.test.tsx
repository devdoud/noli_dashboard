import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notifications } from '@mantine/notifications'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/routes'
import { TITLE_TAKEN_MESSAGE } from '@/features/series/SeriesForm'
import { MESSAGES } from '@/features/series/seriesFormSchema'
import { resetSessionForTests } from '@/shared/session/session'
import { renderRoutes } from '@/test/render'
import { API, categoriesHandler, makeAdminSeries, seriesHandler, SERIES_ID } from '@/test/seriesApi'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

function postHandler(bodies: unknown[], respond?: () => Response) {
  return http.post(`${API}/series`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    bodies.push(body)
    if (respond !== undefined) return respond()
    return HttpResponse.json(
      {
        message: 'Series created successfully',
        series: makeAdminSeries({ ...body, totalEpisodes: 0 }),
      },
      { status: 201 },
    )
  })
}

async function pickCategory(search: string) {
  const input = document.getElementById('serie-categoryIds')
  if (input === null) throw new Error('Champ Catégories introuvable')
  // Le champ reste désactivé pendant le chargement des catégories.
  await waitFor(() => {
    expect(input).toBeEnabled()
  })
  await userEvent.click(input)
  await userEvent.type(input, `${search}{ArrowDown}{Enter}{Escape}`)
}

beforeEach(() => {
  signInForTests()
  server.use(categoriesHandler(), seriesHandler(12))
})

afterEach(() => {
  act(() => {
    notifications.clean()
    notifications.cleanQueue()
  })
  resetSessionForTests()
})

describe('liste vers création et fiche (AC-1)', { timeout: 45_000 }, () => {
  it('propose « Nouvelle série » et un lien par titre', async () => {
    renderRoutes(routes, '/series?page=1')

    expect(await screen.findByRole('link', { name: 'Nouvelle série' })).toHaveAttribute(
      'href',
      '/series/nouvelle',
    )
    expect(await screen.findByRole('link', { name: 'Série 1' })).toHaveAttribute(
      'href',
      '/series/s1',
    )
  })

  it('ouvre la fiche depuis le titre et revient à la page de liste', async () => {
    server.use(
      http.get(`${API}/series/:id/admin`, () =>
        HttpResponse.json({
          series: makeAdminSeries({ _id: 'aaaaaaaaaaaaaaaaaaaaaaa1', title: 'Série 1' }),
        }),
      ),
      seriesHandler(12, {
        items: (index) => ({
          _id: `aaaaaaaaaaaaaaaaaaaaaaa${String(index)}`,
          title: `Série ${String(index)}`,
        }),
      }),
    )
    const { router } = renderRoutes(routes, '/series?page=1')

    await userEvent.click(await screen.findByRole('link', { name: 'Série 1' }))

    expect(await screen.findByRole('heading', { level: 1, name: 'Série 1' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/series/aaaaaaaaaaaaaaaaaaaaaaa1')
    expect(screen.getByRole('link', { name: 'Retour aux séries' })).toHaveAttribute(
      'href',
      '/series?page=1',
    )
  })
})

describe('création (AC-2 à AC-5)', { timeout: 45_000 }, () => {
  it('affiche les valeurs de départ', async () => {
    renderRoutes(routes, '/series/nouvelle')

    expect(await screen.findByRole('heading', { level: 1, name: 'Nouvelle série' })).toBeVisible()
    expect(document.title).toBe('Nouvelle série · Noli Admin')
    expect(screen.getByRole('radio', { name: 'En cours' })).toBeChecked()
    expect(screen.getByRole('switch', { name: 'Série premium' })).not.toBeChecked()
    expect(screen.queryByRole('textbox', { name: 'Épisodes gratuits' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch', { name: 'Série premium' }))
    expect(screen.getByRole('textbox', { name: 'Épisodes gratuits' })).toHaveValue('0')
    expect(screen.getByText('La série a actuellement 0 épisode.')).toBeInTheDocument()
  })

  it('montre les erreurs, place le focus sur le titre et n’appelle pas l’API', async () => {
    const bodies: unknown[] = []
    server.use(postHandler(bodies))
    renderRoutes(routes, '/series/nouvelle')
    await screen.findByRole('textbox', { name: /Titre/ })

    await userEvent.type(screen.getByRole('textbox', { name: 'Année de sortie' }), '1700')
    await userEvent.click(screen.getByRole('button', { name: 'Créer la série' }))

    expect(await screen.findByText(MESSAGES.titleRequired)).toBeInTheDocument()
    expect(screen.getByText(MESSAGES.categoriesRequired)).toBeInTheDocument()
    expect(screen.getByText(MESSAGES.yearInvalid)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /Titre/ })).toHaveFocus()
    expect(screen.getByRole('textbox', { name: /Titre/ })).toHaveAttribute('aria-invalid', 'true')
    expect(bodies).toHaveLength(0)
  })

  it('crée la série avec les seuls champs remplis et ouvre sa fiche', async () => {
    const bodies: unknown[] = []
    server.use(postHandler(bodies))
    const { router } = renderRoutes(routes, '/series/nouvelle')
    await userEvent.type(
      await screen.findByRole('textbox', { name: /Titre/ }),
      '  Amours de Dakar ',
    )
    await pickCategory('Bient')
    await userEvent.click(screen.getByRole('textbox', { name: 'Langues' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Langues' }), 'dyu{Enter}')
    await userEvent.click(screen.getByRole('switch', { name: 'Série premium' }))
    await userEvent.clear(screen.getByRole('textbox', { name: 'Épisodes gratuits' }))
    await userEvent.type(screen.getByRole('textbox', { name: 'Épisodes gratuits' }), '2')

    await userEvent.click(screen.getByRole('button', { name: 'Créer la série' }))

    expect(await screen.findByText('Série créée.')).toBeInTheDocument()
    expect(bodies).toEqual([
      {
        title: 'Amours de Dakar',
        categoryIds: ['c9'],
        status: 'ongoing',
        isPremium: true,
        freeEpisodeCount: 2,
        languages: ['dyu'],
      },
    ])
    expect(router.state.location.pathname).toBe(`/series/${SERIES_ID}`)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Amours de Dakar' }),
    ).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeNull()
  })

  it('garde la saisie et affiche le titre déjà pris (409)', async () => {
    server.use(
      postHandler([], () =>
        HttpResponse.json({ message: 'Series with this title already exists' }, { status: 409 }),
      ),
    )
    const { router } = renderRoutes(routes, '/series/nouvelle')
    await userEvent.type(await screen.findByRole('textbox', { name: /Titre/ }), 'Doublon')
    await pickCategory('Drame')

    await userEvent.click(screen.getByRole('button', { name: 'Créer la série' }))

    expect(await screen.findByText(TITLE_TAKEN_MESSAGE)).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/series/nouvelle')
    expect(screen.getByRole('textbox', { name: /Titre/ })).toHaveValue('Doublon')
  })

  it('demande confirmation avant de quitter une saisie commencée', async () => {
    const { router } = renderRoutes(routes, '/series/nouvelle')
    await userEvent.type(await screen.findByRole('textbox', { name: /Titre/ }), 'Brouillon')

    await userEvent.click(screen.getByRole('link', { name: 'Retour aux séries' }))

    expect(
      await screen.findByRole('dialog', { name: 'Quitter sans enregistrer ?' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Quitter' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/series')
    })
  })
})
