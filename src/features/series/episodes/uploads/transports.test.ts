import { http, HttpResponse } from 'msw'
import { sendBasic, sendTus, TransportError } from '@/features/series/episodes/uploads/transports'
import { server } from '@/test/server'

interface FakeUploadOptions {
  readonly uploadUrl: string
  readonly chunkSize: number
  readonly retryDelays: readonly number[]
  readonly storeFingerprintForResuming: boolean
  readonly onProgress: (sent: number, total: number) => void
  readonly onSuccess: () => void
  readonly onError: (
    error: Error & { originalResponse?: { getStatus: () => number } | null },
  ) => void
}

// Fausse classe Upload de tus-js-client : on garde les options et on pilote les rappels.
const tus = vi.hoisted(() => ({
  last: undefined as FakeUploadOptions | undefined,
  started: 0,
  aborted: [] as boolean[],
}))

vi.mock('tus-js-client', () => ({
  Upload: class {
    constructor(_file: File, options: FakeUploadOptions) {
      tus.last = options
    }
    start() {
      tus.started += 1
    }
    abort(shouldTerminate: boolean) {
      tus.aborted.push(shouldTerminate)
      return Promise.resolve()
    }
  },
}))

const UPLOAD_URL = 'https://upload.cloudflarestream.com/abc'
const file = () => new File([new Uint8Array(64)], 'video.mp4', { type: 'video/mp4' })

function lastTusOptions(): FakeUploadOptions {
  if (tus.last === undefined) throw new Error('Upload non créé')
  return tus.last
}

beforeEach(() => {
  tus.last = undefined
  tus.started = 0
  tus.aborted = []
})

describe('sendBasic : envoi simple (AC-7)', () => {
  it('envoie le fichier en multipart dans le champ « file », sans jeton', async () => {
    const seen: { field?: FormDataEntryValue | null; auth?: string | null } = {}
    server.use(
      http.post(UPLOAD_URL, async ({ request }) => {
        seen.auth = request.headers.get('authorization')
        seen.field = (await request.formData()).get('file')
        return new HttpResponse(null, { status: 200 })
      }),
    )

    await sendBasic(file(), UPLOAD_URL, () => {}).done

    // Le fichier reçu par MSW vient d'un autre domaine que jsdom : on lit sa taille, pas sa classe.
    expect(seen.field).toMatchObject({ size: 64 })
    expect(seen.auth).toBeNull()
  })

  it('classe un refus 4xx de Cloudflare comme « refusé »', async () => {
    server.use(http.post(UPLOAD_URL, () => new HttpResponse(null, { status: 413 })))

    await expect(sendBasic(file(), UPLOAD_URL, () => {}).done).rejects.toMatchObject({
      failure: 'refused',
      status: 413,
    })
  })

  it('classe une erreur 5xx comme une coupure', async () => {
    server.use(http.post(UPLOAD_URL, () => new HttpResponse(null, { status: 502 })))

    await expect(sendBasic(file(), UPLOAD_URL, () => {}).done).rejects.toMatchObject({
      failure: 'network',
    })
  })
})

describe('sendTus : envoi reprenable (AC-7)', () => {
  it('reprend le lien créé par le backend, en morceaux de 50 Mio', () => {
    sendTus(file(), UPLOAD_URL, () => {})

    expect(lastTusOptions()).toMatchObject({
      uploadUrl: UPLOAD_URL,
      chunkSize: 50 * 1024 * 1024,
      retryDelays: [0, 3000, 10_000, 30_000],
      storeFingerprintForResuming: false,
    })
    expect(tus.started).toBe(1)
  })

  it('transmet la progression et se termine sur le succès', async () => {
    const progress = vi.fn()
    const transfer = sendTus(file(), UPLOAD_URL, progress)

    lastTusOptions().onProgress(32, 64)
    lastTusOptions().onSuccess()

    await expect(transfer.done).resolves.toBeUndefined()
    expect(progress).toHaveBeenCalledWith(32, 64)
  })

  it('classe un refus 4xx comme « refusé » et le reste comme une coupure', async () => {
    const refused = sendTus(file(), UPLOAD_URL, () => {})
    lastTusOptions().onError(
      Object.assign(new Error('refus'), { originalResponse: { getStatus: () => 410 } }),
    )
    await expect(refused.done).rejects.toMatchObject({ failure: 'refused', status: 410 })

    const cut = sendTus(file(), UPLOAD_URL, () => {})
    lastTusOptions().onError(Object.assign(new Error('réseau'), { originalResponse: null }))
    await expect(cut.done).rejects.toMatchObject({ failure: 'network', status: undefined })
  })

  it('annule sans supprimer côté Cloudflare et rejette avec « aborted »', async () => {
    const transfer = sendTus(file(), UPLOAD_URL, () => {})

    transfer.abort()

    await expect(transfer.done).rejects.toBeInstanceOf(TransportError)
    await expect(transfer.done).rejects.toMatchObject({ failure: 'aborted' })
    expect(tus.aborted).toEqual([false])
  })
})
