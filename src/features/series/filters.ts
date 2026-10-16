// Filtres de la liste des séries lus dans l'adresse (spec 0009, AC-4, AC-5). Fonctions pures.
import { SERIES_PAGE_SIZE } from '@/features/series/page'

export type SeriesAccess = 'premium' | 'gratuites'

export interface SeriesFilters {
  readonly q?: string
  readonly categoryId?: string
  readonly access?: SeriesAccess
}

export const SEARCH_MIN_LENGTH = 2
export const SEARCH_MAX_LENGTH = 100

const OBJECT_ID = /^[0-9a-f]{24}$/i

/** Texte nettoyé : espaces du bord retirés, espaces internes répétés réduits à un. */
export function normalizeSearch(text: string): string {
  return text.trim().replace(/\s+/g, ' ')
}

/** Recherche à appliquer pour un texte saisi : absente sous 2 ou au delà de 100 caractères. */
export function searchValue(text: string | null | undefined): string | undefined {
  if (text === null || text === undefined) return undefined
  const normalized = normalizeSearch(text)
  return normalized.length >= SEARCH_MIN_LENGTH && normalized.length <= SEARCH_MAX_LENGTH
    ? normalized
    : undefined
}

function parseAccess(raw: string | null): SeriesAccess | undefined {
  return raw === 'premium' || raw === 'gratuites' ? raw : undefined
}

/** Filtres construits clé par clé, dans un ordre fixe et sans clé absente (clé de cache stable). */
export function makeFilters(filters: SeriesFilters): SeriesFilters {
  return {
    ...(filters.q === undefined ? {} : { q: filters.q }),
    ...(filters.categoryId === undefined ? {} : { categoryId: filters.categoryId }),
    ...(filters.access === undefined ? {} : { access: filters.access }),
  }
}

/** Filtres valides de l'adresse ; un filtre invalide est ignoré. */
export function parseFilters(params: URLSearchParams): SeriesFilters {
  const categoryId = params.get('categorie')
  return makeFilters({
    q: searchValue(params.get('q')),
    categoryId: categoryId !== null && OBJECT_ID.test(categoryId) ? categoryId : undefined,
    access: parseAccess(params.get('acces')),
  })
}

/** Adresse de la liste, dans l'ordre q, categorie, acces, page (page omise si elle vaut 1). */
export function withFilters(filters: SeriesFilters, page: number): URLSearchParams {
  const params = new URLSearchParams()
  if (filters.q !== undefined) params.set('q', filters.q)
  if (filters.categoryId !== undefined) params.set('categorie', filters.categoryId)
  if (filters.access !== undefined) params.set('acces', filters.access)
  if (page > 1) params.set('page', String(page))
  return params
}

export function hasFilters(filters: SeriesFilters): boolean {
  return filters.q !== undefined || filters.categoryId !== undefined || filters.access !== undefined
}

export interface SeriesApiQuery {
  readonly page: number
  readonly limit: number
  readonly q?: string
  readonly categoryId?: string
  readonly premium?: 'true' | 'false'
}

/** Paramètres de GET /series/admin. */
export function toApiQuery(filters: SeriesFilters, page: number): SeriesApiQuery {
  return {
    page: Math.max(1, page),
    limit: SERIES_PAGE_SIZE,
    ...(filters.q === undefined ? {} : { q: filters.q }),
    ...(filters.categoryId === undefined ? {} : { categoryId: filters.categoryId }),
    ...(filters.access === undefined
      ? {}
      : { premium: filters.access === 'premium' ? 'true' : 'false' }),
  }
}

export function resultCountText(total: number): string {
  return total > 1 ? `${String(total)} séries trouvées` : `${String(total)} série trouvée`
}
