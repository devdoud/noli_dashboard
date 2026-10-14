import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/routes'
import { resetSessionForTests } from '@/shared/session/session'
import { renderRoutes } from '@/test/render'
import { API, makeSeries, seriesHandler, type SeriesRequest } from '@/test/seriesApi'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

function currentPath(router: { state: { location: { pathname: string; search: string } } }) {
  return router.state.location.pathname + router.state.location.search
}

function bodyRows() {
  const table = screen.getByRole('table', { name: 'Liste des séries' })
  // La première ligne est celle des en têtes.
  return within(table).getAllByRole('row').slice(1)
}

const scrollTo = vi.fn()

beforeEach(() => {
  signInForTests()
  scrollTo.mockClear()
  window.scrollTo = scrollTo
})

afterEach(() => {
  resetSessionForTests()
})

describe('liste des séries (AC-8, AC-11)', { timeout: 15_000 }, () => {
  it('affiche l’en tête, 20 lignes et le résumé', async () => {
    const requests: SeriesRequest[] = []
    server.use(seriesHandler(45, { requests }))
    renderRoutes(routes, '/series')

    expect(await screen.findByText('Série 1')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Séries' })).toBeInTheDocument()
    expect(document.title).toBe('Séries · Noli Admin')
    expect(bodyRows()).toHaveLength(20)
    expect(screen.getByText('1 à 20 sur 45')).toBeInTheDocument()
    expect(requests[0]).toEqual({ page: '1', limit: '20' })
    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent)
    expect(headers).toEqual([
      'Couverture et titre',
      'Catégories',
      'Statut',
      'Accès',
      'Épisodes',
      'Note',
      'Mise à jour',
    ])
  })

  it('remplit chaque colonne selon la table « Colonnes »', async () => {
    server.use(
      seriesHandler(3, {
        items: (index) =>
          [
            makeSeries(1, {
              title: 'Premium avec note',
              isPremium: true,
              freeEpisodeCount: 2,
              status: 'ongoing',
              categories: [
                { _id: 'c1', name: 'Drame' },
                { _id: 'c2', name: 'Romance' },
              ],
              totalEpisodes: 24,
              rating: 8.43,
              votes: 1200,
            }),
            makeSeries(2, {
              title: 'Sans couverture',
              coverImage: null,
              status: 'completed',
              isPremium: true,
              freeEpisodeCount: 1,
              categories: [],
              rating: 0,
              votes: 3,
            }),
            makeSeries(3, {
              title: 'Valeurs manquantes',
              rating: null,
              votes: null,
              status: 'brouillon',
              updatedAt: null,
              totalEpisodes: null,
            }),
          ][index - 1] ?? makeSeries(index),
      }),
    )
    renderRoutes(routes, '/series')
    await screen.findByText('Premium avec note')
    const [first, second, third] = bodyRows()
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('Lignes manquantes')
    }

    const firstCells = within(first).getAllByRole('cell')
    expect(within(first).getByRole('presentation')).toHaveAttribute(
      'src',
      'https://res.cloudinary.com/noli/cover-1.jpg',
    )
    expect(firstCells[1]).toHaveTextContent('Drame, Romance')
    expect(firstCells[2]).toHaveTextContent('En cours')
    expect(firstCells[3]).toHaveTextContent('Premium2 gratuits')
    expect(firstCells[4]).toHaveTextContent('24')
    expect(firstCells[5]?.textContent.replace(/\s/g, ' ')).toBe('8,4 (1 200)')
    expect(firstCells[6]).toHaveTextContent('5 mars 2026')

    const secondCells = within(second).getAllByRole('cell')
    expect(within(second).getByTestId('couverture-absente')).toBeInTheDocument()
    expect(secondCells[1]).toHaveTextContent('—')
    expect(secondCells[2]).toHaveTextContent('Terminée')
    expect(secondCells[3]).toHaveTextContent('Premium1 gratuit')
    expect(secondCells[5]).toHaveTextContent('0,0 (3)')

    const thirdCells = within(third).getAllByRole('cell')
    expect(thirdCells[2]).toHaveTextContent('—')
    expect(thirdCells[3]).toHaveTextContent('Gratuit')
    expect(thirdCells[4]).toHaveTextContent('0')
    expect(thirdCells[5]).toHaveTextContent('—')
    expect(thirdCells[6]).toHaveTextContent('—')
  })

  it('remplace une couverture qui ne se charge pas par le bloc par défaut', async () => {
    server.use(seriesHandler(1))
    renderRoutes(routes, '/series')
    await screen.findByText('Série 1')
    const [row] = bodyRows()
    if (row === undefined) throw new Error('Ligne manquante')

    fireEvent.error(within(row).getByRole('presentation'))

    expect(within(row).getByTestId('couverture-absente')).toBeInTheDocument()
    expect(within(row).queryByRole('presentation')).not.toBeInTheDocument()
  })

  it('active l’entrée « Séries » du menu (AC-11)', async () => {
    server.use(seriesHandler(45))
    renderRoutes(routes, '/series?page=2')

    await screen.findByText('Série 21')
    expect(screen.getByRole('link', { name: 'Séries' })).toHaveAttribute('aria-current', 'page')
  })
})

