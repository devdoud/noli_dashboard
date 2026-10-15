import { EPISODE_MESSAGES } from '@/features/series/episodes/episodeForm'
import {
  EPISODE_VIDEO_OVERRIDES,
  importRefusal,
  isHttpStatus,
  VIDEO_MESSAGE_OVERRIDES,
} from '@/features/series/episodes/videoMessages'
import { ApiError } from '@/shared/api/errors'
import { toUserMessage } from '@/shared/api/messages'

function http(status: number, backendMessage?: string | readonly string[]): ApiError {
  return new ApiError({
    kind: 'http',
    status,
    ...(backendMessage === undefined ? {} : { backendMessage }),
  })
}

describe('textes des routes vidéo (AC-16)', () => {
  it('reconnaît 429 et 503 à leur seul statut', () => {
    expect(toUserMessage(http(429), VIDEO_MESSAGE_OVERRIDES).message).toBe(
      "Trop d'envois en peu de temps : réessayez dans quelques minutes.",
    )
    expect(toUserMessage(http(503), VIDEO_MESSAGE_OVERRIDES).message).toBe(
      'Le service vidéo est indisponible pour le moment.',
    )
  })

  it('vise l’épisode sur un 404 d’une action vidéo', () => {
    expect(toUserMessage(http(404), EPISODE_VIDEO_OVERRIDES).message).toBe(
      "Cet épisode n'existe plus.",
    )
  })
})

describe('importRefusal (AC-8)', () => {
  it('montre le message du backend pour un refus de Cloudflare', () => {
    expect(importRefusal(http(400, 'Lien vidéo refusé par Cloudflare : fichier illisible'))).toBe(
      'Lien vidéo refusé par Cloudflare : fichier illisible',
    )
  })

  it('montre la règle du lien pour un lien non https, même en tableau', () => {
    expect(importRefusal(http(400, ['url must be a URL address']))).toBe(EPISODE_MESSAGES.link)
    expect(importRefusal(http(400, 'url must use the https protocol'))).toBe(EPISODE_MESSAGES.link)
  })

  it('montre la règle du lien quand le backend ne dit rien', () => {
    expect(importRefusal(http(400))).toBe(EPISODE_MESSAGES.link)
  })

  it('ne traite que les 400', () => {
    expect(importRefusal(http(409, 'Conflict'))).toBeUndefined()
    expect(importRefusal(new Error('réseau'))).toBeUndefined()
  })

  it('isHttpStatus compare le statut d’une erreur HTTP seulement', () => {
    expect(isHttpStatus(http(404), 404)).toBe(true)
    expect(isHttpStatus(http(404), 409)).toBe(false)
    expect(isHttpStatus(new ApiError({ kind: 'network' }), 404)).toBe(false)
  })
})
