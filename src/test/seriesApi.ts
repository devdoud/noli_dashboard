import { http, HttpResponse } from 'msw'
import { API } from '@/test/apiBase'
import { categoriesHandler } from '@/test/categoriesApi'

// Réponses simulées de GET /series/admin pour les tests (specs 0004, 0009 et 0010).

export { API } from '@/test/apiBase'
export { ALL_CATEGORIES, categoriesHandler } from '@/test/categoriesApi'

export interface RawSeries {
  readonly _id: string
  readonly title: string
  readonly [key: string]: unknown
}

export function makeSeries(index: number, overrides: Partial<RawSeries> = {}): RawSeries {
  return {
    _id: `s${String(index)}`,
    title: `Série ${String(index)}`,
    coverImage: `https://res.cloudinary.com/noli/cover-${String(index)}.jpg`,
    categories: [{ _id: 'c1', name: 'Drame' }],
    status: 'ongoing',
    isPremium: false,
    freeEpisodeCount: 0,
    totalEpisodes: 12,
    rating: 8.4,
    votes: 120,
    updatedAt: '2026-03-05T10:00:00.000Z',
    ...overrides,
  }
}

export interface SeriesRequest {
  readonly page: string | null
  readonly limit: string | null
  readonly q: string | null
  readonly categoryId: string | null
  readonly premium: string | null
  readonly video: string | null
}

const fold = (text: string) => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function toProcess(series: RawSeries): number {
  return typeof series.videosToProcess === 'number' ? series.videosToProcess : 0
}

function hasCategory(series: RawSeries, id: string): boolean {
  const categories = series.categories
  return Array.isArray(categories) && categories.some((c) => (c as { _id?: unknown })._id === id)
}

/**
 * Catalogue de `total` séries, filtré et découpé comme la route admin (specs 0009 et 0010) :
 * titre contient, sans accents ni majuscules ; catégorie ; accès ; vidéos à traiter
 * (`video=todo`, d'après le `videosToProcess` de chaque série, renvoyé seulement avec ce filtre).
 * Une page au delà de la fin est vide.
 */
export function seriesHandler(
  total: number,
  options: {
    readonly requests?: SeriesRequest[]
    readonly items?: (index: number) => RawSeries
  } = {},
) {
  return http.get(`${API}/series/admin`, ({ request }) => {
    const url = new URL(request.url)
    const params = url.searchParams
    options.requests?.push({
      page: params.get('page'),
      limit: params.get('limit'),
      q: params.get('q'),
      categoryId: params.get('categoryId'),
      premium: params.get('premium'),
      video: params.get('video'),
    })
    const page = Number(params.get('page') ?? '1')
    const limit = Number(params.get('limit') ?? '20')
    const q = params.get('q')
    const categoryId = params.get('categoryId')
    const premium = params.get('premium')
    const todo = params.get('video') === 'todo'
    const matching = Array.from({ length: total }, (_, offset) =>
      (options.items ?? makeSeries)(offset + 1),
    ).filter(
      (series) =>
        (q === null || fold(series.title).includes(fold(q))) &&
        (categoryId === null || hasCategory(series, categoryId)) &&
        (premium === null || (series.isPremium === true) === (premium === 'true')) &&
        (!todo || toProcess(series) > 0),
    )
    const start = (page - 1) * limit
    const series = matching.slice(start, start + limit).map((item) => {
      // Comme la route : le compte n'est renvoyé qu'avec le filtre.
      const rest = Object.fromEntries(
        Object.entries(item).filter(([key]) => key !== 'videosToProcess'),
      )
      return todo ? { ...rest, videosToProcess: toProcess(item) } : rest
    })
    return HttpResponse.json({
      message: 'ok',
      data: { total: matching.length, page, limit, series },
    })
  })
}

/** La page de la liste lit aussi les catégories (filtre « Catégorie », spec 0009). */
export function seriesListHandlers(
  total: number,
  options: Parameters<typeof seriesHandler>[1] = {},
) {
  return [seriesHandler(total, options), categoriesHandler()] as const
}

// Fiche admin d'une série et catégories (spec 0005).

export const SERIES_ID = '6ac0e7848db827737b2141dc'

export function makeAdminSeries(overrides: Partial<RawSeries> = {}): RawSeries {
  return {
    ...makeSeries(1),
    _id: SERIES_ID,
    title: 'Le Secret du Docteur Mensah',
    description: 'Un médecin respecté cache un passé.',
    categories: [{ _id: 'c1', name: 'Drame', slug: 'drame', isVisible: true }],
    status: 'ongoing',
    languages: ['fr'],
    country: 'Bénin',
    releaseYear: 2025,
    isPremium: true,
    freeEpisodeCount: 3,
    totalEpisodes: 8,
    rating: 8.6,
    votes: 268,
    createdAt: '2026-10-03T12:31:00.000Z',
    updatedAt: '2026-10-14T15:12:00.000Z',
    episodes: [{ seasonNumber: 1, episodeNumber: 1, title: 'Épisode 1' }],
    ...overrides,
  }
}

export function adminSeriesHandler(series: RawSeries = makeAdminSeries()) {
  return http.get(`${API}/series/:id/admin`, ({ params }) =>
    params.id === series._id
      ? HttpResponse.json({ message: 'ok', series })
      : HttpResponse.json({ message: 'Series not found' }, { status: 404 }),
  )
}
