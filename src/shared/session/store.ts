/**
 * État de session et tokens (spec 0002, « Data model sketch »).
 * Token d'accès en mémoire seulement ; refresh token dans sessionStorage, jamais localStorage.
 * Petit store de module, modifié seulement par ses fonctions (exception assumée, spec 0002).
 */
import type { SessionEndReason } from '@/shared/api/errors'

export type SessionStatus = 'restoring' | 'anonymous' | 'authenticated'

export interface AdminUser {
  readonly id: string
  readonly email: string
  readonly username: string
  readonly role: 'admin'
}

export interface SessionState {
  readonly status: SessionStatus
  readonly user?: AdminUser
  readonly endReason?: SessionEndReason
  readonly endMessage?: string
}

export const REFRESH_TOKEN_KEY = 'noli.admin.refreshToken'

const INITIAL_STATE: SessionState = { status: 'restoring' }

const store: {
  state: SessionState
  accessToken: string | undefined
  /** Copie de secours du refresh token si sessionStorage est indisponible. */
  refreshToken: string | undefined
  readonly listeners: Set<() => void>
} = {
  state: INITIAL_STATE,
  accessToken: undefined,
  refreshToken: undefined,
  listeners: new Set(),
}

export function getSessionState(): SessionState {
  return store.state
}

export function setSessionState(state: SessionState): void {
  store.state = state
  store.listeners.forEach((listener) => {
    listener()
  })
}

export function subscribeSession(listener: () => void): () => void {
  store.listeners.add(listener)
  return () => {
    store.listeners.delete(listener)
  }
}

export function getAccessToken(): string | undefined {
  return store.accessToken
}

export function setAccessToken(token: string | undefined): void {
  store.accessToken = token
}

export function readRefreshToken(): string | undefined {
  try {
    return window.sessionStorage.getItem(REFRESH_TOKEN_KEY) ?? store.refreshToken
  } catch {
    return store.refreshToken
  }
}

export function writeRefreshToken(token: string): void {
  store.refreshToken = token
  try {
    window.sessionStorage.setItem(REFRESH_TOKEN_KEY, token)
  } catch {
    // Stockage indisponible (navigation privée stricte) : la copie en mémoire garde la session
    // dans cet onglet jusqu'au rechargement de la page.
  }
}

export function clearTokens(): void {
  store.accessToken = undefined
  store.refreshToken = undefined
  try {
    window.sessionStorage.removeItem(REFRESH_TOKEN_KEY)
  } catch {
    // Rien à effacer si le stockage est indisponible.
  }
}

export function resetSessionStore(): void {
  clearTokens()
  store.state = INITIAL_STATE
}