describe('page dans l’adresse (AC-9)', { timeout: 15_000 }, () => {
  it('« Page suivante » ajoute ?page=2 à l’historique et charge la page 2', async () => {
    const requests: SeriesRequest[] = []
    server.use(seriesHandler(45, { requests }))
    const { router } = renderRoutes(routes, '/series')
    await screen.findByText('Série 1')

    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }))

    expect(await screen.findByText('Série 21')).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series?page=2')
    expect(router.state.historyAction).toBe('PUSH')
    expect(requests.at(-1)).toEqual({ page: '2', limit: '20' })
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 })
    expect(screen.getByText('Page 2 sur 3')).toHaveAttribute('aria-live', 'polite')
  })

  it.each(['abc', '2abc', '1.5', '0', '99999'])('?page=%s vaut la page 1', async (raw) => {
    const requests: SeriesRequest[] = []
    server.use(seriesHandler(45, { requests }))
    renderRoutes(routes, `/series?page=${raw}`)

    expect(await screen.findByText('Série 1')).toBeInTheDocument()
    expect(requests.map((request) => request.page)).toEqual(['1'])
  })

  it('une page au delà de la fin remplace l’adresse par la dernière page', async () => {
    const requests: SeriesRequest[] = []
    server.use(seriesHandler(45, { requests }))
    const { router } = renderRoutes(routes, '/series?page=99')

    expect(await screen.findByText('Série 41')).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series?page=3')
    expect(router.state.historyAction).toBe('REPLACE')
    expect(screen.queryByText('Aucune série pour le moment')).not.toBeInTheDocument()
    expect(requests.map((request) => request.page)).toEqual(['99', '3'])
  })

  it('« Page précédente » vers la page 1 retire le paramètre de l’adresse', async () => {
    server.use(seriesHandler(45))
    const { router } = renderRoutes(routes, '/series?page=2')
    await screen.findByText('Série 21')

    await userEvent.click(screen.getByRole('button', { name: 'Page précédente' }))

    expect(await screen.findByText('Série 1')).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series')
  })

  it('ne demande jamais une autre taille de page que 20', async () => {
    const requests: SeriesRequest[] = []
    server.use(seriesHandler(45, { requests }))
    renderRoutes(routes, '/series?page=3&limit=50')

    expect(await screen.findByText('Série 41')).toBeInTheDocument()
    expect(requests.map((request) => request.limit)).toEqual(['20'])
  })

  it('revenir en arrière garde la page de l’adresse', async () => {
    server.use(seriesHandler(45))
    const { router } = renderRoutes(routes, '/series')
    await screen.findByText('Série 1')
    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }))
    await screen.findByText('Série 21')

    await act(async () => {
      await router.navigate(-1)
    })

    expect(await screen.findByText('Série 1')).toBeInTheDocument()
    expect(currentPath(router)).toBe('/series')
  })
})

