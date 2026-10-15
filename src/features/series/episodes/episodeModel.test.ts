import {
  episodeKey,
  episodeName,
  findEpisode,
  groupBySeason,
  isEpisodeVisible,
  isVideoProcessing,
  needsPublishConfirm,
  nextEpisodeNumber,
  shouldPoll,
  suggestedSeason,
  videoBadge,
} from '@/features/series/episodes/episodeModel'
import type { AdminEpisode } from '@/features/series/schemas'

type Video = NonNullable<AdminEpisode['video']>

function episode(
  seasonNumber: number,
  episodeNumber: number,
  video?: Partial<Video>,
): AdminEpisode {
  return {
    seasonNumber,
    episodeNumber,
    title: `S${String(seasonNumber)}E${String(episodeNumber)}`,
    isFree: false,
    ...(video === undefined ? {} : { video: { status: 'none', hasPastedUrl: false, ...video } }),
  }
}

describe('groupBySeason (AC-1)', () => {
  it('range les saisons et les épisodes dans l’ordre croissant', () => {
    const groups = groupBySeason([episode(2, 1), episode(1, 3), episode(1, 1), episode(2, 2)])

    expect(groups.map((group) => group.seasonNumber)).toEqual([1, 2])
    expect(groups[0]?.episodes.map((item) => item.episodeNumber)).toEqual([1, 3])
    expect(groups[1]?.episodes.map((item) => item.episodeNumber)).toEqual([1, 2])
  })

  it('renvoie une liste vide sans épisode', () => {
    expect(groupBySeason([])).toEqual([])
  })

  it('ne modifie pas la liste reçue', () => {
    const list = [episode(1, 2), episode(1, 1)]

    groupBySeason(list)

    expect(list.map((item) => item.episodeNumber)).toEqual([2, 1])
  })
})

describe('valeurs proposées à l’ajout (AC-2)', () => {
  it('propose la saison 1 et l’épisode 1 sans épisode', () => {
    expect(suggestedSeason([])).toBe(1)
    expect(nextEpisodeNumber([], 1)).toBe(1)
  })

  it('propose la plus grande saison et le numéro libre suivant', () => {
    const list = [episode(1, 1), episode(2, 1), episode(2, 4)]

    expect(suggestedSeason(list)).toBe(2)
    expect(nextEpisodeNumber(list, 2)).toBe(5)
    expect(nextEpisodeNumber(list, 3)).toBe(1)
  })

  it('ramène la saison proposée à 100 au plus', () => {
    expect(suggestedSeason([episode(140, 1)])).toBe(100)
  })
})

describe('visibilité et publication (AC-12, AC-13)', () => {
  it.each([
    ['vidéo prête', { status: 'ready' }, true],
    ['ancien lien collé', { status: 'legacy', hasPastedUrl: true }, true],
    ['lien collé avec remplacement en erreur', { status: 'error', hasPastedUrl: true }, true],
    ['aucune vidéo', { status: 'none' }, false],
    ['premier envoi en traitement', { status: 'pending' }, false],
    ['premier envoi en erreur', { status: 'error' }, false],
  ] as const)('%s : visible %s', (_label, video, visible) => {
    const item = episode(1, 1, video)

    expect(isEpisodeVisible(item)).toBe(visible)
    expect(needsPublishConfirm(item)).toBe(!visible)
  })

  it('demande confirmation pour un épisode sans bloc vidéo ou pas encore créé', () => {
    expect(isEpisodeVisible(episode(1, 1))).toBe(false)
    expect(needsPublishConfirm(undefined)).toBe(true)
  })
})

