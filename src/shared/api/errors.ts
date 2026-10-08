/**
 * Erreurs typées levées par apiRequest et la session (spec 0002).
 * ApiError est une classe pour garder la pile d'appel : exception assumée au style fonctionnel.
 * Une ApiError ne contient jamais de token (AC-15).
 */

export type ApiErrorKind =
  'http' | 'network' | 'timeout' | 'invalid-response' | 'not-admin' | 'session-ended' | 'config'

export type SessionEndReason = 'expired' | 'forbidden' | 'logout'

export interface ValidationIssue {
  readonly path: string
  readonly code: string
}

export interface ApiErrorInit {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  readonly backendMessage?: string | readonly string[]
  readonly body?: unknown
  readonly issues?: readonly ValidationIssue[]
  readonly reason?: SessionEndReason
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | undefined
  readonly code: string | undefined
  readonly backendMessage: string | readonly string[] | undefined
  readonly body: unknown
  readonly issues: readonly ValidationIssue[] | undefined
  readonly reason: SessionEndReason | undefined

  constructor(init: ApiErrorInit) {
    super(
      init.status === undefined
        ? `ApiError ${init.kind}`
        : `ApiError ${init.kind} ${String(init.status)}`,
    )
    this.name = 'ApiError'
    this.kind = init.kind
    this.status = init.status
    this.code = init.code
    this.backendMessage = init.backendMessage
    this.body = init.body
    this.issues = init.issues
    this.reason = init.reason
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}
