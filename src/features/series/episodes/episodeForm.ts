// Valeurs, règles et corps envoyés du formulaire d'épisode (spec 0006, « Fenêtre d'épisode »).
import { z } from 'zod'
import type { AdminEpisode } from '@/features/series/schemas'

export interface EpisodeFormValues {
  readonly seasonNumber: number | ''
  readonly episodeNumber: number | ''
  readonly title: string
  readonly durationMinutes: number | ''
  readonly durationSeconds: number | ''
  readonly description: string
  /** `AAAA-MM-JJ` ou vide. */
  readonly releaseDate: string
}

export type EpisodeFormField = keyof EpisodeFormValues

/** Ordre d'affichage : le focus va sur le premier champ en erreur (AC-3). */
export const EPISODE_FORM_FIELDS: readonly EpisodeFormField[] = [
  'seasonNumber',
  'episodeNumber',
  'title',
  'durationMinutes',
  'durationSeconds',
  'description',
  'releaseDate',
]

export const EPISODE_MESSAGES = {
  season: 'Saison entre 1 et 100.',
  episode: 'Numéro entre 1 et 1 000.',
  titleRequired: 'Titre requis.',
  titleTooLong: '100 caractères au plus.',
  durationMin: "Durée d'au moins 1 seconde.",
  seconds: 'Secondes entre 0 et 59.',
  minutes: 'Minutes entre 0 et 600.',
  descriptionTooLong: '1 000 caractères au plus.',
  dateInvalid: 'Date invalide.',
  dateRemoved: 'La date de sortie ne peut pas être retirée, seulement modifiée.',
  link: 'Lien https valide requis.',
} as const

export const EPISODE_DESCRIPTION_MAX = 1000
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function wholeIn(value: number | '', min: number, max: number): boolean {
  return value !== '' && Number.isInteger(value) && value >= min && value <= max
}

/** Secondes totales ; 0 si un champ est vide. */
export function totalSeconds(
  values: Pick<EpisodeFormValues, 'durationMinutes' | 'durationSeconds'>,
): number {
  const minutes = values.durationMinutes === '' ? 0 : values.durationMinutes
  const seconds = values.durationSeconds === '' ? 0 : values.durationSeconds
  return minutes * 60 + seconds
}

export function splitDuration(seconds: number | null | undefined): {
  durationMinutes: number
  durationSeconds: number
} {
  const total = seconds === null || seconds === undefined || seconds <= 0 ? 0 : Math.round(seconds)
  return { durationMinutes: Math.floor(total / 60), durationSeconds: total % 60 }
}

