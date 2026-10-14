// Lectures et écritures des séries (specs 0004 et 0005), par le client API partagé.
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SERIES_PAGE_SIZE } from '@/features/series/page'
import {
  adminSeriesResponseSchema,
  allCategoriesSchema,
  deleteSeriesResponseSchema,
  seriesPageSchema,
  type AdminSeries,
} from '@/features/series/schemas'
import type { SeriesCreatePayload, SeriesPatch } from '@/features/series/seriesPayload'
import { apiRequest } from '@/shared/api/client'

export const seriesKeys = {
  all: ['series'] as const,
  lists: ['series', 'list'] as const,
  list: (page: number) => ['series', 'list', page] as const,
  detail: (id: string) => ['series', 'detail', id] as const,
}

export const categoriesKeys = {
  all: ['categories', 'all'] as const,
}

const DETAIL_STALE_TIME_MS = 30_000
const CATEGORIES_STALE_TIME_MS = 5 * 60_000

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

/** Fiche admin d'une série ; désactivée pour un identifiant mal formé (AC-6). */
export function useSeriesDetail(id: string, enabled: boolean) {
  return useQuery({
    queryKey: seriesKeys.detail(id),
    queryFn: async ({ signal }) => {
      const response = await apiRequest({
        method: 'GET',
        path: `/series/${id}/admin`,
        schema: adminSeriesResponseSchema,
        signal,
      })
      return response.series
    },
    enabled,
    staleTime: DETAIL_STALE_TIME_MS,
    refetchOnWindowFocus: false,
  })
}

/** Toutes les catégories, masquées comprises (AC-9). */
export function useAllCategories() {
  return useQuery({
    queryKey: categoriesKeys.all,
    queryFn: async ({ signal }) => {
      const response = await apiRequest({
        method: 'GET',
        path: '/categories/all',
        schema: allCategoriesSchema,
        signal,
      })
      return response.categories
    },
    staleTime: CATEGORIES_STALE_TIME_MS,
  })
}

export async function createSeries(payload: SeriesCreatePayload): Promise<AdminSeries> {
  const response = await apiRequest({
    method: 'POST',
    path: '/series',
    body: payload,
    schema: adminSeriesResponseSchema,
  })
  return response.series
}

export async function updateSeries(id: string, patch: SeriesPatch): Promise<AdminSeries> {
  const response = await apiRequest({
    method: 'PATCH',
    path: `/series/${id}`,
    body: patch,
    schema: adminSeriesResponseSchema,
  })
  return response.series
}

export async function deleteSeries(id: string): Promise<void> {
  await apiRequest({
    method: 'DELETE',
    path: `/series/${id}`,
    schema: deleteSeriesResponseSchema,
  })
}
