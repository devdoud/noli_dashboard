/**
 * Partage de session entre onglets par BroadcastChannel (spec 0002, AC-8, « Règles de session »).
 * Messages : request (un onglet sans token demande), share (un onglet connecté répond),
 * logout (déconnexion de tous les onglets, jamais rediffusée).
 * Petit store de module, modifié seulement par ses fonctions (exception assumée, spec 0002).
 */
import { z } from 'zod'

export const TAB_CHANNEL_NAME = 'noli-admin-session'
export const TAB_REQUEST_TIMEOUT_MS = 300

const messageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('request') }),
  z.object({ type: z.literal('share'), refreshToken: z.string().min(1) }),
  z.object({ type: z.literal('logout') }),
])

export type TabMessage = z.infer<typeof messageSchema>

export interface TabHandlers {
  /** Le refresh token à partager, seulement si cet onglet est connecté. */
  readonly shareableRefreshToken: () => string | undefined
  readonly onLogout: () => void
}

const tabs: {
  channel: BroadcastChannel | undefined
  waiting: ((token: string) => void) | undefined
} = {
  channel: undefined,
  waiting: undefined,
}

function post(message: TabMessage): void {
  tabs.channel?.postMessage(message)
}

function handle(message: TabMessage, handlers: TabHandlers): void {
  switch (message.type) {
    case 'request': {
      const token = handlers.shareableRefreshToken()
      if (token !== undefined) post({ type: 'share', refreshToken: token })
      return
    }
    case 'share': {
      // Seul un onglet qui attend accepte ; le premier reçu gagne.
      const resolve = tabs.waiting
      tabs.waiting = undefined
      resolve?.(message.refreshToken)
      return
    }
    case 'logout':
      handlers.onLogout()
      return
  }
}

export function startTabSync(handlers: TabHandlers): void {
  if (tabs.channel !== undefined || typeof BroadcastChannel === 'undefined') return
  const channel = new BroadcastChannel(TAB_CHANNEL_NAME)
  channel.onmessage = (event: MessageEvent) => {
    const parsed = messageSchema.safeParse(event.data)
    if (parsed.success) handle(parsed.data, handlers)
  }
  tabs.channel = channel
}

export function stopTabSync(): void {
  tabs.channel?.close()
  tabs.channel = undefined
  tabs.waiting = undefined
}

/** Demande le refresh token aux autres onglets ; `undefined` si personne ne répond à temps. */
export function requestRefreshTokenFromTabs(
  timeoutMs: number = TAB_REQUEST_TIMEOUT_MS,
): Promise<string | undefined> {
  if (tabs.channel === undefined) return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      tabs.waiting = undefined
      resolve(undefined)
    }, timeoutMs)
    tabs.waiting = (token) => {
      clearTimeout(timer)
      resolve(token)
    }
    post({ type: 'request' })
  })
}

export function broadcastLogout(): void {
  post({ type: 'logout' })
}