/** `AAAA-MM-JJ` en UTC, ou vide. */
export function toDayInput(iso: string | null | undefined): string {
  if (iso === null || iso === undefined) return ''
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

/** Jour saisi envoyé à midi UTC (spec 0006, « Date »). */
export function toNoonUtc(day: string): string {
  return `${day}T12:00:00.000Z`
}

function isValidDay(day: string): boolean {
  if (!ISO_DAY.test(day)) return false
  const date = new Date(toNoonUtc(day))
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day
}

/** Lien `https` valide avec un nom d'hôte à point (même règle que le backend). */
export function isHttpsLink(raw: string): boolean {
  try {
    const url = new URL(raw.trim())
    return url.protocol === 'https:' && url.hostname.includes('.')
  } catch {
    return false
  }
}

export interface EpisodeSchemaOptions {
  readonly mode: 'create' | 'edit'
  readonly initialReleaseDate: string
}

export function makeEpisodeSchema({ mode, initialReleaseDate }: EpisodeSchemaOptions) {
  return z
    .object({
      seasonNumber: z.union([z.literal(''), z.number()]),
      episodeNumber: z.union([z.literal(''), z.number()]),
      title: z
        .string()
        .refine((value) => value.trim().length > 0, EPISODE_MESSAGES.titleRequired)
        .refine((value) => value.trim().length <= 100, EPISODE_MESSAGES.titleTooLong),
      durationMinutes: z.union([z.literal(''), z.number()]),
      durationSeconds: z.union([z.literal(''), z.number()]),
      description: z
        .string()
        .refine(
          (value) => value.trim().length <= EPISODE_DESCRIPTION_MAX,
          EPISODE_MESSAGES.descriptionTooLong,
        ),
      releaseDate: z.string(),
    })
    .superRefine((values, context) => {
      if (mode === 'create') {
        if (!wholeIn(values.seasonNumber, 1, 100)) {
          context.addIssue({
            code: 'custom',
            path: ['seasonNumber'],
            message: EPISODE_MESSAGES.season,
          })
        }
        if (!wholeIn(values.episodeNumber, 1, 1000)) {
          context.addIssue({
            code: 'custom',
            path: ['episodeNumber'],
            message: EPISODE_MESSAGES.episode,
          })
        }
      }
      const minutes = values.durationMinutes === '' ? 0 : values.durationMinutes
      const seconds = values.durationSeconds === '' ? 0 : values.durationSeconds
      if (!wholeIn(minutes, 0, 600)) {
        context.addIssue({
          code: 'custom',
          path: ['durationMinutes'],
          message: EPISODE_MESSAGES.minutes,
        })
      } else if (!wholeIn(seconds, 0, 59)) {
        context.addIssue({
          code: 'custom',
          path: ['durationSeconds'],
          message: EPISODE_MESSAGES.seconds,
        })
      } else if (minutes * 60 + seconds < 1) {
        context.addIssue({
          code: 'custom',
          path: ['durationMinutes'],
          message: EPISODE_MESSAGES.durationMin,
        })
      }
      const day = values.releaseDate.trim()
      if (day === '') {
        if (mode === 'edit' && initialReleaseDate !== '') {
          context.addIssue({
            code: 'custom',
            path: ['releaseDate'],
            message: EPISODE_MESSAGES.dateRemoved,
          })
        }
      } else if (!isValidDay(day)) {
        context.addIssue({
          code: 'custom',
          path: ['releaseDate'],
          message: EPISODE_MESSAGES.dateInvalid,
        })
      }
    })
}

export function emptyEpisodeForm(seasonNumber: number, episodeNumber: number): EpisodeFormValues {
  return {
    seasonNumber,
    episodeNumber,
    title: '',
    durationMinutes: 0,
    durationSeconds: 0,
    description: '',
    releaseDate: '',
  }
}

export function toEpisodeFormValues(episode: AdminEpisode): EpisodeFormValues {
  return {
    seasonNumber: episode.seasonNumber,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    ...splitDuration(episode.duration),
    description: episode.description ?? '',
    releaseDate: toDayInput(episode.releaseDate),
  }
}

export interface EpisodeCreatePayload {
  readonly seasonNumber: number
  readonly episodeNumber: number
  readonly title: string
  readonly duration: number
  readonly description?: string
  readonly releaseDate?: string
}

/** Ajout : champs remplis seulement, jamais null ni lien vidéo (AC-4). */
export function toEpisodeCreatePayload(values: EpisodeFormValues): EpisodeCreatePayload {
  const description = values.description.trim()
  const day = values.releaseDate.trim()
  return {
    seasonNumber: values.seasonNumber === '' ? 1 : values.seasonNumber,
    episodeNumber: values.episodeNumber === '' ? 1 : values.episodeNumber,
    title: values.title.trim(),
    duration: totalSeconds(values),
    ...(description === '' ? {} : { description }),
    ...(day === '' ? {} : { releaseDate: toNoonUtc(day) }),
  }
}

export type EpisodeEditableField = 'title' | 'duration' | 'description' | 'releaseDate'

/** Champs modifiés par rapport à la copie figée (une seule définition de « modifié »). */
export function changedEpisodeFields(
  base: EpisodeFormValues,
  values: EpisodeFormValues,
): ReadonlySet<EpisodeEditableField> {
  const changed = new Set<EpisodeEditableField>()
  if (values.title.trim() !== base.title.trim()) changed.add('title')
  if (
    totalSeconds(values) !== totalSeconds(base) ||
    values.durationMinutes !== base.durationMinutes ||
    values.durationSeconds !== base.durationSeconds
  ) {
    changed.add('duration')
  }
  if (values.description.trim() !== base.description.trim()) changed.add('description')
  if (values.releaseDate.trim() !== base.releaseDate.trim()) changed.add('releaseDate')
  return changed
}

export interface EpisodePatch {
  title?: string
  duration?: number
  description?: string | null
  releaseDate?: string
}

/** Seuls les champs modifiés ; jamais saison, numéro, date vide ni lien (AC-6). */
export function toEpisodePatch(base: EpisodeFormValues, values: EpisodeFormValues): EpisodePatch {
  const changed = changedEpisodeFields(base, values)
  const patch: EpisodePatch = {}
  if (changed.has('title')) patch.title = values.title.trim()
  if (changed.has('duration') && totalSeconds(values) >= 1) patch.duration = totalSeconds(values)
  if (changed.has('description')) {
    const description = values.description.trim()
    patch.description = description === '' ? null : description
  }
  if (changed.has('releaseDate') && values.releaseDate.trim() !== '') {
    patch.releaseDate = toNoonUtc(values.releaseDate.trim())
  }
  return patch
}

/** Champ du formulaire visé par une erreur de validation sur un champ modifié. */
export function fieldOfEditable(field: EpisodeEditableField): readonly EpisodeFormField[] {
  return field === 'duration' ? ['durationMinutes', 'durationSeconds'] : [field]
}

export function episodeFieldId(field: EpisodeFormField): string {
  return `episode-${field}`
}
