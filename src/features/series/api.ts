// Lectures et écritures des séries (specs 0004 à 0007), par le client API partagé.
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toApiQuery, type SeriesFilters } from '@/features/series/filters'
import {
  adminSeriesResponseSchema,
  deleteSeriesResponseSchema,
  seriesPageSchema,
  videoImportSchema,
  videoUploadLinkSchema,
  type AdminSeries,
  type VideoUploadLink,
} from '@/features/series/schemas'
import type { EpisodeCreatePayload, EpisodePatch } from '@/features/series/episodes/episodeForm'
import type { SeriesCreatePayload, SeriesPatch } from '@/features/series/seriesPayload'
import { apiRequest } from '@/shared/api/client'
import { isApiError } from '@/shared/api/errors'
import { seriesListsKey } from '@/shared/api/seriesKeys'

export const seriesKeys = {
  all: ['series'] as const,
  lists: seriesListsKey,
  list: (page: number, filters: SeriesFilters) => [...seriesListsKey, page, filters] as const,
  detail: (id: string) => ['series', 'detail', id] as const,
}

const DETAIL_STALE_TIME_MS = 30_000

/**
 * Page filtrée de la liste (spec 0009), par la route admin. `filters` vient de `parseFilters` ou
 * `makeFilters` (clés dans un ordre fixe). `enabled` attend les catégories quand l'adresse en filtre une.
 */
export function useSeriesPage(page: number, filters: SeriesFilters, enabled = true) {
  return useQuery({
    queryKey: seriesKeys.list(page, filters),
    queryFn: ({ signal }) =>
      apiRequest({
        method: 'GET',
        path: '/series/admin',
        query: { ...toApiQuery(filters, page) },
        schema: seriesPageSchema,
        signal,
      }),
    // Les lignes précédentes restent (grisées) pendant le chargement de la page ou du filtre suivant.
    placeholderData: keepPreviousData,
    enabled,
  })
}

/** Fiche admin d'une série ; désactivée pour un identifiant mal formé (AC-6). */
export function useSeriesDetail(
  id: string,
  enabled: boolean,
  // Relecture automatique tant qu'une vidéo est attendue (spec 0006, AC-9).
  refetchInterval: (series: AdminSeries | undefined) => number | false = () => false,
) {
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
    refetchInterval: (query) => refetchInterval(query.state.data),
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

// Épisodes et vidéos (spec 0006) : chaque écriture renvoie la série admin à jour.

function episodePath(id: string, seasonNumber: number, episodeNumber: number): string {
  return `/series/${id}/episodes/${String(seasonNumber)}/${String(episodeNumber)}`
}

async function seriesWrite(
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<AdminSeries> {
  const response = await apiRequest({ method, path, body, schema: adminSeriesResponseSchema })
  return response.series
}

export function addEpisode(id: string, payload: EpisodeCreatePayload): Promise<AdminSeries> {
  return seriesWrite('POST', `/series/${id}/episodes`, payload)
}

export function updateEpisode(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
  patch: EpisodePatch,
): Promise<AdminSeries> {
  return seriesWrite('PATCH', episodePath(id, seasonNumber, episodeNumber), patch)
}

export function deleteEpisode(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
): Promise<AdminSeries> {
  return seriesWrite('DELETE', episodePath(id, seasonNumber, episodeNumber))
}

/** Lien d'envoi à usage unique vers Cloudflare (méthode post jusqu'à 200 Mo, tus au delà). */
export function requestVideoUpload(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
  uploadLength: number,
): Promise<VideoUploadLink> {
  return apiRequest({
    method: 'POST',
    path: `${episodePath(id, seasonNumber, episodeNumber)}/video/upload`,
    body: { uploadLength },
    schema: videoUploadLinkSchema,
  })
}

export async function importVideo(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
  url: string,
): Promise<void> {
  await apiRequest({
    method: 'POST',
    path: `${episodePath(id, seasonNumber, episodeNumber)}/video/import`,
    body: { url: url.trim() },
    schema: videoImportSchema,
  })
}

/** Migration : le backend importe le lien collé qu'il a déjà, sans le renvoyer (AC-8). */
export async function importPastedVideo(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
): Promise<void> {
  await apiRequest({
    method: 'POST',
    path: `${episodePath(id, seasonNumber, episodeNumber)}/video/import`,
    body: { fromPastedLink: true },
    schema: videoImportSchema,
  })
}

export function refreshVideo(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
): Promise<AdminSeries> {
  return seriesWrite('POST', `${episodePath(id, seasonNumber, episodeNumber)}/video/refresh`)
}

export function removeVideo(
  id: string,
  seasonNumber: number,
  episodeNumber: number,
): Promise<AdminSeries> {
  return seriesWrite('DELETE', `${episodePath(id, seasonNumber, episodeNumber)}/video`)
}

// Images (spec 0007) : un emplacement = une route PUT (envoi, champ multipart « file ») et une DELETE.

export type ImageTarget =
  | { readonly kind: 'cover' | 'banner' }
  | { readonly kind: 'thumbnail'; readonly seasonNumber: number; readonly episodeNumber: number }

function imagePath(id: string, target: ImageTarget): string {
  return target.kind === 'thumbnail'
    ? `${episodePath(id, target.seasonNumber, target.episodeNumber)}/thumbnail`
    : `/series/${id}/${target.kind}`
}

export function uploadImage(id: string, target: ImageTarget, file: File): Promise<AdminSeries> {
  const body = new FormData()
  body.append('file', file)
  return seriesWrite('PUT', imagePath(id, target), body)
}

export function removeImage(id: string, target: ImageTarget): Promise<AdminSeries> {
  return seriesWrite('DELETE', imagePath(id, target))
}

/**
 * Envoi et retrait d'une image. Le cache est mis à jour ici, même si l'emplacement a été démonté
 * entre temps ; un 409 ou un 404 fait relire la fiche (la réponse ne porte pas de série).
 */
export function useImageMutations(id: string, target: ImageTarget) {
  const queryClient = useQueryClient()
  const onSuccess = (series: AdminSeries) => {
    queryClient.setQueryData(seriesKeys.detail(id), series)
    void queryClient.invalidateQueries({ queryKey: seriesKeys.lists })
  }
  const onError = (error: unknown) => {
    if (
      isApiError(error) &&
      error.kind === 'http' &&
      (error.status === 409 || error.status === 404)
    ) {
      void queryClient.invalidateQueries({ queryKey: seriesKeys.detail(id) })
    }
  }
  const upload = useMutation({
    mutationFn: (file: File) => uploadImage(id, target, file),
    onSuccess,
    onError,
  })
  const remove = useMutation({
    mutationFn: () => removeImage(id, target),
    onSuccess,
    onError,
  })
  return { upload, remove }
}
