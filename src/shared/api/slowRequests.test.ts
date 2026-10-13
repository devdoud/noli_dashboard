import { act, renderHook } from '@testing-library/react'
import {
  getSlowRequestCount,
  SLOW_REQUEST_THRESHOLD_MS,
  trackSlowRequest,
  useSlowRequestCount,
} from '@/shared/api/slowRequests'

function deferred() {
  const handle: { resolve: () => void; reject: (error: unknown) => void } = {
    resolve: () => undefined,
    reject: () => undefined,
  }
  const promise = new Promise<void>((resolve, reject) => {
    handle.resolve = resolve
    handle.reject = reject
  })
  return { promise, ...handle }
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('trackSlowRequest', () => {
  it('ne compte pas un appel qui finit avant le seuil (AC-9)', async () => {
    const work = deferred()
    const tracked = trackSlowRequest(() => work.promise)

    await vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS - 1)
    work.resolve()
    await tracked
    await vi.advanceTimersByTimeAsync(10)

    expect(getSlowRequestCount()).toBe(0)
  })

  it('compte chaque appel lent une fois et les libère tous (AC-9)', async () => {
    const first = deferred()
    const second = deferred()
    const a = trackSlowRequest(() => first.promise)
    const b = trackSlowRequest(() => second.promise)

    await vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS)
    expect(getSlowRequestCount()).toBe(2)

    first.resolve()
    await a
    expect(getSlowRequestCount()).toBe(1)

    second.resolve()
    await b
    expect(getSlowRequestCount()).toBe(0)
  })

  it('libère l’emplacement quand l’appel lent échoue (AC-9)', async () => {
    const work = deferred()
    const tracked = trackSlowRequest(() => work.promise)
    await vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS)
    expect(getSlowRequestCount()).toBe(1)

    work.reject(new Error('échec'))
    await expect(tracked).rejects.toThrow('échec')

    expect(getSlowRequestCount()).toBe(0)
  })

  it('renvoie la valeur de l’appel suivi', async () => {
    await expect(trackSlowRequest(() => Promise.resolve(42))).resolves.toBe(42)
  })
})

describe('useSlowRequestCount', () => {
  it('se met à jour quand un appel devient lent puis se termine (AC-9)', async () => {
    const work = deferred()
    const { result } = renderHook(() => useSlowRequestCount())
    expect(result.current).toBe(0)

    const tracked = trackSlowRequest(() => work.promise)
    await act(() => vi.advanceTimersByTimeAsync(SLOW_REQUEST_THRESHOLD_MS))
    expect(result.current).toBe(1)

    await act(async () => {
      work.resolve()
      await tracked
    })
    expect(result.current).toBe(0)
  })
})
