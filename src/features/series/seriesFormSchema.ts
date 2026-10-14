// Valeurs et règles du formulaire de série (spec 0005, « Formulaire »). Fonctions pures.
import { z } from 'zod'
import type { AdminSeries } from '@/features/series/schemas'

export type SeriesStatus = 'ongoing' | 'completed'

export interface SeriesFormValues {
  readonly title: string
  readonly description: string
  readonly categoryIds: readonly string[]
  readonly status: SeriesStatus
  readonly languages: readonly string[]
  readonly country: string
  readonly releaseYear: number | ''
  readonly isPremium: boolean
  readonly freeEpisodeCount: number | ''
}

export type SeriesFormField = keyof SeriesFormValues

/** Ordre d'affichage des champs : le focus va sur le premier champ en erreur (AC-3). */
export const SERIES_FORM_FIELDS: readonly SeriesFormField[] = [
  'title',
  'description',
  'categoryIds',
  'status',
  'languages',
  'country',
  'releaseYear',
  'isPremium',
  'freeEpisodeCount',
]

export const TITLE_MAX = 100
export const DESCRIPTION_MAX = 2000
export const YEAR_MIN = 1888
export const YEAR_MAX = 2100
export const FREE_EPISODES_MAX = 10_000
export const LANGUAGE_CODE = /^[a-z]{2,3}$/

export const MESSAGES = {
  titleRequired: 'Titre requis.',
  titleTooLong: '100 caractères au plus.',
  descriptionTooLong: '2 000 caractères au plus.',
  categoriesRequired: 'Choisissez au moins une catégorie.',
  languageInvalid: 'Code de langue invalide (2 ou 3 lettres minuscules).',
  yearInvalid: 'Année entre 1888 et 2100.',
  yearRemoved: "L'année ne peut pas être retirée, seulement modifiée.",
  freeEpisodesInvalid: 'Nombre entier de 0 à 10 000.',
} as const

export const EMPTY_SERIES_FORM: SeriesFormValues = {
  title: '',
  description: '',
  categoryIds: [],
  status: 'ongoing',
  languages: [],
  country: '',
  releaseYear: '',
  isPremium: false,
  freeEpisodeCount: 0,
}

function toStatus(status: string | null | undefined): SeriesStatus {
  return status === 'completed' ? 'completed' : 'ongoing'
}

/** Valeurs de départ de la fiche, tirées de la réponse admin (spec 0005, « Value sourcing »). */
export function toFormValues(series: AdminSeries): SeriesFormValues {
  return {
    title: series.title,
    description: series.description ?? '',
    categoryIds: series.categories.map((category) => category._id),
    status: toStatus(series.status),
    languages: series.languages,
    country: series.country ?? '',
    releaseYear: series.releaseYear ?? '',
    isPremium: series.isPremium,
    freeEpisodeCount: series.freeEpisodeCount,
  }
}

function isWholeNumberIn(value: number | '', min: number, max: number): boolean {
  return value !== '' && Number.isInteger(value) && value >= min && value <= max
}

export interface SeriesSchemaOptions {
  readonly mode: 'create' | 'edit'
  /** Année enregistrée : en modification, elle ne peut pas être vidée (le backend refuse null). */
  readonly initialReleaseYear: number | ''
}

export function makeSeriesFormSchema({ mode, initialReleaseYear }: SeriesSchemaOptions) {
  return z
    .object({
      title: z
        .string()
        .refine((value) => value.trim().length > 0, MESSAGES.titleRequired)
        .refine((value) => value.trim().length <= TITLE_MAX, MESSAGES.titleTooLong),
      description: z
        .string()
        .refine((value) => value.trim().length <= DESCRIPTION_MAX, MESSAGES.descriptionTooLong),
      categoryIds: z.array(z.string()).min(1, MESSAGES.categoriesRequired),
      status: z.enum(['ongoing', 'completed']),
      languages: z.array(z.string()),
      country: z.string(),
      releaseYear: z.union([z.literal(''), z.number()]),
      isPremium: z.boolean(),
      freeEpisodeCount: z.union([z.literal(''), z.number()]),
    })
    .superRefine((values, context) => {
      // Une erreur par champ, sur le champ lui même (et non sur languages.1), pour l'afficher.
      if (values.languages.some((code) => !LANGUAGE_CODE.test(code))) {
        context.addIssue({ code: 'custom', path: ['languages'], message: MESSAGES.languageInvalid })
      }
      if (values.releaseYear === '') {
        if (mode === 'edit' && initialReleaseYear !== '') {
          context.addIssue({ code: 'custom', path: ['releaseYear'], message: MESSAGES.yearRemoved })
        }
      } else if (!isWholeNumberIn(values.releaseYear, YEAR_MIN, YEAR_MAX)) {
        context.addIssue({ code: 'custom', path: ['releaseYear'], message: MESSAGES.yearInvalid })
      }
      if (values.isPremium && !isWholeNumberIn(values.freeEpisodeCount, 0, FREE_EPISODES_MAX)) {
        context.addIssue({
          code: 'custom',
          path: ['freeEpisodeCount'],
          message: MESSAGES.freeEpisodesInvalid,
        })
      }
    })
}

/** Champ racine d'un chemin d'erreur (`languages.1` → `languages`). */
export function rootField(path: string): string {
  return path.split('.')[0] ?? path
}

/** Le premier champ en erreur, dans l'ordre d'affichage. */
export function firstInvalidField(
  errors: Readonly<Record<string, unknown>>,
): SeriesFormField | undefined {
  const roots = new Set(Object.keys(errors).map(rootField))
  return SERIES_FORM_FIELDS.find((field) => roots.has(field))
}

/** Identifiant DOM d'un champ du formulaire, pour le focus et les étiquettes. */
export function fieldId(field: SeriesFormField): string {
  return `serie-${field}`
}
