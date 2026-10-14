import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notifications } from '@mantine/notifications'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/routes'
import { PARTIAL_DELETE_MESSAGE } from '@/features/series/DeleteSeriesModal'
import { SERIES_GONE_MESSAGE, TITLE_TAKEN_MESSAGE } from '@/features/series/SeriesForm'
import { MESSAGES } from '@/features/series/seriesFormSchema'
import { resetSessionForTests } from '@/shared/session/session'
import { renderRoutes } from '@/test/render'
import {
  adminSeriesHandler,
  API,
  categoriesHandler,
  makeAdminSeries,
  seriesHandler,
  SERIES_ID,
} from '@/test/seriesApi'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

const DETAIL_PATH = `/series/${SERIES_ID}`

interface Captured {
  readonly bodies: unknown[]
}

function patchHandler(captured: Captured, respond?: (body: Record<string, unknown>) => Response) {
  return http.patch(`${API}/series/:id`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    captured.bodies.push(body)
    if (respond !== undefined) return respond(body)
    return HttpResponse.json({ message: 'ok', series: makeAdminSeries(body) })
  })
}

function renderDetail(series = makeAdminSeries(), state?: unknown) {
  server.use(adminSeriesHandler(series), categoriesHandler(), seriesHandler(12))
  return renderRoutes(routes, { pathname: DETAIL_PATH, state })
}

async function waitForForm() {
  return screen.findByRole('textbox', { name: /Titre/ })
}

beforeEach(() => {
  signInForTests()
})

afterEach(() => {
  act(() => {
    notifications.clean()
    notifications.cleanQueue()
  })
  resetSessionForTests()
})

