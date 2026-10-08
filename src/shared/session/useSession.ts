/** Hook React qui expose l'état de session (spec 0002, contrat avec la fonctionnalité 5). */
import { useSyncExternalStore } from 'react'
import { getSessionState, subscribeSession, type SessionState } from '@/shared/session/store'

export function useSession(): SessionState {
  return useSyncExternalStore(subscribeSession, getSessionState)
}
