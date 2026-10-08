/**
 * Session de l'admin : connexion, déconnexion, renouvellement partagé, reprise au démarrage
 * (spec 0002, AC-3 à AC-8, « Règles de session et d'onglets »).
 * Enregistre ses fonctions auprès du client au chargement (pas de dépendance circulaire).
 * Petit store de module, modifié seulement par ses fonctions (exception assumée, spec 0002).
 */
import type { QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest, registerSessionHooks } from '@/shared/api/client'
import { ApiError, type SessionEndReason } from '@/shared/api/errors'
import { SESSION_EXPIRED_MESSAGE, SESSION_FORBIDDEN_MESSAGE } from '@/shared/api/messages'
import {
  clearTokens,
  getAccessToken,
  getSessionState,
  readRefreshToken,
  resetSessionStore,
  setAccessToken,
  setSessionState,
  writeRefreshToken,
  type AdminUser,
} from '@/shared/session/store'
import {
  broadcastLogout,
  requestRefreshTokenFromTabs,
  startTabSync,
  stopTabSync,
} from '@/shared/session/tabs'

const loginSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  user: z.object({
    id: z.string(),
    email: z.string(),
    username: z.string(),
    role: z.string(),
  }),
})

const refreshSchema = z.object({ accessToken: z.string().min(1) })

const profileSchema = z.object({
  user: z.object({
    _id: z.string(),
    email: z.string(),
    username: z.string(),
    role: z.string(),
  }),
})

const session: {
  refreshPromise: Promise<string> | undefined
  restorePromise: Promise<void> | undefined
  restoreCancelled: boolean
  controller: AbortController
  queryClient: QueryClient | undefined
} = {
  refreshPromise: undefined,
  restorePromise: undefined,
  restoreCancelled: false,
  controller: new AbortController(),
  queryClient: undefined,
}

/** Le cache vidé à chaque fin de session (aucune donnée de l'admin précédent ne reste). */
export function registerQueryClient(queryClient: QueryClient | undefined): void {
  session.queryClient = queryClient
}

function endMessageFor(reason: SessionEndReason): string | undefined {
  if (reason === 'expired') return SESSION_EXPIRED_MESSAGE
  if (reason === 'forbidden') return SESSION_FORBIDDEN_MESSAGE
  return undefined
}

function resetSessionResources(): void {
  clearTokens()
  session.controller.abort()
  session.controller = new AbortController()
  session.refreshPromise = undefined
  session.queryClient?.clear()
}

/**
 * Met fin à la session. La première raison gagne : sans session active, ne fait rien.
 * Pendant une reprise (message logout d'un autre onglet), annule la reprise sans message.
 */
export function endSession(reason: SessionEndReason, options: { broadcast: boolean }): void {
  const { status } = getSessionState()
  if (status === 'restoring') {
    session.restoreCancelled = true
    resetSessionResources()
    setSessionState({ status: 'anonymous' })
    return
  }
  if (status !== 'authenticated') return
  resetSessionResources()
  const endMessage = endMessageFor(reason)
  setSessionState(
    endMessage === undefined
      ? { status: 'anonymous', endReason: reason }
      : { status: 'anonymous', endReason: reason, endMessage },
  )
  if (options.broadcast) broadcastLogout()
}

export function logout(): void {
  endSession('logout', { broadcast: true })
}

/** Renouvelle le token d'accès ; un seul appel à la fois, partagé par tous les demandeurs. */
export function refreshAccessToken(): Promise<string> {
  if (session.refreshPromise !== undefined) return session.refreshPromise
  const { signal } = session.controller
  const promise = (async () => {
    const refreshToken = readRefreshToken()
    if (refreshToken === undefined) throw new ApiError({ kind: 'session-ended', reason: 'expired' })
    const result = await apiRequest({
      method: 'POST',
      path: '/auth/refresh',
      body: { refreshToken },
      auth: false,
      schema: refreshSchema,
    })
    // La session a pris fin pendant l'appel : ne pas ranimer un token.
    if (signal.aborted) throw new ApiError({ kind: 'session-ended', reason: 'logout' })
    setAccessToken(result.accessToken)
    return result.accessToken
  })()
  session.refreshPromise = promise
  const release = () => {
    if (session.refreshPromise === promise) session.refreshPromise = undefined
  }
  promise.then(release, release)
  return promise
}

export async function login(email: string, password: string): Promise<AdminUser> {
  const result = await apiRequest({
    method: 'POST',
    path: '/auth/login',
    body: { email, password },
    auth: false,
    schema: loginSchema,
  })
  if (result.user.role !== 'admin') throw new ApiError({ kind: 'not-admin' })
  const user: AdminUser = {
    id: result.user.id,
    email: result.user.email,
    username: result.user.username,
    role: 'admin',
  }
  if (getSessionState().status === 'restoring') session.restoreCancelled = true
  ensureTabSync()
  session.controller = new AbortController()
  setAccessToken(result.accessToken)
  writeRefreshToken(result.refreshToken)
  setSessionState({ status: 'authenticated', user })
  return user
}

/** Démarre l'écoute des autres onglets (sans effet si elle tourne déjà). */
function ensureTabSync(): void {
  startTabSync({
    shareableRefreshToken: () =>
      getSessionState().status === 'authenticated' ? readRefreshToken() : undefined,
    onLogout: () => {
      endSession('logout', { broadcast: false })
    },
  })
}

async function runRestore(): Promise<void> {
  ensureTabSync()
  const cancelled = () => session.restoreCancelled
  try {
    const token = readRefreshToken() ?? (await requestRefreshTokenFromTabs())
    if (cancelled()) return
    if (token === undefined) {
      setSessionState({ status: 'anonymous' })
      return
    }
    writeRefreshToken(token)
    await refreshAccessToken()
    if (cancelled()) return
    const profile = await apiRequest({
      method: 'GET',
      path: '/auth/profile',
      schema: profileSchema,
    })
    if (cancelled()) return
    if (profile.user.role !== 'admin') throw new ApiError({ kind: 'not-admin' })
    setSessionState({
      status: 'authenticated',
      user: {
        id: profile.user._id,
        email: profile.user.email,
        username: profile.user.username,
        role: 'admin',
      },
    })
  } catch {
    // Reprise silencieuse : jamais de message, jamais la raison « expired » (AC-7).
    if (cancelled()) return
    resetSessionResources()
    setSessionState({ status: 'anonymous' })
  }
}

/** Appelée une fois au démarrage depuis main.tsx ; un second appel renvoie la même promesse. */
export function restoreSession(): Promise<void> {
  session.restorePromise ??= runRestore()
  return session.restorePromise
}

function registerHooks(): void {
  registerSessionHooks({
    getAccessToken,
    refresh: refreshAccessToken,
    isAuthenticated: () => getSessionState().status === 'authenticated',
    onSessionEnd: (reason) => {
      endSession(reason, { broadcast: true })
    },
    sessionSignal: () => session.controller.signal,
  })
}

registerHooks()

/** Remet la session à zéro entre deux tests. */
export function resetSessionForTests(): void {
  stopTabSync()
  session.controller.abort()
  session.controller = new AbortController()
  session.refreshPromise = undefined
  session.restorePromise = undefined
  session.restoreCancelled = false
  session.queryClient = undefined
  resetSessionStore()
  registerHooks()
}
