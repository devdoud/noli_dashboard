import { http, HttpResponse } from 'msw'

// Réponses simulées de GET /series pour les tests (spec 0004).

export const API = 'http://api.test'

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
}

/** Catalogue de `total` séries, découpé comme le backend (une page au delà de la fin est vide). */
export function seriesHandler(
  total: number,
  options: {
    readonly requests?: SeriesRequest[]
    readonly items?: (index: number) => RawSeries
  } = {},
) {
  return http.get(`${API}/series`, ({ request }) => {
    const url = new URL(request.url)
    options.requests?.push({
      page: url.searchParams.get('page'),
      limit: url.searchParams.get('limit'),
    })
    const page = Number(url.searchParams.get('page') ?? '1')
    const limit = Number(url.searchParams.get('limit') ?? '20')
    const start = (page - 1) * limit
    const count = Math.max(0, Math.min(limit, total - start))
    const series = Array.from({ length: count }, (_, offset) =>
      (options.items ?? makeSeries)(start + offset + 1),
    )
    return HttpResponse.json({ message: 'ok', data: { total, page, limit, series } })
  })
}
