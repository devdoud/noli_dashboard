// Chiffres de la vue d'ensemble, par GET /series/admin/stats (spec 0010).
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest } from '@/shared/api/client'
import { seriesStatsKey } from '@/shared/api/seriesKeys'

const count = z.number().int().nonnegative()

export const seriesStatsSchema = z.object({
  data: z.object({
    series: count,
    episodes: count,
    videosToProcess: z.object({
      total: count,
      none: count,
      error: count,
      pending: count,
      legacy: count,
    }),
  }),
})

export type SeriesStats = z.infer<typeof seriesStatsSchema>['data']
export type VideosToProcess = SeriesStats['videosToProcess']

/** Redemandés à chaque arrivée sur l'accueil et au retour sur l'onglet (AC-6). */
export function useSeriesStats() {
  return useQuery({
    queryKey: seriesStatsKey,
    queryFn: async ({ signal }) => {
      const response = await apiRequest({
        method: 'GET',
        path: '/series/admin/stats',
        schema: seriesStatsSchema,
        signal,
      })
      return response.data
    },
    refetchOnMount: 'always',
  })
}
