/**
 * Client TanStack Query du dashboard et règle de réessai (spec 0002, AC-12).
 * Lectures : 2 relances sur réseau ou 5xx, 1 sur timeout, jamais sur 4xx, session finie,
 * réponse invalide ou abandon. Mutations : jamais relancées.
 */
import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@/shared/api/errors'

export const MAX_RETRIES = 2
export const MAX_TIMEOUT_RETRIES = 1

/** `failureCount` : nombre d'échecs déjà relancés (0 avant la première relance). */
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  if (!isApiError(error)) return false
  if (error.kind === 'network') return failureCount < MAX_RETRIES
  if (error.kind === 'timeout') return failureCount < MAX_TIMEOUT_RETRIES
  if (error.kind === 'http' && (error.status ?? 0) >= 500) return failureCount < MAX_RETRIES
  return false
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery },
      mutations: { retry: 0 },
    },
  })
}
