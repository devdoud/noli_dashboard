// Corps envoyés à l'API depuis le formulaire de série (spec 0005, « Formulaire »). Fonctions pures.
import type { SeriesFormField, SeriesFormValues } from '@/features/series/seriesFormSchema'

export interface SeriesCreatePayload {
  readonly title: string
  readonly categoryIds: readonly string[]
  readonly status: 'ongoing' | 'completed'
  readonly isPremium: boolean
  readonly freeEpisodeCount: number
  readonly description?: string
  readonly languages?: readonly string[]
  readonly country?: string
  readonly releaseYear?: number
}

export interface SeriesPatch {
  title?: string
  description?: string | null
  categoryIds?: readonly string[]
  status?: 'ongoing' | 'completed'
  languages?: readonly string[]
  country?: string | null
  releaseYear?: number
  isPremium?: boolean
  freeEpisodeCount?: number
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  const left = [...new Set(a)].sort()
  const right = [...new Set(b)].sort()
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/** Champs dont la valeur diffère de la base (textes comparés sans les espaces du bord). */
export function changedFields(
  base: SeriesFormValues,
  values: SeriesFormValues,
): ReadonlySet<SeriesFormField> {
  const changed = new Set<SeriesFormField>()
  if (values.title.trim() !== base.title.trim()) changed.add('title')
  if (values.description.trim() !== base.description.trim()) changed.add('description')
  if (!sameSet(values.categoryIds, base.categoryIds)) changed.add('categoryIds')
  if (values.status !== base.status) changed.add('status')
  if (!sameSet(values.languages, base.languages)) changed.add('languages')
  if (values.country.trim() !== base.country.trim()) changed.add('country')
  if (values.releaseYear !== base.releaseYear) changed.add('releaseYear')
  if (values.isPremium !== base.isPremium) changed.add('isPremium')
  if (values.freeEpisodeCount !== base.freeEpisodeCount) changed.add('freeEpisodeCount')
  return changed
}

/** Seuls les champs modifiés ; une description ou un pays vidés partent en null (AC-7). */
export function toSeriesPatch(base: SeriesFormValues, values: SeriesFormValues): SeriesPatch {
  const changed = changedFields(base, values)
  const patch: SeriesPatch = {}
  if (changed.has('title')) patch.title = values.title.trim()
  if (changed.has('description')) {
    const description = values.description.trim()
    patch.description = description === '' ? null : description
  }
  if (changed.has('categoryIds')) patch.categoryIds = [...new Set(values.categoryIds)]
  if (changed.has('status')) patch.status = values.status
  if (changed.has('languages')) patch.languages = [...new Set(values.languages)]
  if (changed.has('country')) {
    const country = values.country.trim()
    patch.country = country === '' ? null : country
  }
  // Jamais vide : le backend refuse releaseYear null en modification.
  if (changed.has('releaseYear') && values.releaseYear !== '') {
    patch.releaseYear = values.releaseYear
  }
  if (changed.has('isPremium')) patch.isPremium = values.isPremium
  if (changed.has('freeEpisodeCount') && values.freeEpisodeCount !== '') {
    patch.freeEpisodeCount = values.freeEpisodeCount
  }
  return patch
}

export function isEmptyPatch(patch: SeriesPatch): boolean {
  return Object.keys(patch).length === 0
}

/** Création : les champs remplis seulement, jamais null (AC-4). */
export function toCreatePayload(values: SeriesFormValues): SeriesCreatePayload {
  const description = values.description.trim()
  const country = values.country.trim()
  const languages = [...new Set(values.languages)]
  return {
    title: values.title.trim(),
    categoryIds: [...new Set(values.categoryIds)],
    status: values.status,
    isPremium: values.isPremium,
    freeEpisodeCount:
      values.isPremium && values.freeEpisodeCount !== '' ? values.freeEpisodeCount : 0,
    ...(description === '' ? {} : { description }),
    ...(languages.length === 0 ? {} : { languages }),
    ...(country === '' ? {} : { country }),
    ...(values.releaseYear === '' ? {} : { releaseYear: values.releaseYear }),
  }
}