describe('fiche d’une série (AC-6)', { timeout: 45_000 }, () => {
  it('affiche l’en tête, l’aperçu et le formulaire prérempli', async () => {
    renderDetail(makeAdminSeries(), { from: '/series?page=2' })

    expect(await waitForForm()).toHaveValue('Le Secret du Docteur Mensah')
    expect(
      screen.getByRole('heading', { level: 1, name: 'Le Secret du Docteur Mensah' }),
    ).toBeVisible()
    expect(document.title).toBe('Le Secret du Docteur Mensah · Noli Admin')
    expect(screen.getByText('8,6 (268)')).toBeInTheDocument()
    expect(screen.getByText('Épisodes').nextSibling).toHaveTextContent('8')
    expect(screen.getByRole('link', { name: 'Retour aux séries' })).toHaveAttribute(
      'href',
      '/series?page=2',
    )
    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveValue(
      'Un médecin respecté cache un passé.',
    )
    expect(screen.getAllByText('Français (fr)').length).toBeGreaterThan(0)
    expect(document.getElementById('serie-country')).toHaveValue('Bénin')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('affiche « Série introuvable » pour un identifiant mal formé, sans appel', async () => {
    const calls = { count: 0 }
    server.use(
      http.get(`${API}/series/:id/admin`, () => {
        calls.count += 1
        return HttpResponse.json({})
      }),
    )
    renderRoutes(routes, '/series/abc')

    expect(await screen.findByText('Série introuvable')).toBeInTheDocument()
    expect(calls.count).toBe(0)
    expect(screen.getByRole('link', { name: 'Retour aux séries' })).toHaveAttribute(
      'href',
      '/series',
    )
  })

  it('affiche « Série introuvable » pour une série inconnue (404)', async () => {
    server.use(adminSeriesHandler(makeAdminSeries({ _id: 'aaaaaaaaaaaaaaaaaaaaaaaa' })))
    renderRoutes(routes, DETAIL_PATH)

    expect(await screen.findByText('Série introuvable')).toBeInTheDocument()
  })

  it('affiche une erreur avec « Réessayer » si le chargement échoue', async () => {
    server.use(http.get(`${API}/series/:id/admin`, () => HttpResponse.json({}, { status: 400 })))
    renderRoutes(routes, DETAIL_PATH)

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})

describe('modification (AC-7, AC-5, AC-14)', { timeout: 45_000 }, () => {
  it('n’envoie que le titre modifié et met à jour l’en tête', async () => {
    const captured: Captured = { bodies: [] }
    server.use(patchHandler(captured))
    renderDetail()
    const title = await waitForForm()

    await userEvent.clear(title)
    await userEvent.type(title, '  Nouveau titre  ')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Modifications enregistrées.')).toBeInTheDocument()
    expect(captured.bodies).toEqual([{ title: 'Nouveau titre' }])
    expect(screen.getByRole('heading', { level: 1, name: 'Nouveau titre' })).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
    })
  })

  it('envoie null pour une description vidée', async () => {
    const captured: Captured = { bodies: [] }
    server.use(patchHandler(captured))
    renderDetail()
    await waitForForm()

    await userEvent.clear(screen.getByRole('textbox', { name: 'Description' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await screen.findByText('Modifications enregistrées.')
    expect(captured.bodies).toEqual([{ description: null }])
  })

  it('affiche le titre déjà pris sous le champ (409)', async () => {
    server.use(
      patchHandler({ bodies: [] }, () =>
        HttpResponse.json({ message: 'Series with this title already exists' }, { status: 409 }),
      ),
    )
    const { router } = renderDetail()
    const title = await waitForForm()

    await userEvent.type(title, ' bis')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText(TITLE_TAKEN_MESSAGE)).toBeInTheDocument()
    expect(title).toHaveValue('Le Secret du Docteur Mensah bis')
    expect(title).toHaveFocus()
    expect(router.state.location.pathname).toBe(DETAIL_PATH)
  })

  it('annonce une série supprimée entre temps (404)', async () => {
    server.use(
      patchHandler({ bodies: [] }, () =>
        HttpResponse.json({ message: 'Series not found' }, { status: 404 }),
      ),
    )
    renderDetail()
    const title = await waitForForm()

    await userEvent.type(title, ' bis')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(SERIES_GONE_MESSAGE)
    expect(within(alert).getByRole('link', { name: 'Retour aux séries' })).toHaveAttribute(
      'href',
      '/series',
    )
  })

  it('n’envoie qu’une modification sur un double clic', async () => {
    const captured: Captured = { bodies: [] }
    server.use(
      http.patch(`${API}/series/:id`, async ({ request }) => {
        captured.bodies.push(await request.json())
        await new Promise((resolve) => setTimeout(resolve, 200))
        return HttpResponse.json({ message: 'ok', series: makeAdminSeries({ title: 'X' }) })
      }),
    )
    renderDetail()
    const title = await waitForForm()
    await userEvent.type(title, ' bis')

    await userEvent.dblClick(screen.getByRole('button', { name: 'Enregistrer' }))

    await screen.findByText('Modifications enregistrées.')
    expect(captured.bodies).toHaveLength(1)
  })

  it('refuse de vider une année déjà renseignée, sans appel', async () => {
    const captured: Captured = { bodies: [] }
    server.use(patchHandler(captured))
    renderDetail()
    await waitForForm()

    await userEvent.clear(screen.getByRole('textbox', { name: 'Année de sortie' }))
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText(MESSAGES.yearRemoved)).toBeInTheDocument()
    expect(captured.bodies).toHaveLength(0)
  })

  it('enregistre une série aux valeurs anciennes hors règles sans les revalider', async () => {
    const captured: Captured = { bodies: [] }
    server.use(patchHandler(captured))
    renderDetail(makeAdminSeries({ title: 'T'.repeat(120), languages: ['French'] }))
    await waitForForm()
    expect(screen.getByText('French')).toBeInTheDocument()

    await userEvent.type(screen.getByRole('textbox', { name: 'Description' }), ' Suite.')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await screen.findByText('Modifications enregistrées.')
    expect(captured.bodies).toEqual([{ description: 'Un médecin respecté cache un passé. Suite.' }])
  })
})

describe('catégories et accès (AC-8, AC-9)', { timeout: 45_000 }, () => {
  it('montre une catégorie masquée de la série et la garde quand on change le titre', async () => {
    const captured: Captured = { bodies: [] }
    server.use(patchHandler(captured))
    renderDetail(
      makeAdminSeries({
        categories: [
          { _id: 'c1', name: 'Drame', slug: 'drame', isVisible: true },
          { _id: 'c9', name: 'Bientôt', slug: 'bientot', isVisible: false },
        ],
      }),
    )
    const title = await waitForForm()

    expect((await screen.findAllByText('Bientôt (masquée)')).length).toBeGreaterThan(0)
    await userEvent.type(title, ' 2')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await screen.findByText('Modifications enregistrées.')
    expect(captured.bodies).toEqual([{ title: 'Le Secret du Docteur Mensah 2' }])
  })

  it('affiche « Réessayer » quand les catégories ne se chargent pas', async () => {
    server.use(
      adminSeriesHandler(),
      http.get(`${API}/categories/all`, () => HttpResponse.json({}, { status: 400 })),
    )
    renderRoutes(routes, DETAIL_PATH)

    expect(await screen.findByText('Impossible de charger les catégories.')).toBeInTheDocument()
  })

  it('masque puis réaffiche les épisodes gratuits sans perdre leur valeur', async () => {
    const captured: Captured = { bodies: [] }
    server.use(patchHandler(captured))
    renderDetail()
    await waitForForm()
    const freeEpisodes = screen.getByRole('textbox', { name: 'Épisodes gratuits' })
    expect(freeEpisodes).toHaveValue('3')
    expect(screen.getByText('La série a actuellement 8 épisodes.')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('switch', { name: 'Série premium' }))
    expect(screen.queryByRole('textbox', { name: 'Épisodes gratuits' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('switch', { name: 'Série premium' }))

    expect(screen.getByRole('textbox', { name: 'Épisodes gratuits' })).toHaveValue('3')
    expect(screen.getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('accepte plus d’épisodes gratuits que d’épisodes', async () => {
    const captured: Captured = { bodies: [] }
    server.use(patchHandler(captured))
    renderDetail()
    await waitForForm()
    const freeEpisodes = screen.getByRole('textbox', { name: 'Épisodes gratuits' })

    await userEvent.clear(freeEpisodes)
    await userEvent.type(freeEpisodes, '12')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))

    await screen.findByText('Modifications enregistrées.')
    expect(captured.bodies).toEqual([{ freeEpisodeCount: 12 }])
  })
})

describe('changements non enregistrés (AC-12)', { timeout: 45_000 }, () => {
  it('demande confirmation avant de quitter, et « Rester » garde la saisie', async () => {
    const { router } = renderDetail()
    const title = await waitForForm()
    await userEvent.type(title, ' bis')

    await userEvent.click(screen.getByRole('link', { name: "Vue d'ensemble" }))

    expect(
      await screen.findByRole('dialog', { name: 'Quitter sans enregistrer ?' }),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Rester' }))
    expect(router.state.location.pathname).toBe(DETAIL_PATH)
    expect(title).toHaveValue('Le Secret du Docteur Mensah bis')
  })

  it('« Quitter » abandonne les changements', async () => {
    const { router } = renderDetail()
    await userEvent.type(await waitForForm(), ' bis')

    await userEvent.click(screen.getByRole('link', { name: "Vue d'ensemble" }))
    await userEvent.click(await screen.findByRole('button', { name: 'Quitter' }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
  })

  it('ne demande rien après un enregistrement réussi', async () => {
    server.use(patchHandler({ bodies: [] }))
    const { router } = renderDetail()
    await userEvent.type(await waitForForm(), ' bis')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    await screen.findByText('Modifications enregistrées.')

    await userEvent.click(screen.getByRole('link', { name: "Vue d'ensemble" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/')
    })
    expect(screen.queryByRole('dialog', { name: 'Quitter sans enregistrer ?' })).toBeNull()
  })
})

describe('suppression (AC-13)', { timeout: 45_000 }, () => {
  async function openDelete() {
    await waitForForm()
    await userEvent.click(screen.getByRole('button', { name: 'Supprimer la série' }))
    return screen.findByRole('dialog', { name: 'Supprimer « Le Secret du Docteur Mensah » ?' })
  }

  it('n’active la suppression qu’avec le titre exact, puis revient à la liste', async () => {
    const calls = { count: 0 }
    server.use(
      http.delete(`${API}/series/:id`, () => {
        calls.count += 1
        return HttpResponse.json({ message: 'Series deleted successfully' })
      }),
    )
    const { router } = renderDetail()
    const dialog = await openDelete()
    const confirm = within(dialog).getByRole('button', { name: 'Supprimer définitivement' })
    const input = within(dialog).getByRole('textbox', {
      name: 'Tapez le titre de la série pour confirmer',
    })
    expect(within(dialog).getByText('ses 8 épisodes et leurs vidéos')).toBeInTheDocument()

    await userEvent.type(input, 'le secret du docteur mensah')
    expect(confirm).toBeDisabled()
    await userEvent.clear(input)
    await userEvent.type(input, '  Le Secret du Docteur Mensah ')
    expect(confirm).toBeEnabled()
    await userEvent.click(confirm)

    expect(await screen.findByText('Série supprimée.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/series')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(calls.count).toBe(1)
  })

  it('traite une série déjà supprimée (404) comme une suppression', async () => {
    server.use(
      http.delete(`${API}/series/:id`, () =>
        HttpResponse.json({ message: 'Series not found' }, { status: 404 }),
      ),
    )
    const { router } = renderDetail()
    const dialog = await openDelete()
    await userEvent.type(within(dialog).getByRole('textbox'), 'Le Secret du Docteur Mensah')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await screen.findByText('Cette série avait déjà été supprimée.')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/series')
  })

  it('garde la fenêtre ouverte avec un message sur une erreur serveur', async () => {
    server.use(http.delete(`${API}/series/:id`, () => HttpResponse.json({}, { status: 502 })))
    const { router } = renderDetail()
    const dialog = await openDelete()
    await userEvent.type(within(dialog).getByRole('textbox'), 'Le Secret du Docteur Mensah')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Supprimer définitivement' }))

    expect(await within(dialog).findByRole('alert', {}, { timeout: 15_000 })).toHaveTextContent(
      PARTIAL_DELETE_MESSAGE,
    )
    expect(router.state.location.pathname).toBe(DETAIL_PATH)
    expect(within(dialog).getByRole('textbox')).toHaveValue('Le Secret du Docteur Mensah')
  })
})
