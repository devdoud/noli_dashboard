/**
 * Compteur des appels apiRequest qui attendent depuis plus de 5 s (spec 0002, AC-9).
 * Petit store de module, modifié seulement par ses fonctions (exception assumée, spec 0002).
 */
import { useSyncExternalStore } from 'react'

export const SLOW_REQUEST_THRESHOLD_MS = 5_000

const store = {
  count: 0,
  listeners: new Set<() => void>(),
}

function emit(): void {
  store.listeners.forEach((listener) => {
    listener()
  })
}

function subscribe(listener: () => void): () => void {
  store.listeners.add(listener)
  return () => {
    store.listeners.delete(listener)
  }
}

function getSnapshot(): number {
  return store.count
}

export function getSlowRequestCount(): number {
  return store.count
}

/** Exécute `run` et compte l'appel comme lent s'il dépasse le seuil. */
export async function trackSlowRequest<T>(run: () => Promise<T>): Promise<T> {
  const state = { counted: false }
  const timer = setTimeout(() => {
    state.counted = true
    store.count += 1
    emit()
  }, SLOW_REQUEST_THRESHOLD_MS)
  try {
    return await run()
  } finally {
    clearTimeout(timer)
    if (state.counted) {
      store.count -= 1
      emit()
    }
  }
}

export function useSlowRequestCount(): number {
  return useSyncExternalStore(subscribe, getSnapshot)
}