describe('videoBadge (AC-11)', () => {
  it.each([
    [{ status: 'ready' }, { label: 'Prête', color: 'green' }],
    [
      { status: 'ready', pendingStatus: 'processing' },
      { label: 'Prête', color: 'green', detail: 'Remplacement en cours' },
    ],
    [
      { status: 'ready', pendingStatus: 'awaiting_upload' },
      { label: 'Prête', color: 'green', detail: 'Remplacement en cours' },
    ],
    [
      { status: 'ready', pendingStatus: 'error' },
      { label: 'Prête', color: 'green', detail: 'Le remplacement a échoué' },
    ],
    [{ status: 'pending' }, { label: 'En traitement', color: 'noliIndigo' }],
    [
      { status: 'pending', pendingStatus: 'awaiting_upload', hasPastedUrl: true },
      {
        label: 'En traitement',
        color: 'noliIndigo',
        detail: 'En attente du fichier · Ancien lien encore joué',
      },
    ],
    [
      { status: 'error', pendingError: 'upload_expired' },
      { label: 'Erreur', color: 'noliRed', detail: "Lien d'envoi expiré" },
    ],
    [
      { status: 'error', pendingError: 'Fichier illisible', hasPastedUrl: true },
      { label: 'Erreur', color: 'noliRed', detail: 'Fichier illisible · Ancien lien encore joué' },
    ],
    [
      { status: 'error', pendingError: '  ' },
      { label: 'Erreur', color: 'noliRed' },
    ],
    [{ status: 'legacy' }, { label: 'Lien collé', color: 'noliAmber', detail: 'Non protégé' }],
    [{ status: 'none' }, { label: 'Aucune vidéo', color: 'gray' }],
  ] as const)('%j → %j', (video, expected) => {
    expect(videoBadge(episode(1, 1, video))).toEqual(expected)
  })

  it('affiche « Aucune vidéo » sans bloc vidéo', () => {
    expect(videoBadge(episode(1, 1))).toEqual({ label: 'Aucune vidéo', color: 'gray' })
  })

  it('n’affiche rien pour un état inconnu', () => {
    expect(videoBadge(episode(1, 1, { status: 'autre' }))).toBeUndefined()
  })
})

describe('encodage et relecture automatique (AC-9)', () => {
  it('considère processing et awaiting_upload comme en traitement', () => {
    expect(
      isVideoProcessing(episode(1, 1, { status: 'pending', pendingStatus: 'processing' })),
    ).toBe(true)
    expect(
      isVideoProcessing(episode(1, 1, { status: 'pending', pendingStatus: 'awaiting_upload' })),
    ).toBe(true)
    expect(isVideoProcessing(episode(1, 1, { status: 'ready' }))).toBe(false)
    expect(isVideoProcessing(undefined)).toBe(false)
  })

  it('relit la fiche tant qu’un épisode est en processing', () => {
    const list = [episode(1, 1, { status: 'pending', pendingStatus: 'processing' })]

    expect(shouldPoll(list, () => false)).toBe(true)
  })

  it('ne relit pour awaiting_upload que si une tâche locale attend cet épisode', () => {
    const list = [episode(1, 2, { status: 'pending', pendingStatus: 'awaiting_upload' })]

    expect(shouldPoll(list, () => false)).toBe(false)
    expect(shouldPoll(list, (key) => key === episodeKey(1, 2))).toBe(true)
  })

  it('ne relit pas sans vidéo attendue', () => {
    expect(shouldPoll([episode(1, 1, { status: 'ready' }), episode(1, 2)], () => true)).toBe(false)
  })
})

describe('noms et recherche (AC-17)', () => {
  it('nomme l’épisode en toutes lettres', () => {
    expect(episodeName(1, 3)).toBe("l'épisode 3 de la saison 1")
  })

  it('distingue la clé de chaque couple saison et numéro', () => {
    expect(episodeKey(1, 12)).not.toBe(episodeKey(11, 2))
  })

  it('retrouve un épisode par saison et numéro', () => {
    const list = [episode(1, 1), episode(2, 1)]

    expect(findEpisode(list, 2, 1)?.title).toBe('S2E1')
    expect(findEpisode(list, 3, 1)).toBeUndefined()
  })
})
