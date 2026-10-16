import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { routes } from '@/app/routes'
import { resetSessionForTests } from '@/shared/session/session'
import { renderRoutes } from '@/test/render'
import { API, makeSeries, seriesHandler, type SeriesRequest } from '@/test/seriesApi'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

// Recherche et filtres de la liste des séries (spec 0009), de bout en bout sur l'API simulée.

const DRAME = '65a1b2c3d4e5f6a7b8c9d001'
const HIDDEN = '65a1b2c3d4e5f6a7b8c9d002'
const UNKNOWN = '65a1b2c3d4e5f6a7b8c9d0ff'

const CATEGORIES = [
  { _id: DRAME, name: 'Drame', slug: 'drame', isVisible: true },
  { _id: HIDDEN, name: 'Bientôt', slug: 'bientot', isVisible: false },
]

function categoriesOk() {
  return http.get(`${API}/categories/all`, () =>
    HttpResponse.json({ message: 'ok', categories: CATEGORIES }),
  )
}

// Cinq séries : titres, catégories (une masquée) et accès variés.
const CATALOG = [
  makeSeries(1, {
    title: 'Le Secret du Docteur Mensah',
    categories: [{ _id: DRAME, name: 'Drame', isVisible: true }],
    isPremium: true,
  }),
  makeSeries(2, {
    title: 'Comédie à Cotonou',
    categories: [
      { _id: DRAME, name: 'Drame', isVisible: true },
      { _id: HIDDEN, name: 'Bientôt', isVisible: false },
    ],
  }),
  makeSeries(3, { title: 'Mémoires', categories: [], isPremium: true }),
  makeSeries(4, {
    title: 'Avant-première',
    categories: [{ _id: HIDDEN, name: 'Bientôt', isVisible: false }],
  }),
  makeSeries(5, { title: 'La Lagune', categories: [] }),
]

function catalog(requests?: SeriesRequest[]) {
  return seriesHandler(CATALOG.length, {
    requests,
    items: (index) => CATALOG[index - 1] ?? makeSeries(index),
  })
}

function currentPath(router: { state: { location: { pathname: string; search: string } } }) {
  return router.state.location.pathname + router.state.location.search
}

function bodyRows() {
  const table = screen.getByRole('table', { name: 'Liste des séries' })
  return within(table).getAllByRole('row').slice(1)
}

function categoryInput() {
  const input = document.getElementById('series-filter-category')
  if (input === null) throw new Error('Champ Catégorie introuvable')
  return input
}

function searchInput() {
  return screen.getByRole('textbox', { name: 'Rechercher un titre' })
}

async function chooseCategory(name: string) {
  await userEvent.click(categoryInput())
  await userEvent.click(await screen.findByRole('option', { name, hidden: true }))
}

beforeEach(() => {
  signInForTests()
  window.scrollTo = vi.fn()
})

afterEach(() => {
  resetSessionForTests()
})

