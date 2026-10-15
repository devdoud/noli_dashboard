import { ApiError } from '@/shared/api/errors'
import { toUserMessage } from '@/shared/api/messages'

const http = (status: number, extra: Partial<ConstructorParameters<typeof ApiError>[0]> = {}) =>
  new ApiError({ kind: 'http', status, ...extra })

describe('toUserMessage', () => {
  it.each([
    [
      new ApiError({ kind: 'network' }),
      'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.',
    ],
    [new ApiError({ kind: 'timeout' }), 'Le serveur ne répond pas. Réessayez dans un instant.'],
    [http(400), 'Certaines informations sont invalides.'],
    [http(401), 'Email ou mot de passe incorrect.'],
    [new ApiError({ kind: 'not-admin' }), "Ce compte n'a pas accès au tableau de bord."],
    [http(403), 'Une erreur inattendue est survenue.'],
    [http(403, { code: 'PREMIUM_REQUIRED' }), 'Une erreur inattendue est survenue.'],
    [
      new ApiError({ kind: 'session-ended', reason: 'expired' }),
      'Votre session a expiré, reconnectez vous.',
    ],
    [
      new ApiError({ kind: 'session-ended', reason: 'forbidden' }),
      "Ce compte n'a plus accès au tableau de bord.",
    ],
    [http(404), 'Élément introuvable. Il a peut être été supprimé.'],
    [http(409), 'Cet élément existe déjà (nom ou titre déjà pris).'],
    [http(413), 'Fichier trop lourd : 5 Mo au plus.'],
    [http(415), 'Format non accepté : JPEG, PNG ou WebP.'],
    [
      http(429),
      "Trop de demandes : 10 envois d'images toutes les 10 minutes au plus. Réessayez dans quelques minutes.",
    ],
    [
      http(503, { code: 'PUSH_UNAVAILABLE' }),
      'Les notifications ne sont pas configurées sur le serveur.',
    ],
    [http(503), 'Service momentanément indisponible.'],
    [http(500), 'Erreur du serveur. Réessayez dans un instant.'],
    [http(502), 'Erreur du serveur. Réessayez dans un instant.'],
    [new ApiError({ kind: 'invalid-response' }), 'Réponse inattendue du serveur.'],
    [http(418), 'Une erreur inattendue est survenue.'],
  ])('traduit %o', (error, expected) => {
    expect(toUserMessage(error).message).toBe(expected)
  })

  it('indique le nombre de séries pour CATEGORY_IN_USE', () => {
    const error = http(409, {
      code: 'CATEGORY_IN_USE',
      body: { code: 'CATEGORY_IN_USE', seriesCount: 3 },
    })
    expect(toUserMessage(error).message).toBe(
      "Cette catégorie est encore utilisée par 3 série(s). Retirez-la de ces séries d'abord.",
    )
  })

  it('a une formulation de secours sans seriesCount', () => {
    const error = http(409, { code: 'CATEGORY_IN_USE', body: { seriesCount: 'beaucoup' } })
    expect(toUserMessage(error).message).toBe(
      "Cette catégorie est encore utilisée par des séries. Retirez-la de ces séries d'abord.",
    )
  })

  it('garde le texte du backend en détail', () => {
    const error = http(400, {
      backendMessage: ['title should not be empty', 'duration must be a number'],
    })
    expect(toUserMessage(error)).toEqual({
      message: 'Certaines informations sont invalides.',
      details: 'title should not be empty\nduration must be a number',
    })
  })

  it('applique un remplacement par code avant le statut', () => {
    const error = http(404, { code: 'SERIES_NOT_FOUND' })
    expect(toUserMessage(error, { '404': 'Série introuvable.' }).message).toBe('Série introuvable.')
    expect(
      toUserMessage(error, { SERIES_NOT_FOUND: 'Par code.', '404': 'Par statut.' }).message,
    ).toBe('Par code.')
  })

  it('ne révèle jamais le message d’une erreur inconnue', () => {
    expect(toUserMessage(new TypeError('token=secret'))).toEqual({
      message: 'Une erreur inattendue est survenue.',
    })
  })
})

describe('toUserMessage, cas limites (AC-10, AC-15)', () => {
  it('ne donne de détail que pour une erreur http', () => {
    expect(toUserMessage(new ApiError({ kind: 'network', backendMessage: 'boom' }))).toEqual({
      message: 'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.',
    })
  })

  it('ignore un texte backend vide ou fait d’espaces', () => {
    expect(toUserMessage(http(400, { backendMessage: '   ' }))).toEqual({
      message: 'Certaines informations sont invalides.',
    })
  })

  it('garde un message 403 de session finie distinct du 403 ordinaire', () => {
    expect(
      toUserMessage(new ApiError({ kind: 'session-ended', reason: 'forbidden' })).message,
    ).not.toBe(toUserMessage(http(403)).message)
  })

  it('applique un remplacement par statut sans toucher aux autres statuts', () => {
    const overrides = { '404': 'Série introuvable.' }
    expect(toUserMessage(http(409), overrides).message).toBe(
      'Cet élément existe déjà (nom ou titre déjà pris).',
    )
  })
})
