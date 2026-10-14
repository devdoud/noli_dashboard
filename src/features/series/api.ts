// Lecture paginée des séries (spec 0004, AC-8, AC-10), par le client API partagé.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SERIES_PAGE_SIZE } from '@/features/series/page'
import { seriesPageSchema } from '@/features/series/schemas'
import { apiRequest } from '@/shared/api/client'

export const seriesKeys = {
  all: ['series'] as const,
  list: (page: number) => ['series', 'list', page] as const,
}

export function useSeriesPage(page: number) {
  return useQuery({
    queryKey: seriesKeys.list(page),
    queryFn: ({ signal }) =>
      apiRequest({
        method: 'GET',
        path: '/series',
        query: { page, limit: SERIES_PAGE_SIZE },
        schema: seriesPageSchema,
        signal,
      }),
    // Les lignes de la page précédente restent (grisées) pendant le chargement de la suivante.
    placeholderData: keepPreviousData,
  })
}