describe('recherche et filtres (spec 0009)', { timeout: 20_000 }, () => {
  it('affiche la barre de filtres avec ses libellés (AC-1)', async () => {
    server.use(categoriesOk(), catalog())
    renderRoutes(routes, '/series')
    await screen.findByText('La Lagune')

    const bar = screen.getByRole('search', { name: 'Filtres des séries' })
    expect(within(bar).getByRole('textbox', { name: 'Rechercher un titre' })).toBeInTheDocument()
    expect(categoryInput()).toHaveAccessibleName('Catégorie')
    const access = within(bar).getByRole('group', { name: 'Accès' })
    expect(within(access).getByRole('radio', { name: 'Toutes' })).toBeChecked()
    expect(within(bar).queryByRole('button', { name: 'Effacer les filtres' })).toBeNull()
  })

  it('cherche après une pause de frappe, sans accents ni majuscules (AC-2, AC-3, AC-4)', async () => {
    const requests: SeriesRequest[] = []
    server.use(categoriesOk(), catalog(requests))
    const { router } = renderRoutes(routes, '/series?page=2')
    await waitFor(() => {
      expect(requests).toHaveLength(1)
    })

    await userEvent.type(searchInput(), 'COMEDIE')

    expect(await screen.findByText('1 série trouvée')).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(1)
    expect(screen.getByText('Comédie à Cotonou')).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series?q=COMEDIE')
    // Une seule requête filtrée : la frappe est regroupée, et la page revient à 1.
    const searched = requests.filter((request) => request.q !== null)
    expect(searched).toHaveLength(1)
    expect(searched[0]).toMatchObject({ q: 'COMEDIE', page: '1', limit: '20' })
    expect(router.state.historyAction).toBe('PUSH')
  })

  it('remplace l’entrée d’historique aux frappes suivantes, et le retour arrière vide le champ (AC-4)', async () => {
    server.use(categoriesOk(), seriesHandler(45))
    const { router } = renderRoutes(routes, '/series?page=2')
    await screen.findByRole('search')

    await userEvent.type(searchInput(), 'sé')
    await waitFor(() => {
      expect(currentPath(router)).toBe('/series?q=s%C3%A9')
    })
    await userEvent.type(searchInput(), 'rie')
    await waitFor(() => {
      expect(currentPath(router)).toBe('/series?q=s%C3%A9rie')
    })
    expect(searchInput()).toHaveValue('série')
    expect(router.state.historyAction).toBe('REPLACE')

    await router.navigate(-1)

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series?page=2')
    })
    await waitFor(() => {
      expect(searchInput()).toHaveValue('')
    })
    // Le champ vidé ne réécrit rien : l'adresse du retour arrière reste.
    await new Promise((resolve) => setTimeout(resolve, 400))
    expect(currentPath(router)).toBe('/series?page=2')
  })

  it('ne filtre pas sur un seul caractère et l’indique (AC-2)', async () => {
    const requests: SeriesRequest[] = []
    server.use(categoriesOk(), catalog(requests))
    const { router } = renderRoutes(routes, '/series?q=secret')
    await screen.findByText('1 série trouvée')

    await userEvent.clear(searchInput())
    await userEvent.type(searchInput(), 'm')

    expect(screen.getByText('2 caractères au moins')).toBeInTheDocument()
    await waitFor(() => {
      expect(currentPath(router)).toBe('/series')
    })
    expect(requests.some((request) => request.q === 'm')).toBe(false)
    expect(await screen.findByText('La Lagune')).toBeInTheDocument()
  })

  it('cherche les caractères spéciaux tels quels (AC-2)', async () => {
    const requests: SeriesRequest[] = []
    server.use(categoriesOk(), catalog(requests))
    renderRoutes(routes, '/series')
    await screen.findByText('La Lagune')

    await userEvent.type(searchInput(), '(*?')

    expect(await screen.findByText('Aucune série ne correspond à ces filtres.')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({ q: '(*?' })
  })

  it('« Effacer la recherche » agit tout de suite, avec une entrée d’historique (AC-1, AC-4)', async () => {
    server.use(categoriesOk(), catalog())
    const { router } = renderRoutes(routes, `/series?q=secret&categorie=${DRAME}`)
    await screen.findByText('1 série trouvée')

    await userEvent.click(screen.getByRole('button', { name: 'Effacer la recherche' }))

    await waitFor(() => {
      expect(currentPath(router)).toBe(`/series?categorie=${DRAME}`)
    })
    expect(router.state.historyAction).toBe('PUSH')
    expect(searchInput()).toHaveValue('')
    expect(await screen.findByText('2 séries trouvées')).toBeInTheDocument()
  })

  it('combine une catégorie masquée et « Gratuites », page 1, une entrée par choix (AC-1, AC-3, AC-4)', async () => {
    const requests: SeriesRequest[] = []
    server.use(categoriesOk(), catalog(requests))
    const { router } = renderRoutes(routes, '/series?page=2')
    await screen.findByRole('search')
    await waitFor(() => {
      expect(categoryInput()).toBeEnabled()
    })

    await chooseCategory('Bientôt (masquée)')
    await waitFor(() => {
      expect(currentPath(router)).toBe(`/series?categorie=${HIDDEN}`)
    })
    expect(router.state.historyAction).toBe('PUSH')
    expect(categoryInput()).toHaveValue('Bientôt (masquée)')

    await userEvent.click(screen.getByRole('radio', { name: 'Gratuites' }))

    await waitFor(() => {
      expect(currentPath(router)).toBe(`/series?categorie=${HIDDEN}&acces=gratuites`)
    })
    expect(router.state.historyAction).toBe('PUSH')
    expect(await screen.findByText('2 séries trouvées')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({
      page: '1',
      categoryId: HIDDEN,
      premium: 'false',
      q: null,
    })
  })

  it('un filtre choisi pendant la frappe emporte le texte saisi (AC-4)', async () => {
    server.use(categoriesOk(), catalog())
    const { router } = renderRoutes(routes, '/series')
    await screen.findByText('La Lagune')

    await userEvent.type(searchInput(), 'secret')
    await userEvent.click(screen.getByRole('radio', { name: 'Premium' }))

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series?q=secret&acces=premium')
    })
    expect(await screen.findByText('1 série trouvée')).toBeInTheDocument()
  })

  it('nettoie une adresse invalide sans nouvelle entrée, et attend les catégories (AC-5)', async () => {
    const requests: SeriesRequest[] = []
    server.use(
      http.get(`${API}/categories/all`, async () => {
        await delay(300)
        return HttpResponse.json({ message: 'ok', categories: CATEGORIES })
      }),
      catalog(requests),
    )
    const { router } = renderRoutes(routes, `/series?q=x&acces=vip&categorie=${UNKNOWN}`)

    await screen.findByRole('search')
    expect(requests).toHaveLength(0)
    expect(screen.queryByText('Aucune série ne correspond à ces filtres.')).toBeNull()

    expect(await screen.findByText('La Lagune')).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(requests.every((request) => request.categoryId === null)).toBe(true)
    expect(requests.every((request) => request.q === null && request.premium === null)).toBe(true)
  })

  it('garde les filtres quand la page dépasse la fin (AC-6)', async () => {
    server.use(categoriesOk(), catalog())
    const { router } = renderRoutes(routes, '/series?acces=gratuites&page=3')

    expect(await screen.findByText('3 séries trouvées')).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series?acces=gratuites')
    expect(router.state.historyAction).toBe('REPLACE')
  })

  it('« Effacer les filtres » retire tout et rend le focus à la recherche (AC-6, AC-10)', async () => {
    server.use(categoriesOk(), catalog())
    const { router } = renderRoutes(routes, `/series?q=secret&acces=premium`)
    const count = await screen.findByText('1 série trouvée')
    expect(count).toHaveAttribute('aria-live', 'polite')

    await userEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }))

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series')
    })
    expect(router.state.historyAction).toBe('PUSH')
    expect(searchInput()).toHaveFocus()
    expect(searchInput()).toHaveValue('')
    expect(await screen.findByText('La Lagune')).toBeInTheDocument()
    const access = screen.getByRole('group', { name: 'Accès' })
    expect(within(access).getByRole('radio', { name: 'Toutes' })).toBeChecked()
    expect(screen.queryByText(/trouvée/)).toBeNull()
  })

  it('aucun résultat : message et « Effacer les filtres » (AC-7)', async () => {
    server.use(categoriesOk(), catalog())
    const { router } = renderRoutes(routes, '/series?q=introuvable')

    expect(await screen.findByText('Aucune série ne correspond à ces filtres.')).toBeInTheDocument()
    expect(screen.getByText('0 série trouvée')).toBeInTheDocument()
    const buttons = screen.getAllByRole('button', { name: 'Effacer les filtres' })
    expect(buttons).toHaveLength(2)

    await userEvent.click(buttons[1] as HTMLElement)

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series')
    })
    expect(searchInput()).toHaveFocus()
  })

  it('erreur de la liste : « Réessayer », filtres toujours là (AC-8)', async () => {
    server.use(
      categoriesOk(),
      http.get(`${API}/series/admin`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderRoutes(routes, '/series?q=secret')

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    expect(screen.getByRole('search', { name: 'Filtres des séries' })).toBeInTheDocument()
    expect(searchInput()).toHaveValue('secret')
    expect(screen.getAllByRole('button', { name: 'Effacer les filtres' }).length).toBeGreaterThan(0)
  })

  it('filtre refusé (400) : « Effacer les filtres » seul, sans « Réessayer » (AC-8)', async () => {
    server.use(
      categoriesOk(),
      http.get(`${API}/series/admin`, () =>
        HttpResponse.json({ message: ['q must be longer'] }, { status: 400 }),
      ),
    )
    const { router } = renderRoutes(routes, '/series?q=secret')

    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'Réessayer' })).toBeNull()
    const buttons = screen.getAllByRole('button', { name: 'Effacer les filtres' })
    await userEvent.click(buttons.at(-1) as HTMLElement)

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series')
    })
    expect(searchInput()).toHaveFocus()
  })

  it('catégories indisponibles : filtre désactivé, recherche et accès utilisables (AC-8)', async () => {
    server.use(
      http.get(`${API}/categories/all`, () => HttpResponse.json({ message: 'x' }, { status: 500 })),
      catalog(),
    )
    const { router } = renderRoutes(routes, '/series')

    expect(await screen.findByText('Catégories indisponibles')).toBeInTheDocument()
    expect(categoryInput()).toBeDisabled()

    await userEvent.click(screen.getByRole('radio', { name: 'Premium' }))

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series?acces=premium')
    })
    expect(await screen.findByText('2 séries trouvées')).toBeInTheDocument()
  })

  it('catégories en erreur : une catégorie de l’adresse est gardée (AC-5)', async () => {
    const requests: SeriesRequest[] = []
    server.use(
      http.get(`${API}/categories/all`, () => HttpResponse.json({ message: 'x' }, { status: 500 })),
      catalog(requests),
    )
    const { router } = renderRoutes(routes, `/series?categorie=${HIDDEN}`)

    expect(await screen.findByText('2 séries trouvées')).toBeInTheDocument()
    expect(currentPath(router)).toBe(`/series?categorie=${HIDDEN}`)
    expect(requests.at(-1)).toMatchObject({ categoryId: HIDDEN })
  })

  it('montre les catégories masquées d’une ligne avec « (masquée) » (AC-9)', async () => {
    server.use(categoriesOk(), catalog())
    renderRoutes(routes, '/series')
    await screen.findByText('Comédie à Cotonou')

    const row = bodyRows().find((r) => within(r).queryByText('Comédie à Cotonou') !== null)
    expect(row).toBeDefined()
    const cell = within(row as HTMLElement).getByText('(masquée)', { exact: false })
    expect(cell.closest('td')).toHaveTextContent('Drame, Bientôt (masquée)')
  })

  it('le lien d’une ligne garde les filtres pour le retour (AC-4)', async () => {
    server.use(categoriesOk(), catalog())
    const { router } = renderRoutes(routes, '/series?q=secret&acces=premium')
    await screen.findByText('1 série trouvée')

    const link = screen.getByRole('link', { name: /Le Secret du Docteur Mensah/ })
    await userEvent.click(link)

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/series/s1')
    })
    expect(router.state.location.state).toEqual({ from: '/series?q=secret&acces=premium' })
  })

  it('la zone d’annonce existe dès l’ouverture, vide sans filtre (AC-10)', async () => {
    server.use(categoriesOk(), catalog())
    renderRoutes(routes, '/series')
    await screen.findByText('La Lagune')

    const bar = screen.getByRole('search', { name: 'Filtres des séries' })
    const live = bar.querySelector('[aria-live="polite"]')
    expect(live).not.toBeNull()
    expect(live).toHaveTextContent('')
    expect(screen.getByText('1 à 5 sur 5')).toBeInTheDocument()
  })

  it('« Effacer la recherche » n’apparaît qu’avec du texte, limité à 100 caractères (AC-1, AC-2)', async () => {
    server.use(categoriesOk(), catalog())
    renderRoutes(routes, '/series')
    await screen.findByText('La Lagune')

    expect(screen.queryByRole('button', { name: 'Effacer la recherche' })).toBeNull()
    expect(searchInput()).toHaveAttribute('maxlength', '100')

    await userEvent.type(searchInput(), 'a')

    expect(screen.getByRole('button', { name: 'Effacer la recherche' })).toBeInTheDocument()
  })

  it('écrit la recherche nettoyée des espaces dans l’adresse (AC-2)', async () => {
    const requests: SeriesRequest[] = []
    server.use(categoriesOk(), catalog(requests))
    const { router } = renderRoutes(routes, '/series')
    await screen.findByText('La Lagune')

    await userEvent.type(searchInput(), '  le   secret ')

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series?q=le+secret')
    })
    expect(await screen.findByText('1 série trouvée')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({ q: 'le secret' })
    expect(searchInput()).toHaveValue('  le   secret ')
  })

  it('garde les lignes précédentes, grisées, pendant le chargement d’un filtre (AC-3)', async () => {
    server.use(categoriesOk(), catalog())
    renderRoutes(routes, '/series')
    await screen.findByText('La Lagune')
    server.use(
      http.get(`${API}/series/admin`, async () => {
        await delay(400)
        return HttpResponse.json({
          message: 'ok',
          data: { total: 1, page: 1, limit: 20, series: [CATALOG[0]] },
        })
      }),
    )

    await userEvent.click(screen.getByRole('radio', { name: 'Premium' }))

    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Liste des séries' })).toHaveAttribute(
        'aria-busy',
        'true',
      )
    })
    expect(bodyRows()).toHaveLength(5)
    expect(await screen.findByText('1 série trouvée')).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(1)
  })

  it('pendant le chargement des catégories, le filtre est désactivé et ne montre pas l’identifiant (AC-5)', async () => {
    server.use(
      http.get(`${API}/categories/all`, async () => {
        await delay(400)
        return HttpResponse.json({ message: 'ok', categories: CATEGORIES })
      }),
      catalog(),
    )
    renderRoutes(routes, `/series?categorie=${HIDDEN}`)
    await screen.findByRole('search')

    expect(categoryInput()).toBeDisabled()
    expect(categoryInput()).toHaveValue('')
    expect(categoryInput()).toHaveAttribute('placeholder', 'Chargement des catégories')

    expect(await screen.findByText('2 séries trouvées')).toBeInTheDocument()
    expect(categoryInput()).toBeEnabled()
    expect(categoryInput()).toHaveValue('Bientôt (masquée)')
  })
})

