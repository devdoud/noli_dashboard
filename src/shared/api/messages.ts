/**
 * Traduction des erreurs en messages français (spec 0002, AC-10, table « Messages d'erreur »).
 * Fonction pure : ne lit jamais error.message d'une erreur inconnue (donnée sensible possible).
 */
import { isApiError, type ApiError } from '@/shared/api/errors'

export interface UserMessage {
  readonly message: string
  readonly details?: string
}

/** Clés : un code du backend (`CATEGORY_IN_USE`) ou un statut (`'404'`). */
export type MessageOverrides = Partial<Record<string, string>>

const UNEXPECTED = 'Une erreur inattendue est survenue.'

export const SESSION_EXPIRED_MESSAGE = 'Votre session a expiré, reconnectez vous.'
export const SESSION_FORBIDDEN_MESSAGE = "Ce compte n'a plus accès au tableau de bord."
export const NOT_ADMIN_MESSAGE = "Ce compte n'a pas accès au tableau de bord."

const CODE_MESSAGES: Readonly<Record<string, string>> = {
  PUSH_UNAVAILABLE: 'Les notifications ne sont pas configurées sur le serveur.',
}

const STATUS_MESSAGES: Readonly<Record<number, string>> = {
  400: 'Certaines informations sont invalides.',
  401: 'Email ou mot de passe incorrect.',
  404: 'Élément introuvable. Il a peut être été supprimé.',
  409: 'Cet élément existe déjà (nom ou titre déjà pris).',
  413: 'Fichier trop lourd : 5 Mo au plus.',
  415: 'Format non accepté : JPEG, PNG ou WebP.',
  429: "Trop de demandes : 10 envois d'images toutes les 10 minutes au plus. Réessayez dans quelques minutes.",
  503: 'Service momentanément indisponible.',
}

function detailsOf(error: ApiError): string | undefined {
  const raw = error.backendMessage
  if (raw === undefined) return undefined
  const text = typeof raw === 'string' ? raw : raw.join('\n')
  return text.trim() === '' ? undefined : text
}

function seriesCountOf(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null || !('seriesCount' in body)) return undefined
  const count = body.seriesCount
  return typeof count === 'number' && Number.isFinite(count) ? count : undefined
}

function categoryInUseMessage(error: ApiError): string {
  const count = seriesCountOf(error.body)
  return count === undefined
    ? "Cette catégorie est encore utilisée par des séries. Retirez-la de ces séries d'abord."
    : `Cette catégorie est encore utilisée par ${String(count)} série(s). Retirez-la de ces séries d'abord.`
}

function httpMessage(error: ApiError): string {
  const status = error.status ?? 0
  if (error.code === 'CATEGORY_IN_USE') return categoryInUseMessage(error)
  if (error.code !== undefined) {
    const byCode = CODE_MESSAGES[error.code]
    if (byCode !== undefined) return byCode
  }
  const byStatus = STATUS_MESSAGES[status]
  if (byStatus !== undefined) return byStatus
  if (status >= 500) return 'Erreur du serveur. Réessayez dans un instant.'
  return UNEXPECTED
}

function defaultMessage(error: ApiError): string {
  switch (error.kind) {
    case 'network':
      return 'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.'
    case 'timeout':
      return 'Le serveur ne répond pas. Réessayez dans un instant.'
    case 'invalid-response':
      return 'Réponse inattendue du serveur.'
    case 'not-admin':
      return NOT_ADMIN_MESSAGE
    case 'session-ended':
      return error.reason === 'forbidden' ? SESSION_FORBIDDEN_MESSAGE : SESSION_EXPIRED_MESSAGE
    case 'config':
      return 'Configuration invalide du tableau de bord.'
    case 'http':
      return httpMessage(error)
  }
}

function overrideFor(error: ApiError, overrides: MessageOverrides | undefined): string | undefined {
  if (overrides === undefined) return undefined
  if (error.code !== undefined) {
    const byCode = overrides[error.code]
    if (byCode !== undefined) return byCode
  }
  return error.status === undefined ? undefined : overrides[String(error.status)]
}

export function toUserMessage(error: unknown, overrides?: MessageOverrides): UserMessage {
  if (!isApiError(error)) return { message: UNEXPECTED }
  const message = overrideFor(error, overrides) ?? defaultMessage(error)
  const details = error.kind === 'http' ? detailsOf(error) : undefined
  return details === undefined ? { message } : { message, details }
}
