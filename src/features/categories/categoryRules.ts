// Règles des catégories (spec 0008, AC-3 à AC-5, AC-8) : forme des noms, adresse, corps envoyés,
// lecture des refus du backend. Fonctions pures ; `slugify` reprend la règle du backend (spec 0003).
import { z } from 'zod'
import type { Category } from '@/shared/api/categories'
import { isApiError } from '@/shared/api/errors'

const DIACRITICS = /[̀-ͯ]/g

/** « Comédie romantique » → « comedie-romantique » : même règle que le backend. */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(DIACRITICS, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export const RESERVED_SLUGS: readonly string[] = ['all', 'order']
export const SLUG_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/
export const NAME_MAX = 50
export const DESCRIPTION_MAX = 300

export const CATEGORY_MESSAGES = {
  nameRequired: 'Nom requis.',
  nameTooLong: '50 caractères au plus.',
  nameNoAlnum: 'Le nom doit contenir au moins une lettre ou un chiffre.',
  nameReserved: 'Ce nom est réservé, choisissez en un autre.',
  nameTaken: "Trop proche d'une catégorie existante.",
  descriptionTooLong: '300 caractères au plus.',
  slugPattern: 'Lettres minuscules, chiffres et tirets seulement (par exemple comedie-romantique).',
  slugReserved: 'Cette adresse est réservée.',
  slugTaken: 'Adresse déjà utilisée par une autre catégorie.',
  gone: "Cette catégorie n'existe plus.",
  orderChanged:
    "La liste a changé entre temps : l'ordre enregistré a été rechargé. Recommencez le déplacement.",
  blockedByOrder: 'Enregistrez ou annulez le nouvel ordre pour continuer.',
} as const

type Named = Pick<Category, '_id' | 'name'>
type Addressed = Pick<Category, '_id' | 'name' | 'slug'>

/** Message de refus du nom (AC-3), ou undefined ; `others` = la liste du serveur. */
export function nameError(
  rawName: string,
  others: readonly Named[],
  selfId?: string,
): string | undefined {
  const name = rawName.trim()
  if (name === '') return CATEGORY_MESSAGES.nameRequired
  if (name.length > NAME_MAX) return CATEGORY_MESSAGES.nameTooLong
  const key = slugify(name)
  if (key === '') return CATEGORY_MESSAGES.nameNoAlnum
  if (RESERVED_SLUGS.includes(key)) return CATEGORY_MESSAGES.nameReserved
  const twin = others.find((other) => other._id !== selfId && slugify(other.name) === key)
  return twin === undefined ? undefined : `Trop proche de la catégorie « ${twin.name} ».`
}

export function descriptionError(rawDescription: string): string | undefined {
  return rawDescription.trim().length > DESCRIPTION_MAX
    ? CATEGORY_MESSAGES.descriptionTooLong
    : undefined
}

/** Message de refus de l'adresse (AC-5), ou undefined. */
export function slugError(
  slug: string,
  others: readonly Addressed[],
  selfId: string,
): string | undefined {
  if (!SLUG_PATTERN.test(slug)) return CATEGORY_MESSAGES.slugPattern
  if (RESERVED_SLUGS.includes(slug)) return CATEGORY_MESSAGES.slugReserved
  const owner = others.find((other) => other._id !== selfId && other.slug === slug)
  return owner === undefined ? undefined : `Adresse déjà utilisée par « ${owner.name} ».`
}

export interface CategoryFormValues {
  readonly name: string
  readonly description: string
  readonly isVisible: boolean
  /** Adresse saisie ; prise en compte seulement si le champ d'adresse est ouvert. */
  readonly slug: string
}

export function toCategoryFormValues(category: Category | undefined): CategoryFormValues {
  return {
    name: category?.name ?? '',
    description: category?.description ?? '',
    isVisible: category?.isVisible ?? true,
    slug: category?.slug ?? '',
  }
}

export interface CategoryCreatePayload {
  readonly name: string
  readonly description?: string
  readonly isVisible: boolean
}

/** Création : nom et description nettoyés, description vide non envoyée (AC-2). */
export function toCategoryCreatePayload(values: CategoryFormValues): CategoryCreatePayload {
  const description = values.description.trim()
  return {
    name: values.name.trim(),
    ...(description === '' ? {} : { description }),
    isVisible: values.isVisible,
  }
}

export interface CategoryPatch {
  name?: string
  description?: string | null
  isVisible?: boolean
  slug?: string
}

/** Seuls les champs changés ; l'adresse seulement si son champ est ouvert et modifié (AC-4, AC-5). */
export function toCategoryPatch(
  base: CategoryFormValues,
  values: CategoryFormValues,
  slugOpen: boolean,
): CategoryPatch {
  const patch: CategoryPatch = {}
  const name = values.name.trim()
  if (name !== base.name.trim()) patch.name = name
  const description = values.description.trim()
  if (description !== base.description.trim()) {
    patch.description = description === '' ? null : description
  }
  if (values.isVisible !== base.isVisible) patch.isVisible = values.isVisible
  const slug = values.slug.trim()
  if (slugOpen && slug !== base.slug) patch.slug = slug
  return patch
}

export function isEmptyPatch(patch: CategoryPatch): boolean {
  return Object.keys(patch).length === 0
}

function backendText(message: string | readonly string[] | undefined): string {
  if (message === undefined) return ''
  return typeof message === 'string' ? message : message.join(' ')
}

/** Champ visé par un 409 du backend : « … slug … » → adresse, sinon le nom (AC-3, AC-5). */
export function conflictField(error: unknown): 'name' | 'slug' | undefined {
  if (!isApiError(error) || error.kind !== 'http' || error.status !== 409) return undefined
  if (error.code === CATEGORY_IN_USE) return undefined
  return /\bslug\b/i.test(backendText(error.backendMessage)) ? 'slug' : 'name'
}

/** Champ visé par un 400 « réservé » ou « au moins une lettre » du backend. */
export function badRequestField(error: unknown): 'name' | 'slug' | undefined {
  if (!isApiError(error) || error.kind !== 'http' || error.status !== 400) return undefined
  const text = backendText(error.backendMessage)
  if (/at least one letter/i.test(text)) return 'name'
  if (/reserved/i.test(text)) return 'slug'
  if (/slug/i.test(text)) return 'slug'
  return undefined
}

export function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.kind === 'http' && error.status === 404
}

