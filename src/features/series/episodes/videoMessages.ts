// Textes des erreurs des routes vidéo (spec 0006, AC-16, « Erreurs »), en surcharge de la table
// de la spec 0002.
import { EPISODE_MESSAGES } from '@/features/series/episodes/episodeForm'
import { isApiError } from '@/shared/api/errors'
import type { MessageOverrides } from '@/shared/api/messages'

export const EPISODE_GONE_MESSAGE = "Cet épisode n'existe plus."
export const VIDEO_CONFLICT_MESSAGE =
  "Une autre demande vient d'être prise en compte pour cette vidéo."
export const VIDEO_NOT_STARTED_MESSAGE = "Épisode ajouté, mais la vidéo n'a pas démarré."

export const VIDEO_MESSAGE_OVERRIDES: MessageOverrides = {
  '429': "Trop d'envois en peu de temps : réessayez dans quelques minutes.",
  '503': 'Le service vidéo est indisponible pour le moment.',
}

/** Surcharges d'une action sur un épisode existant : un 404 vise l'épisode. */
export const EPISODE_VIDEO_OVERRIDES: MessageOverrides = {
  ...VIDEO_MESSAGE_OVERRIDES,
  '404': EPISODE_GONE_MESSAGE,
}

function backendText(message: string | readonly string[] | undefined): string {
  if (message === undefined) return ''
  return typeof message === 'string' ? message : message.join(' ')
}

/**
 * Raison d'un import refusé (`400`) à montrer dans la zone Vidéo : le message du backend
 * (refus de Cloudflare, lien collé absent), ou la règle du lien pour un lien non https.
 */
export function importRefusal(error: unknown): string | undefined {
  if (!isApiError(error) || error.kind !== 'http' || error.status !== 400) return undefined
  const text = backendText(error.backendMessage)
  if (text === '') return EPISODE_MESSAGES.link
  return /https|must be a url|url must/i.test(text) ? EPISODE_MESSAGES.link : text
}

export function isHttpStatus(error: unknown, status: number): boolean {
  return isApiError(error) && error.kind === 'http' && error.status === status
}
