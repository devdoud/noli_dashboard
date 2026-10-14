// Petites règles de navigation et de confirmation de la fiche série (spec 0005). Fonctions pures.

export const SERIES_LIST_PATH = '/series'
const SERIES_ID = /^[0-9a-f]{24}$/i

/** Identifiant MongoDB bien formé ; sinon « Série introuvable » sans appel à l'API (AC-6). */
export function isSeriesId(id: string | undefined): id is string {
  return id !== undefined && SERIES_ID.test(id)
}

export function seriesPath(id: string): string {
  return `${SERIES_LIST_PATH}/${id}`
}

/** Page de liste d'où l'on vient (état `from`), acceptée seulement sous /series. */
export function backToListPath(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) return SERIES_LIST_PATH
  const from = state.from
  if (typeof from !== 'string') return SERIES_LIST_PATH
  const safe =
    (from === SERIES_LIST_PATH || from.startsWith('/series?') || from.startsWith('/series/')) &&
    !from.includes('//') &&
    !from.includes('\\')
  return safe ? from : SERIES_LIST_PATH
}

/** Normalisation commune pour retaper un titre : NFC, espaces regroupés, bords retirés (AC-13). */
export function normalizeTitle(title: string): string {
  return title.normalize('NFC').replace(/\s+/gu, ' ').trim()
}

export function titleMatches(typed: string, title: string): boolean {
  const expected = normalizeTitle(title)
  return expected !== '' && normalizeTitle(typed) === expected
}