export const CATEGORY_IN_USE = 'CATEGORY_IN_USE'

const inUseBodySchema = z.object({
  code: z.literal(CATEGORY_IN_USE),
  seriesCount: z.number().int().min(1).optional(),
})

/** Refus de suppression d'une catégorie utilisée (AC-8) : undefined si ce n'est pas ce cas. */
export function parseInUse(error: unknown): { readonly seriesCount?: number } | undefined {
  if (!isApiError(error) || error.kind !== 'http' || error.status !== 409) return undefined
  const body = inUseBodySchema.safeParse(error.body)
  if (body.success) {
    return body.data.seriesCount === undefined ? {} : { seriesCount: body.data.seriesCount }
  }
  return error.code === CATEGORY_IN_USE ? {} : undefined
}

/** « « Drame » est encore utilisée par 3 séries. » (AC-8). */
export function inUseText(name: string, seriesCount: number | undefined): string {
  if (seriesCount === undefined) return `« ${name} » est encore utilisée par des séries.`
  const series = seriesCount > 1 ? `${String(seriesCount)} séries` : '1 série'
  return `« ${name} » est encore utilisée par ${series}.`
}

/** « 8 catégories », « 1 catégorie » (AC-1). */
export function countText(count: number): string {
  return count > 1 ? `${String(count)} catégories` : `${String(count)} catégorie`
}
