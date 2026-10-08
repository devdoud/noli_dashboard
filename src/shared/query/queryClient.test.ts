import { ApiError } from '@/shared/api/errors'
import { createQueryClient, shouldRetryQuery } from '@/shared/query/queryClient'

const retriesFor = (error: unknown) => {
  let count = 0
  while (shouldRetryQuery(count, error)) count += 1
  return count
}

describe('shouldRetryQuery', () => {
  it('relance 2 fois une erreur réseau ou serveur', () => {
    expect(retriesFor(new ApiError({ kind: 'network' }))).toBe(2)
    expect(retriesFor(new ApiError({ kind: 'http', status: 500 }))).toBe(2)
    expect(retriesFor(new ApiError({ kind: 'http', status: 503 }))).toBe(2)
  })

  it('relance 1 fois un timeout', () => {
    expect(retriesFor(new ApiError({ kind: 'timeout' }))).toBe(1)
  })

  it('ne relance jamais un 4xx, une fin de session, une réponse invalide ou un abandon', () => {
    expect(retriesFor(new ApiError({ kind: 'http', status: 404 }))).toBe(0)
    expect(retriesFor(new ApiError({ kind: 'http', status: 429 }))).toBe(0)
    expect(retriesFor(new ApiError({ kind: 'session-ended', reason: 'expired' }))).toBe(0)
    expect(retriesFor(new ApiError({ kind: 'invalid-response' }))).toBe(0)
    expect(retriesFor(new DOMException('annulé', 'AbortError'))).toBe(0)
  })
})

describe('createQueryClient', () => {
  it('ne relance jamais une mutation', () => {
    expect(createQueryClient().getDefaultOptions().mutations?.retry).toBe(0)
  })
})
