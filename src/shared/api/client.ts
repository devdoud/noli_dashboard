/**
 * apiRequest : la seule porte vers l'API (spec 0002, « Comportement de apiRequest »).
 * Ajoute le token, gère délais, renouvellement sur 401, fin de session sur 403 sans code,
 * vérifie la réponse avec Zod et convertit toute erreur en ApiError.
 * Ne connaît pas la session : session.ts lui enregistre ses fonctions (registerSessionHooks).
 */
import type { z } from 'zod'
import { envResult } from '@/shared/config/env'
import { ApiError, isApiError, type SessionEndReason } from '@/shared/api/errors'
import { trackSlowRequest } from '@/shared/api/slowRequests'

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type QueryValue = string | number | boolean | undefined

export interface ApiRequestOptions<T> {
  readonly method: HttpMethod
  readonly path: string
  readonly schema: z.ZodType<T>
  readonly query?: Readonly<Record<string, QueryValue>>
  /** Objet envoyé en JSON, ou FormData pour un envoi de fichier. */
  readonly body?: unknown
  /** Défaut `true` : ajoute le token et gère 401 et 403. */
  readonly auth?: boolean
  readonly signal?: AbortSignal
}

export interface SessionHooks {
  readonly getAccessToken: () => string | undefined
  /** Renvoie un nouveau token d'accès, ou échoue (ApiError). Promesse partagée côté session. */
  readonly refresh: () => Promise<string>
  readonly isAuthenticated: () => boolean
  readonly onSessionEnd: (reason: Exclude<SessionEndReason, 'logout'>) => void
  /** Signal annulé à la fin de la session : coupe les requêtes authentifiées en cours. */
  readonly sessionSignal: () => AbortSignal
}

export const JSON_TIMEOUT_MS = 70_000
export const UPLOAD_TIMEOUT_MS = 120_000

const hooksStore: { current: SessionHooks | undefined } = { current: undefined }

export function registerSessionHooks(hooks: SessionHooks | undefined): void {
  hooksStore.current = hooks
}

interface RawResponse {
  readonly status: number
  readonly text: string
  readonly sentToken: string | undefined
}

type ParsedBody =
  | { readonly kind: 'empty' }
  | { readonly kind: 'json'; readonly value: unknown }
  | { readonly kind: 'text'; readonly value: string }

function baseUrl(): string {
  if (!envResult.ok) throw new ApiError({ kind: 'config' })
  return envResult.env.apiBaseUrl
}

function buildUrl(path: string, query: ApiRequestOptions<unknown>['query']): string {
  const url = new URL(`${baseUrl()}${path}`)
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined) url.searchParams.set(key, String(value))
  })
  return url.toString()
}

function buildInit(
  options: ApiRequestOptions<unknown>,
  token: string | undefined,
  signal: AbortSignal,
): RequestInit {
  const headers = new Headers({ Accept: 'application/json' })
  if (token !== undefined) headers.set('Authorization', `Bearer ${token}`)
  if (options.body === undefined) return { method: options.method, headers, body: null, signal }
  if (options.body instanceof FormData) {
    return { method: options.method, headers, body: options.body, signal }
  }
  headers.set('Content-Type', 'application/json')
  return { method: options.method, headers, body: JSON.stringify(options.body), signal }
}

/** Relie un signal externe à un AbortController, renvoie la fonction qui défait le lien. */
function linkSignal(source: AbortSignal | undefined, controller: AbortController): () => void {
  if (source === undefined) return () => undefined
  if (source.aborted) {
    controller.abort(source.reason)
    return () => undefined
  }
  const onAbort = () => {
    controller.abort(source.reason)
  }
  source.addEventListener('abort', onAbort, { once: true })
  return () => {
    source.removeEventListener('abort', onAbort)
  }
}

async function attempt(
  options: ApiRequestOptions<unknown>,
  url: string,
  token: string | undefined,
): Promise<RawResponse> {
  const controller = new AbortController()
  const timeoutMs = options.body instanceof FormData ? UPLOAD_TIMEOUT_MS : JSON_TIMEOUT_MS
  const state = { timedOut: false }
  const timer = setTimeout(() => {
    state.timedOut = true
    controller.abort()
  }, timeoutMs)
  const unlinkCaller = linkSignal(options.signal, controller)
  const unlinkSession =
    (options.auth ?? true) ? linkSignal(hooksStore.current?.sessionSignal(), controller) : () => {}
  try {
    const response = await fetch(url, buildInit(options, token, controller.signal))
    const text = await response.text()
    return { status: response.status, text, sentToken: token }
  } catch {
    if (state.timedOut) throw new ApiError({ kind: 'timeout' })
    if (controller.signal.aborted) {
      throw new DOMException('La requête a été annulée.', 'AbortError')
    }
    throw new ApiError({ kind: 'network' })
  } finally {
    clearTimeout(timer)
    unlinkCaller()
    unlinkSession()
  }
}

