import {
  hasFilters,
  makeFilters,
  normalizeSearch,
  parseFilters,
  resultCountText,
  searchValue,
  toApiQuery,
  videosToProcessText,
  withFilters,
} from '@/features/series/filters'

const CAT = '65a1b2c3d4e5f6a7b8c9d0e2'

describe('filtres de la liste (spec 0009)', () => {
  it('nettoie la recherche : bords et espaces répétés (AC-2)', () => {
    expect(normalizeSearch('  le   secret ')).toBe('le secret')
    expect(searchValue('  le   secret ')).toBe('le secret')
  })

  it('ignore une recherche de moins de 2 ou de plus de 100 caractères (AC-2, AC-5)', () => {
    expect(searchValue('m')).toBeUndefined()
    expect(searchValue('  m  ')).toBeUndefined()
    expect(searchValue('')).toBeUndefined()
    expect(searchValue(null)).toBeUndefined()
    expect(searchValue('me')).toBe('me')
    expect(searchValue('a'.repeat(100))).toHaveLength(100)
    expect(searchValue('a'.repeat(101))).toBeUndefined()
  })

  it('lit les filtres valides de l’adresse et ignore les autres (AC-4, AC-5)', () => {
    expect(
      parseFilters(new URLSearchParams(`q=mensah&categorie=${CAT}&acces=premium&page=2`)),
    ).toEqual({ q: 'mensah', categoryId: CAT, access: 'premium' })
    expect(parseFilters(new URLSearchParams('acces=gratuites'))).toEqual({ access: 'gratuites' })
    expect(parseFilters(new URLSearchParams('q=x&acces=vip&categorie=drame'))).toEqual({})
    expect(parseFilters(new URLSearchParams(''))).toEqual({})
  })

  it('écrit l’adresse dans l’ordre q, categorie, acces, page, page 1 omise (AC-4)', () => {
    expect(withFilters({ access: 'premium', categoryId: CAT, q: 'le secret' }, 3).toString()).toBe(
      `q=le+secret&categorie=${CAT}&acces=premium&page=3`,
    )
    expect(withFilters({ q: 'me' }, 1).toString()).toBe('q=me')
    expect(withFilters({}, 1).toString()).toBe('')
    expect(withFilters({}, 2).toString()).toBe('page=2')
  })

  it('relit sans perte une adresse qu’il a écrite', () => {
    const filters = { q: 'comédie (1)', categoryId: CAT, access: 'gratuites' } as const
    expect(parseFilters(withFilters(filters, 4))).toEqual(filters)
  })

  it('construit des filtres sans clé absente, dans un ordre fixe (clé de cache stable)', () => {
    const built = makeFilters({ access: 'premium', q: undefined, categoryId: CAT })
    expect(built).toEqual({ categoryId: CAT, access: 'premium' })
    expect(Object.keys(built)).toEqual(['categoryId', 'access'])
    expect('q' in built).toBe(false)
  })

  it('dit si un filtre est actif', () => {
    expect(hasFilters({})).toBe(false)
    expect(hasFilters({ q: 'me' })).toBe(true)
    expect(hasFilters({ categoryId: CAT })).toBe(true)
    expect(hasFilters({ access: 'gratuites' })).toBe(true)
  })

  it('traduit les filtres en paramètres de la route admin (AC-3)', () => {
    expect(toApiQuery({}, 1)).toEqual({ page: 1, limit: 20 })
    expect(toApiQuery({ q: 'me', categoryId: CAT, access: 'premium' }, 2)).toEqual({
      page: 2,
      limit: 20,
      q: 'me',
      categoryId: CAT,
      premium: 'true',
    })
    expect(toApiQuery({ access: 'gratuites' }, 0)).toEqual({ page: 1, limit: 20, premium: 'false' })
  })

  it('accorde le compte des résultats (AC-6)', () => {
    expect(resultCountText(0)).toBe('0 série trouvée')
    expect(resultCountText(1)).toBe('1 série trouvée')
    expect(resultCountText(3)).toBe('3 séries trouvées')
  })
})

describe('filtre « Vidéos » (spec 0010)', () => {
  it('lit « videos=a-traiter » et ignore toute autre valeur (AC-4)', () => {
    expect(parseFilters(new URLSearchParams('videos=a-traiter'))).toEqual({ videos: 'a-traiter' })
    expect(parseFilters(new URLSearchParams('videos=toutes'))).toEqual({})
    expect(parseFilters(new URLSearchParams('videos='))).toEqual({})
  })

  it('écrit videos après acces et avant page, et relit sans perte (AC-4)', () => {
    const filters = { q: 'me', categoryId: CAT, access: 'premium', videos: 'a-traiter' } as const
    expect(withFilters(filters, 2).toString()).toBe(
      `q=me&categorie=${CAT}&acces=premium&videos=a-traiter&page=2`,
    )
    expect(parseFilters(withFilters(filters, 2))).toEqual(filters)
    expect(Object.keys(makeFilters({ videos: 'a-traiter', q: 'me' }))).toEqual(['q', 'videos'])
  })

  it('compte comme un filtre actif et demande video=todo à l’API (AC-4)', () => {
    expect(hasFilters({ videos: 'a-traiter' })).toBe(true)
    expect(toApiQuery({ videos: 'a-traiter' }, 1)).toEqual({ page: 1, limit: 20, video: 'todo' })
    expect('video' in toApiQuery({}, 1)).toBe(false)
  })

  it('écrit le compte d’une ligne au singulier à 0 et 1 (AC-5)', () => {
    expect(videosToProcessText(3)).toBe('3 vidéos à traiter')
    expect(videosToProcessText(1)).toBe('1 vidéo à traiter')
    expect(videosToProcessText(0)).toBe('0 vidéo à traiter')
  })
})
