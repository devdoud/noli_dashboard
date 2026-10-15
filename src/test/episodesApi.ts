import { http, HttpResponse } from 'msw'
import { API, categoriesHandler, makeAdminSeries, seriesHandler, SERIES_ID } from '@/test/seriesApi'

// Faux backend des épisodes et des images d'une série (specs 0006 et 0007) : il garde les épisodes, répond aux routes
// d'épisode et de vidéo comme l'API, et note chaque écriture reçue. Un test peut prendre le pas
// sur une route avec server.use(...) avant d'agir.

export const UPLOAD_HOST = 'https://upload.cloudflarestream.com'

export interface RawVideo {
  readonly status: string
  readonly pendingStreamUid?: string | null
  readonly pendingStatus?: string | null
  readonly pendingError?: string | null
  readonly hasPastedUrl?: boolean
}

export interface RawEpisode {
  readonly seasonNumber: number
  readonly episodeNumber: number
  readonly title: string
  readonly duration?: number
  readonly description?: string | null
  readonly releaseDate?: string
  readonly isFree?: boolean
  readonly video?: RawVideo
  readonly thumbnail?: string | null
}

export interface RecordedCall {
  readonly method: string
  readonly path: string
  readonly body: unknown
}

export function makeEpisode(
  seasonNumber: number,
  episodeNumber: number,
  overrides: Partial<RawEpisode> = {},
): RawEpisode {
  return {
    seasonNumber,
    episodeNumber,
    title: `Épisode ${String(episodeNumber)}`,
    duration: 1500,
    releaseDate: '2026-10-01T12:00:00.000Z',
    isFree: false,
    video: { status: 'none', hasPastedUrl: false },
    ...overrides,
  }
}