function parseBody(text: string): ParsedBody {
  if (text.trim() === '') return { kind: 'empty' }
  try {
    return { kind: 'json', value: JSON.parse(text) as unknown }
  } catch {
    return { kind: 'text', value: text }
  }
}

function readField(body: unknown, key: string): unknown {
  return typeof body === 'object' && body !== null && key in body
    ? (body as Record<string, unknown>)[key]
    : undefined
}

/** Longueur maximale gardée d'un corps texte (page d'erreur d'un proxy, texte brut). */
export const MAX_TEXT_BODY_LENGTH = 300

function looksLikeHtml(text: string): boolean {
  return /^\s*</.test(text)
}

function truncate(text: string): string {
  return text.length > MAX_TEXT_BODY_LENGTH ? `${text.slice(0, MAX_TEXT_BODY_LENGTH)}…` : text
}

function backendMessageOf(body: ParsedBody): string | readonly string[] | undefined {
  // Une page HTML (502 ou 503 de Render au réveil) n'apporte rien de lisible en détail.
  if (body.kind === 'text') return looksLikeHtml(body.value) ? undefined : truncate(body.value)
  if (body.kind !== 'json') return undefined
  const message = readField(body.value, 'message')
  if (typeof message === 'string') return message
  if (Array.isArray(message) && message.every((item) => typeof item === 'string')) {
    return message
  }
  return undefined
}

function codeOf(body: ParsedBody): string | undefined {
  if (body.kind !== 'json') return undefined
  const code = readField(body.value, 'code')
  return typeof code === 'string' ? code : undefined
}

function endSessionAndThrow(reason: Exclude<SessionEndReason, 'logout'>): never {
  const hooks = hooksStore.current
  if (hooks?.isAuthenticated()) hooks.onSessionEnd(reason)
  throw new ApiError({ kind: 'session-ended', reason })
}

/** Tout 4xx sur /auth/refresh, ou l'absence de refresh token, est un refus. */
function isRefreshRefused(error: unknown): boolean {
  if (!isApiError(error)) return false
  if (error.kind === 'session-ended') return error.reason === 'expired'
  return error.kind === 'http' && (error.status ?? 0) >= 400 && (error.status ?? 0) < 500
}

function toResult<T>(options: ApiRequestOptions<T>, raw: RawResponse, auth: boolean): T {
  const body = parseBody(raw.text)
  if (raw.status >= 200 && raw.status < 300) {
    if (body.kind === 'text') {
      console.error(`[api] Réponse non JSON pour ${options.method} ${options.path}`)
      throw new ApiError({ kind: 'invalid-response', status: raw.status })
    }
    const parsed = options.schema.safeParse(body.kind === 'json' ? body.value : undefined)
    if (!parsed.success) {
      const issues = parsed.error.issues.map((issue) => ({
        path: issue.path.map(String).join('.'),
        code: issue.code,
      }))
      // Seulement les chemins et codes : jamais les données reçues (AC-15).
      console.error(`[api] Réponse inattendue pour ${options.method} ${options.path}`, issues)
      throw new ApiError({ kind: 'invalid-response', status: raw.status, issues })
    }
    return parsed.data
  }
  const code = codeOf(body)
  if (auth && raw.status === 403 && code === undefined) endSessionAndThrow('forbidden')
  throw new ApiError({
    kind: 'http',
    status: raw.status,
    code,
    backendMessage: backendMessageOf(body),
    body:
      body.kind === 'json' ? body.value : body.kind === 'text' ? truncate(body.value) : undefined,
  })
}

async function newTokenAfter401(sentToken: string | undefined): Promise<string> {
  const hooks = hooksStore.current
  if (hooks === undefined) return endSessionAndThrow('expired')
  const current = hooks.getAccessToken()
  if (current !== undefined && current !== sentToken) return current
  try {
    return await hooks.refresh()
  } catch (error) {
    if (isRefreshRefused(error)) return endSessionAndThrow('expired')
    // Une fin de session déjà décidée (déconnexion pendant le renouvellement) garde sa raison ;
    // une erreur réseau ou serveur remonte telle quelle, sans fermer la session.
    throw error
  }
}

export function apiRequest<T>(options: ApiRequestOptions<T>): Promise<T> {
  return trackSlowRequest(async () => {
    const auth = options.auth ?? true
    const url = buildUrl(options.path, options.query)
    const first = await attempt(
      options,
      url,
      auth ? hooksStore.current?.getAccessToken() : undefined,
    )
    if (!auth || first.status !== 401) return toResult(options, first, auth)
    const token = await newTokenAfter401(first.sentToken)
    const second = await attempt(options, url, token)
    if (second.status === 401) endSessionAndThrow('expired')
    return toResult(options, second, auth)
  })
}
