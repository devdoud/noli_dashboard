import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/routes'
import { seriesStatsKey } from '@/shared/api/seriesKeys'
import { resetSessionForTests } from '@/shared/session/session'
import { STATS, statsHandler } from '@/test/overviewApi'
import { renderRoutes } from '@/test/render'
import { API, makeSeries, seriesListHandlers, type SeriesRequest } from '@/test/seriesApi'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

// Vue d'ensemble (spec 0010), de bout en bout sur l'API simulée.

const NNBSP = ' '

beforeEach(() => {
  signInForTests()
  window.scrollTo = vi.fn()
})

afterEach(() => {
  resetSessionForTests()
})

describe('vue d’ensemble (spec 0010)', { timeout: 20_000 }, () => {
  it('montre les trois chiffres, le détail et des liens nommés (AC-1, AC-2, AC-3, AC-8)', async () => {
    server.use(statsHandler())
    renderRoutes(routes)

    const series = await screen.findByRole('link', { name: '12 séries, voir la liste des séries' })
    expect(series).toHaveAttribute('href', '/series')
    expect(within(series).getByRole('heading', { level: 2, name: 'Séries' })).toBeInTheDocument()
    expect(within(series).getByText('12')).toBeInTheDocument()

    const episodes = screen.getByRole('link', { name: '140 épisodes, voir la liste des séries' })
    expect(episodes).toHaveAttribute('href', '/series')

    const videos = screen.getByRole('link', {
      name: '7 vidéos à traiter, voir les séries concernées',
    })
    expect(videos).toHaveAttribute('href', '/series?videos=a-traiter')
    expect(within(videos).getByText('2 sans vidéo · 1 en erreur · 4 anciens liens')).toBeVisible()

    expect(screen.getByRole('heading', { level: 1, name: "Vue d'ensemble" })).toBeInTheDocument()
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent)
    expect(headings).toEqual(['Séries', 'Épisodes', 'Vidéos à traiter'])
  })

  it('ne garde plus les cartes provisoires (AC-9)', async () => {
    server.use(statsHandler())
    renderRoutes(routes)
    await screen.findByRole('link', { name: /12 séries/ })

    expect(screen.queryByText('Séries et épisodes')).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Images' })).toBeNull()
    expect(screen.queryByRole('heading', { name: 'Catégories' })).toBeNull()
  })

  it('écrit les grands nombres à la française (AC-1)', async () => {
    server.use(
      statsHandler({
        ...STATS,
        episodes: 12_345,
      }),
    )
    renderRoutes(routes)

    const episodes = await screen.findByRole('link', { name: /épisodes, voir/ })
    const value = within(episodes).getByText((_, el) => el?.textContent === `12${NNBSP}345`)
    expect(value).toBeInTheDocument()
  })

  it('à zéro : « Tout est prêt », sans lien, avec un nom accessible (AC-3, AC-8)', async () => {
    server.use(
      statsHandler({
        ...STATS,
        videosToProcess: { total: 0, none: 0, error: 0, pending: 0, legacy: 0 },
      }),
    )
    renderRoutes(routes)

    const tile = await screen.findByRole('group', { name: '0 vidéo à traiter, tout est prêt' })
    expect(within(tile).getByText('Tout est prêt')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /vidéo à traiter/ })).toBeNull()
    expect(screen.getAllByRole('link', { name: /voir la liste des séries/ })).toHaveLength(2)
  })

  it('montre des squelettes pendant le chargement (AC-7)', async () => {
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    server.use(
      http.get(`${API}/series/admin/stats`, async () => {
        await gate
        return HttpResponse.json({ message: 'ok', data: STATS })
      }),
    )
    const { container } = renderRoutes(routes)

    await waitFor(() => {
      expect(container.querySelector('[aria-busy="true"]')).not.toBeNull()
    })
    release()
    expect(await screen.findByRole('link', { name: /12 séries/ })).toBeInTheDocument()
    expect(container.querySelector('[aria-busy="true"]')).toBeNull()
  })

  it('en erreur : message et « Réessayer », qui redemande les chiffres (AC-7)', async () => {
    // Un 5xx est relancé deux fois (spec 0002) : les trois premiers appels échouent.
    let calls = 0
    server.use(
      http.get(`${API}/series/admin/stats`, () => {
        calls += 1
        return calls <= 3
          ? HttpResponse.json({ message: 'boom' }, { status: 500 })
          : HttpResponse.json({ message: 'ok', data: STATS })
      }),
    )
    renderRoutes(routes)

    const retry = await screen.findByRole('button', { name: 'Réessayer' }, { timeout: 10_000 })
    expect(screen.queryByRole('link', { name: /séries, voir/ })).toBeNull()
    await userEvent.click(retry)

    expect(await screen.findByRole('link', { name: /12 séries/ })).toBeInTheDocument()
  })

  it('redemande les chiffres à chaque arrivée sur l’accueil, cache compris (AC-6)', async () => {
    const calls = { count: 0 }
    server.use(statsHandler(STATS, calls), ...seriesListHandlers(3))
    const { router } = renderRoutes(routes)
    await screen.findByRole('link', { name: /12 séries/ })
    expect(calls.count).toBe(1)

    await userEvent.click(screen.getByRole('link', { name: /12 séries/ }))
    await screen.findByRole('heading', { level: 1, name: 'Séries' })
    await userEvent.click(screen.getByRole('link', { name: "Vue d'ensemble" }))

    await waitFor(() => {
      expect(calls.count).toBe(2)
    })
    expect(router.state.location.pathname).toBe('/')
  })

  it('les chiffres périment avec les listes de séries (AC-6)', async () => {
    const calls = { count: 0 }
    server.use(statsHandler(STATS, calls))
    const { queryClient } = renderRoutes(routes)
    await screen.findByRole('link', { name: /12 séries/ })

    await queryClient.invalidateQueries({ queryKey: ['series', 'list'] })

    expect(calls.count).toBe(2)
    expect(seriesStatsKey.slice(0, 2)).toEqual(['series', 'list'])
  })

  it('la tuile mène à la liste filtrée, avec le compte par ligne (AC-3, AC-4, AC-5)', async () => {
    const requests: SeriesRequest[] = []
    server.use(
      statsHandler(),
      ...seriesListHandlers(3, {
        requests,
        items: (index) =>
          makeSeries(index, { title: `Série ${String(index)}`, videosToProcess: index - 1 }),
      }),
    )
    const { router } = renderRoutes(routes)

    await userEvent.click(await screen.findByRole('link', { name: /7 vidéos à traiter/ }))

    expect(await screen.findByText('2 vidéos à traiter')).toBeInTheDocument()
    expect(screen.getByText('1 vidéo à traiter')).toBeInTheDocument()
    expect(screen.queryByText('Série 1')).toBeNull()
    expect(router.state.location.search).toBe('?videos=a-traiter')
    const videos = screen.getByRole('group', { name: 'Vidéos' })
    expect(within(videos).getByRole('radio', { name: 'À traiter' })).toBeChecked()
    expect(requests.at(-1)).toMatchObject({ video: 'todo', page: '1' })
    expect(await screen.findByText('2 séries trouvées')).toBeInTheDocument()
  })
})