async function readBody(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.startsWith('multipart/form-data') === true) {
    const file = (await request.formData()).get('file')
    return typeof file === 'object' && file !== null
      ? { file: { name: file.name, size: file.size } }
      : { file }
  }
  const text = await request.text()
  if (text === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export const HOSTED_IMAGE = 'https://res.cloudinary.com/noli/image/upload/v1/noli/test/image.jpg'

export interface SeriesImages {
  readonly coverImage?: string | null
  readonly bannerImage?: string | null
}

export function episodesBackend(initial: readonly RawEpisode[], images: SeriesImages = {}) {
  const state = {
    episodes: [...initial],
    images: { coverImage: null, bannerImage: null, ...images } as SeriesImages,
  }
  const calls: RecordedCall[] = []
  const series = () =>
    makeAdminSeries({
      ...state.images,
      episodes: state.episodes,
      totalEpisodes: state.episodes.length,
    })
  const seriesResponse = () => HttpResponse.json({ message: 'ok', series: series() })
  const find = (s: unknown, e: unknown) =>
    state.episodes.find(
      (item) => item.seasonNumber === Number(s) && item.episodeNumber === Number(e),
    )
  const update = (s: unknown, e: unknown, change: (episode: RawEpisode) => RawEpisode) => {
    state.episodes = state.episodes.map((item) =>
      item.seasonNumber === Number(s) && item.episodeNumber === Number(e) ? change(item) : item,
    )
  }
  const record = async (request: Request) => {
    const body = await readBody(request.clone())
    calls.push({ method: request.method, path: new URL(request.url).pathname, body })
    return body
  }
  const gone = () => HttpResponse.json({ message: 'Episode not found' }, { status: 404 })
  const pendingVideo = (episode: RawEpisode, uid: string): RawVideo => ({
    ...episode.video,
    status: episode.video?.status === 'ready' ? 'ready' : 'pending',
    pendingStreamUid: uid,
    hasPastedUrl: episode.video?.hasPastedUrl ?? false,
  })
  const episodePath = `${API}/series/:id/episodes/:s/:e`

  const imageSlot = (slot: 'cover' | 'banner') => (slot === 'cover' ? 'coverImage' : 'bannerImage')

  const handlers = [
    http.put(`${API}/series/:id/:slot`, async ({ request, params }) => {
      if (params.slot !== 'cover' && params.slot !== 'banner') return undefined
      await record(request)
      state.images = {
        ...state.images,
        [imageSlot(params.slot)]: `${HOSTED_IMAGE}?${String(calls.length)}`,
      }
      return seriesResponse()
    }),
    http.delete(`${API}/series/:id/:slot`, async ({ request, params }) => {
      if (params.slot !== 'cover' && params.slot !== 'banner') return undefined
      await record(request)
      state.images = { ...state.images, [imageSlot(params.slot)]: null }
      return seriesResponse()
    }),
    http.put(`${episodePath}/thumbnail`, async ({ request, params }) => {
      await record(request)
      if (find(params.s, params.e) === undefined) return gone()
      update(params.s, params.e, (episode) => ({ ...episode, thumbnail: `${HOSTED_IMAGE}?t` }))
      return seriesResponse()
    }),
    http.delete(`${episodePath}/thumbnail`, async ({ request, params }) => {
      await record(request)
      if (find(params.s, params.e) === undefined) return gone()
      update(params.s, params.e, (episode) => ({ ...episode, thumbnail: null }))
      return seriesResponse()
    }),
    categoriesHandler(),
    seriesHandler(12),
    http.get(`${API}/series/:id/admin`, () => seriesResponse()),
    http.post(`${API}/series/:id/episodes`, async ({ request }) => {
      const body = (await record(request)) as RawEpisode
      if (find(body.seasonNumber, body.episodeNumber) !== undefined) {
        return HttpResponse.json(
          { message: 'Episode already exists', error: 'Bad Request', statusCode: 400 },
          { status: 400 },
        )
      }
      state.episodes = [...state.episodes, { ...makeEpisode(1, 1), ...body }]
      return seriesResponse()
    }),
    http.patch(episodePath, async ({ request, params }) => {
      const body = (await record(request)) as Partial<RawEpisode>
      if (find(params.s, params.e) === undefined) return gone()
      update(params.s, params.e, (episode) => ({ ...episode, ...body }))
      return seriesResponse()
    }),
    http.delete(episodePath, async ({ request, params }) => {
      await record(request)
      if (find(params.s, params.e) === undefined) return gone()
      state.episodes = state.episodes.filter((item) => item !== find(params.s, params.e))
      return seriesResponse()
    }),
    http.post(`${episodePath}/video/upload`, async ({ request, params }) => {
      const body = (await record(request)) as { uploadLength: number }
      if (find(params.s, params.e) === undefined) return gone()
      const uid = `up${String(calls.length)}`
      update(params.s, params.e, (episode) => ({
        ...episode,
        video: { ...pendingVideo(episode, uid), pendingStatus: 'awaiting_upload' },
      }))
      return HttpResponse.json({
        message: 'ok',
        method: body.uploadLength > 200 * 1024 * 1024 ? 'tus' : 'post',
        uploadUrl: `${UPLOAD_HOST}/${uid}`,
        uid,
        expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
      })
    }),
    http.post(`${UPLOAD_HOST}/:uid`, ({ request }) => {
      calls.push({ method: 'POST', path: new URL(request.url).pathname, body: undefined })
      return new HttpResponse(null, { status: 200 })
    }),
    http.post(`${episodePath}/video/import`, async ({ request, params }) => {
      await record(request)
      if (find(params.s, params.e) === undefined) return gone()
      update(params.s, params.e, (episode) => ({
        ...episode,
        video: { ...pendingVideo(episode, 'imp'), pendingStatus: 'processing' },
      }))
      return HttpResponse.json({ message: 'ok', uid: 'imp', pendingStatus: 'processing' })
    }),
    http.post(`${episodePath}/video/refresh`, async ({ request, params }) => {
      await record(request)
      if (find(params.s, params.e) === undefined) return gone()
      update(params.s, params.e, (episode) =>
        episode.video?.pendingStatus === 'awaiting_upload'
          ? { ...episode, video: { ...episode.video, pendingStatus: 'processing' } }
          : episode,
      )
      return seriesResponse()
    }),
    http.delete(`${episodePath}/video`, async ({ request, params }) => {
      await record(request)
      if (find(params.s, params.e) === undefined) return gone()
      update(params.s, params.e, (episode) => ({
        ...episode,
        video: { status: 'none', hasPastedUrl: false },
      }))
      return seriesResponse()
    }),
  ]

  return {
    handlers,
    calls,
    /** Les écritures reçues sur une route (méthode et fin de chemin). */
    callsTo: (method: string, pathEnd: string | RegExp) =>
      calls.filter(
        (call) =>
          call.method === method &&
          (typeof pathEnd === 'string' ? call.path.endsWith(pathEnd) : pathEnd.test(call.path)),
      ),
    episodes: () => state.episodes,
  }
}

export const DETAIL_PATH = `/series/${SERIES_ID}`

/** Réponse d'erreur au format de l'API. */
export function apiError(status: number, message: string) {
  return HttpResponse.json({ message, statusCode: status }, { status })
}