describe('filtre « Vidéos » (spec 0010)', { timeout: 20_000 }, () => {
  // Les séries 2 et 4 ont des vidéos à traiter.
  const TODO = [0, 3, 0, 1, 0]
  function todoCatalog(requests?: SeriesRequest[]) {
    return seriesHandler(CATALOG.length, {
      requests,
      items: (index) => {
        const base = CATALOG[index - 1] ?? makeSeries(index)
        return { ...base, videosToProcess: TODO[index - 1] ?? 0 }
      },
    })
  }

  it('« À traiter » filtre, se combine, s’écrit dans l’adresse et montre le compte (AC-4, AC-5)', async () => {
    const requests: SeriesRequest[] = []
    server.use(categoriesOk(), todoCatalog(requests))
    const { router } = renderRoutes(routes, '/series?acces=gratuites')
    await screen.findByText('La Lagune')
    expect(screen.queryByText(/vidéos? à traiter/)).toBeNull()

    const videos = screen.getByRole('group', { name: 'Vidéos' })
    expect(within(videos).getByRole('radio', { name: 'Toutes' })).toBeChecked()
    await userEvent.click(within(videos).getByRole('radio', { name: 'À traiter' }))

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series?acces=gratuites&videos=a-traiter')
    })
    expect(router.state.historyAction).toBe('PUSH')
    expect(await screen.findByText('2 séries trouvées')).toBeInTheDocument()
    expect(bodyRows()).toHaveLength(2)
    expect(screen.getByText('3 vidéos à traiter')).toBeInTheDocument()
    expect(screen.getByText('1 vidéo à traiter')).toBeInTheDocument()
    expect(requests.at(-1)).toMatchObject({ premium: 'false', video: 'todo', page: '1' })
  })

  it('« Effacer les filtres » retire aussi les vidéos, et le compte disparaît (AC-4, AC-5)', async () => {
    server.use(categoriesOk(), todoCatalog())
    const { router } = renderRoutes(routes, '/series?videos=a-traiter')
    expect(await screen.findByText('3 vidéos à traiter')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Effacer les filtres' }))

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series')
    })
    expect(await screen.findByText('La Lagune')).toBeInTheDocument()
    expect(screen.queryByText(/vidéos? à traiter/)).toBeNull()
    const videos = screen.getByRole('group', { name: 'Vidéos' })
    expect(within(videos).getByRole('radio', { name: 'Toutes' })).toBeChecked()
  })

  it('retire une valeur inconnue de l’adresse sans nouvelle entrée (AC-4)', async () => {
    const requests: SeriesRequest[] = []
    server.use(categoriesOk(), todoCatalog(requests))
    const { router } = renderRoutes(routes, '/series?videos=toutes')

    await waitFor(() => {
      expect(currentPath(router)).toBe('/series')
    })
    expect(router.state.historyAction).toBe('REPLACE')
    expect(await screen.findByText('La Lagune')).toBeInTheDocument()
    expect(requests.every((r) => r.video === null)).toBe(true)
  })

  it('aucun résultat : le message des filtres et « Effacer les filtres » (AC-4)', async () => {
    server.use(categoriesOk(), todoCatalog())
    renderRoutes(routes, '/series?q=lagune&videos=a-traiter')

    expect(await screen.findByText('Aucune série ne correspond à ces filtres.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Effacer les filtres' }).length).toBeGreaterThan(0)
  })
})
