import { http, HttpResponse } from 'msw'
import { API } from '@/test/apiBase'

// Réponse simulée de GET /series/admin/stats pour les tests (spec 0010).

export interface RawStats {
  readonly series: number
  readonly episodes: number
  readonly videosToProcess: {
    readonly total: number
    readonly none: number
    readonly error: number
    readonly pending: number
    readonly legacy: number
  }
}

export const STATS: RawStats = {
  series: 12,
  episodes: 140,
  videosToProcess: { total: 7, none: 2, error: 1, pending: 0, legacy: 4 },
}

export function statsHandler(stats: RawStats = STATS, calls?: { count: number }) {
  return http.get(`${API}/series/admin/stats`, () => {
    if (calls !== undefined) calls.count += 1
    return HttpResponse.json({ message: 'Series stats retrieved', data: stats })
  })
}
