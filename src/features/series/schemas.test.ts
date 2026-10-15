import {
  adminSeriesSchema,
  seriesPageSchema,
  seriesSummarySchema,
  videoUploadLinkSchema,
} from '@/features/series/schemas'

const minimal = { _id: 's1', title: 'Série 1' }

describe('seriesSummarySchema, schéma tolérant (AC-8)', () => {
  it('remplace les champs d’affichage absents par leurs valeurs neutres', () => {
    const series = seriesSummarySchema.parse(minimal)

    expect(series).toEqual({
      _id: 's1',
      title: 'Série 1',
      categories: [],
      isPremium: false,
      freeEpisodeCount: 0,
      totalEpisodes: 0,
      rating: 0,
      votes: 0,
    })
  })

  it('accepte null partout où l’API peut en renvoyer', () => {
    const series = seriesSummarySchema.parse({
      ...minimal,
      coverImage: null,
      categories: null,
      status: null,
      isPremium: null,
      freeEpisodeCount: null,
      totalEpisodes: null,
      rating: null,
      votes: null,
      updatedAt: null,
    })

    expect(series.categories).toEqual([])
    expect(series.votes).toBe(0)
    expect(series.rating).toBe(0)
    expect(series.coverImage).toBeNull()
    expect(series.updatedAt).toBeNull()
  })

  it('garde un statut inconnu tel quel, pour l’afficher « — »', () => {
    expect(seriesSummarySchema.parse({ ...minimal, status: 'brouillon' }).status).toBe('brouillon')
  })

  it('retire les champs inconnus', () => {
    const series = seriesSummarySchema.parse({ ...minimal, description: 'texte', bannerImage: 'x' })

    expect(series).not.toHaveProperty('description')
    expect(series).not.toHaveProperty('bannerImage')
  })

  it.each([
    ['sans identifiant', { title: 'x' }],
    ['sans titre', { _id: 's1' }],
    ['avec un nombre d’épisodes négatif', { ...minimal, totalEpisodes: -1 }],
    ['avec un nombre de votes décimal', { ...minimal, votes: 1.5 }],
    ['avec une catégorie sans nom', { ...minimal, categories: [{ _id: 'c1' }] }],
  ])('refuse une série %s', (_label, raw) => {
    expect(seriesSummarySchema.safeParse(raw).success).toBe(false)
  })
})

describe('seriesPageSchema (AC-8, AC-9)', () => {
  it('lit le total, la page et les séries de la réponse', () => {
    const page = seriesPageSchema.parse({
      message: 'ok',
      data: { total: 45, page: 3, limit: 20, series: [minimal] },
    })

    expect(page.data.total).toBe(45)
    expect(page.data.page).toBe(3)
    expect(page.data.series).toHaveLength(1)
  })

  it('accepte une page vide au delà de la fin avec le vrai total', () => {
    const page = seriesPageSchema.parse({ data: { total: 45, page: 99, limit: 20, series: [] } })

    expect(page.data.series).toEqual([])
    expect(page.data.total).toBe(45)
  })

  it.each([
    ['sans enveloppe data', { total: 1, page: 1, limit: 20, series: [] }],
    ['avec un total négatif', { data: { total: -1, page: 1, limit: 20, series: [] } }],
    ['sans liste de séries', { data: { total: 0, page: 1, limit: 20 } }],
  ])('refuse une réponse %s', (_label, raw) => {
    expect(seriesPageSchema.safeParse(raw).success).toBe(false)
  })
})

describe('épisodes de la fiche admin (spec 0006)', () => {
  const series = { _id: 's1', title: 'Série', categories: [] }

  it('garde les épisodes avec leur vidéo et complète les champs absents', () => {
    const parsed = adminSeriesSchema.parse({
      ...series,
      episodes: [
        {
          seasonNumber: 1,
          episodeNumber: 2,
          title: 'Deux',
          duration: 1470,
          isFree: null,
          video: { status: 'legacy', pendingStatus: null },
        },
      ],
    })

    expect(parsed.episodes[0]).toMatchObject({ isFree: false, video: { hasPastedUrl: false } })
  })

  it('renvoie une liste vide sans épisodes', () => {
    expect(adminSeriesSchema.parse({ ...series, episodes: null }).episodes).toEqual([])
    expect(adminSeriesSchema.parse(series).episodes).toEqual([])
  })

  it('refuse un lien d’envoi d’une méthode inconnue', () => {
    const link = {
      uploadUrl: 'https://upload.cloudflarestream.com/x',
      uid: 'x',
      expiresAt: '2026-10-15T18:00:00.000Z',
    }

    expect(videoUploadLinkSchema.safeParse({ ...link, method: 'tus' }).success).toBe(true)
    expect(videoUploadLinkSchema.safeParse({ ...link, method: 'ftp' }).success).toBe(false)
  })
})