describe('états (AC-10)', { timeout: 15_000 }, () => {
  it('affiche l’état vide', async () => {
    server.use(seriesHandler(0))
    renderRoutes(routes, '/series')

    expect(await screen.findByText('Aucune série pour le moment')).toBeInTheDocument()
    expect(
      screen.getByText("Les séries créées dans le dashboard ou par l'API apparaîtront ici."),
    ).toBeInTheDocument()
  })

  it('affiche l’erreur puis recharge avec « Réessayer »', async () => {
    const attempts = { count: 0 }
    server.use(
      http.get(`${API}/series`, () => {
        attempts.count += 1
        return HttpResponse.json({ message: 'Bad' }, { status: 400 })
      }),
    )
    renderRoutes(routes, '/series')

    const retry = await screen.findByRole('button', { name: 'Réessayer' })
    expect(attempts.count).toBe(1)

    server.use(seriesHandler(2))
    await userEvent.click(retry)

    expect(await screen.findByText('Série 1')).toBeInTheDocument()
  })

  it('garde l’écran d’erreur pendant « Réessayer », jusqu’à la réponse', async () => {
    const release: { resolve?: () => void } = {}
    const attempts = { count: 0 }
    server.use(
      http.get(`${API}/series`, async () => {
        attempts.count += 1
        if (attempts.count === 1) return HttpResponse.json({ message: 'Bad' }, { status: 400 })
        await new Promise<void>((resolve) => {
          release.resolve = resolve
        })
        return HttpResponse.json({
          data: { total: 1, page: 1, limit: 20, series: [makeSeries(1)] },
        })
      }),
    )
    renderRoutes(routes, '/series')
    await userEvent.click(await screen.findByRole('button', { name: 'Réessayer' }))

    await waitFor(() => {
      expect(release.resolve).toBeDefined()
    })
    expect(screen.getByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()

    release.resolve?.()
    expect(await screen.findByText('Série 1')).toBeInTheDocument()
  })

  it('n’appelle l’API qu’une fois sur une erreur 4xx (pas de réessai)', async () => {
    const attempts = { count: 0 }
    server.use(
      http.get(`${API}/series`, () => {
        attempts.count += 1
        return HttpResponse.json({ message: 'Not found' }, { status: 404 })
      }),
    )
    renderRoutes(routes, '/series')

    await screen.findByRole('button', { name: 'Réessayer' })
    expect(attempts.count).toBe(1)
  })

  it('garde les lignes précédentes grisées pendant le changement de page', async () => {
    const release: { resolve?: () => void } = {}
    server.use(
      http.get(`${API}/series`, async ({ request }) => {
        const page = new URL(request.url).searchParams.get('page')
        if (page === '2') {
          await new Promise<void>((resolve) => {
            release.resolve = resolve
          })
        }
        const start = page === '2' ? 20 : 0
        return HttpResponse.json({
          data: {
            total: 45,
            page: Number(page),
            limit: 20,
            series: Array.from({ length: 20 }, (_, offset) => makeSeries(start + offset + 1)),
          },
        })
      }),
    )
    renderRoutes(routes, '/series')
    await screen.findByText('Série 1')

    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }))

    await waitFor(() => {
      expect(screen.getByRole('table', { name: 'Liste des séries' })).toHaveAttribute(
        'aria-busy',
        'true',
      )
    })
    expect(screen.getByText('Série 1')).toBeInTheDocument()
    expect(screen.getByText('1 à 20 sur 45')).toBeInTheDocument()

    release.resolve?.()
    expect(await screen.findByText('Série 21')).toBeInTheDocument()
  })
})
