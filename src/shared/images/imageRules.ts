// Règles des emplacements d'image (spec 0007, AC-3, AC-8) : formes, minimums, textes. Fonctions pures.
import { isApiError } from '@/shared/api/errors'
import { toUserMessage } from '@/shared/api/messages'

export type ImageSlotKind = 'cover' | 'banner' | 'thumbnail' | 'category'

export interface ImageSlotRules {
  readonly kind: ImageSlotKind
  /** Largeur divisée par hauteur. */
  readonly aspectRatio: number
  readonly minWidth: number
  readonly minHeight: number
  /** « Couverture » : nom du groupe. */
  readonly title: string
  /** « la couverture » : dans les noms des boutons. */
  readonly noun: string
  readonly empty: string
  readonly saved: string
  readonly removed: string
  /** Texte d'un 404 : le propriétaire de l'image a disparu. */
  readonly gone: string
}

export const IMAGE_SLOTS: Readonly<Record<ImageSlotKind, ImageSlotRules>> = {
  cover: {
    kind: 'cover',
    aspectRatio: 2 / 3,
    minWidth: 400,
    minHeight: 600,
    title: 'Couverture',
    noun: 'la couverture',
    empty: 'Aucune couverture',
    saved: 'Couverture mise à jour.',
    removed: 'Couverture retirée.',
    gone: "Cette série n'existe plus.",
  },
  banner: {
    kind: 'banner',
    aspectRatio: 16 / 9,
    minWidth: 1280,
    minHeight: 720,
    title: 'Bannière',
    noun: 'la bannière',
    empty: 'Aucune bannière',
    saved: 'Bannière mise à jour.',
    removed: 'Bannière retirée.',
    gone: "Cette série n'existe plus.",
  },
  thumbnail: {
    kind: 'thumbnail',
    aspectRatio: 16 / 9,
    minWidth: 640,
    minHeight: 360,
    title: 'Vignette',
    noun: 'la vignette',
    empty: 'Aucune vignette',
    saved: 'Vignette mise à jour.',
    removed: 'Vignette retirée.',
    gone: "Cet épisode n'existe plus.",
  },
  category: {
    kind: 'category',
    aspectRatio: 1,
    minWidth: 400,
    minHeight: 400,
    title: 'Image',
    noun: "l'image",
    empty: 'Aucune image',
    saved: 'Image mise à jour.',
    removed: 'Image retirée.',
    gone: "Cette catégorie n'existe plus.",
  },
}

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGE_PIXELS = 25_000_000
export const MAX_IMAGE_STRETCH = 5
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp'

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const IMAGE_EXTENSIONS = /\.(jpe?g|png|webp)$/i

export const IMAGE_MESSAGES = {
  format: 'Format accepté : JPEG, PNG ou WebP.',
  heavy: 'Image trop lourde : 5 Mo au plus.',
  unreadable: 'Image illisible.',
  stretched: 'Image trop étirée : proportion de 5 pour 1 au plus.',
  tooBig: 'Image trop grande : 25 mégapixels au plus.',
  oneFile: 'Déposez un seul fichier.',
  refused: 'Image refusée par le serveur.',
  limit:
    "Trop d'envois en peu de temps : la limite est de 10 envois ou retraits d'images ou de vidéos par 10 minutes. Réessayez dans quelques minutes.",
  unavailable: "Le service d'images est indisponible pour le moment.",
  conflict: "Cette image vient d'être changée par ailleurs.",
  network: 'Envoi impossible : vérifiez la connexion et réessayez.',
  seriesGone: "Cette série n'existe plus.",
  episodeGone: "Cet épisode n'existe plus.",
} as const

export interface ImageDimensions {
  readonly width: number
  readonly height: number
}

/** Format (type, ou à défaut extension) puis poids : avant tout décodage (AC-3). */
export function checkFileBasics(file: File): string | undefined {
  if (!IMAGE_TYPES.has(file.type) && !IMAGE_EXTENSIONS.test(file.name)) {
    return IMAGE_MESSAGES.format
  }
  if (file.size > MAX_IMAGE_BYTES) return IMAGE_MESSAGES.heavy
  return undefined
}

/** Lisibilité, proportion, mégapixels, puis minimum de l'emplacement (AC-3). */
export function checkDimensions(
  dimensions: ImageDimensions | undefined,
  slot: ImageSlotRules,
): string | undefined {
  if (dimensions === undefined || dimensions.width <= 0 || dimensions.height <= 0) {
    return IMAGE_MESSAGES.unreadable
  }
  const { width, height } = dimensions
  if (Math.max(width, height) > MAX_IMAGE_STRETCH * Math.min(width, height)) {
    return IMAGE_MESSAGES.stretched
  }
  if (width * height > MAX_IMAGE_PIXELS) return IMAGE_MESSAGES.tooBig
  if (width < slot.minWidth || height < slot.minHeight) {
    return `Image trop petite : ${String(slot.minWidth)} × ${String(slot.minHeight)} px au moins (reçue : ${String(width)} × ${String(height)}).`
  }
  return undefined
}

/** Tous les contrôles dans l'ordre de l'AC-3 ; `undefined` en dimensions = décodage impossible. */
export function checkImageFile(
  file: File,
  dimensions: ImageDimensions | undefined,
  slot: ImageSlotRules,
): string | undefined {
  return checkFileBasics(file) ?? checkDimensions(dimensions, slot)
}

/** Image rangée sur Cloudinary par le backend ; sinon, un ancien lien collé (AC-7). */
export function isHostedImage(url: string): boolean {
  try {
    return new URL(url).hostname === 'res.cloudinary.com'
  } catch {
    return false
  }
}

// Messages du backend affichés tels quels (en français) ; les autres sont remplacés (AC-8).
const KNOWN_BACKEND_MESSAGES = [
  'Images animées non acceptées',
  'Image illisible',
  'Image invalide',
  'Image trop petite',
  'Image trop étirée',
  'Image trop grande',
  'Format non accepté',
]

function backendText(message: string | readonly string[] | undefined): string {
  if (message === undefined) return ''
  return (typeof message === 'string' ? message : message.join(' ')).trim()
}

/**
 * Texte affiché sous l'emplacement pour un refus de l'envoi ou du retrait (AC-8).
 * `undefined` pour une fin de session (silencieuse, l'écran de connexion l'annonce).
 */
export function imageErrorMessage(error: unknown, slot: ImageSlotRules): string | undefined {
  if (!isApiError(error)) return toUserMessage(error).message
  if (error.kind === 'session-ended') return undefined
  if (error.kind === 'network' || error.kind === 'timeout') return IMAGE_MESSAGES.network
  if (error.kind !== 'http') return toUserMessage(error).message
  switch (error.status) {
    case 413:
      return IMAGE_MESSAGES.heavy
    case 400:
    case 415: {
      const text = backendText(error.backendMessage)
      return KNOWN_BACKEND_MESSAGES.some((known) => text.startsWith(known))
        ? text
        : IMAGE_MESSAGES.refused
    }
    case 429:
      return IMAGE_MESSAGES.limit
    case 503:
      return IMAGE_MESSAGES.unavailable
    case 409:
      return IMAGE_MESSAGES.conflict
    case 404:
      return slot.gone
    default:
      return toUserMessage(error).message
  }
}
