/**
 * Formatage des dates et durées en français (spec 0003, AC-11, table « Formatage »).
 * Fonctions pures, fuseau du navigateur ; une valeur absente ou invalide donne « — ».
 */
export const MISSING_VALUE = '—'

const dateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
})

const dateTimeFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

function toDate(iso: string | null | undefined): Date | undefined {
  if (iso === undefined || iso === null || iso.trim() === '') return undefined
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? undefined : date
}

const utcDateFormat = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

export interface FormatDateOptions {
  /** `'UTC'` : le jour tel qu'enregistré, quel que soit le fuseau du navigateur (spec 0006). */
  readonly timeZone?: 'UTC'
}

export function formatDate(
  iso: string | null | undefined,
  options: FormatDateOptions = {},
): string {
  const date = toDate(iso)
  if (date === undefined) return MISSING_VALUE
  return (options.timeZone === 'UTC' ? utcDateFormat : dateFormat).format(date)
}

export function formatDateTime(iso: string | null | undefined): string {
  const date = toDate(iso)
  return date === undefined ? MISSING_VALUE : dateTimeFormat.format(date)
}

/** Durée en secondes (unité de l'API) : « 25 min », « 1 h 05 », « moins d'1 min ». */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds === undefined || seconds === null) return MISSING_VALUE
  if (!Number.isFinite(seconds) || seconds <= 0) return MISSING_VALUE
  if (seconds < 60) return "moins d'1 min"
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours === 0) return `${String(minutes)} min`
  return `${String(hours)} h ${String(minutes).padStart(2, '0')}`
}
