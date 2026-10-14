import {
  EMPTY_SERIES_FORM,
  firstInvalidField,
  makeSeriesFormSchema,
  MESSAGES,
  toFormValues,
  type SeriesFormValues,
} from '@/features/series/seriesFormSchema'
import { changedFields, toCreatePayload, toSeriesPatch } from '@/features/series/seriesPayload'
import { adminSeriesSchema } from '@/features/series/schemas'

const base: SeriesFormValues = {
  title: 'Le Secret',
  description: 'Un médecin cache un passé.',
  categoryIds: ['c1', 'c2'],
  status: 'ongoing',
  languages: ['fr', 'fon'],
  country: 'Bénin',
  releaseYear: 2025,
  isPremium: true,
  freeEpisodeCount: 3,
}

function issues(
  values: SeriesFormValues,
  mode: 'create' | 'edit' = 'create',
  year: number | '' = '',
) {
  const result = makeSeriesFormSchema({ mode, initialReleaseYear: year }).safeParse(values)
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('toSeriesPatch (AC-7, AC-8)', () => {
  it('n’envoie rien sans changement', () => {
    expect(toSeriesPatch(base, base)).toEqual({})
  })

  it('n’envoie que le pays modifié', () => {
    expect(toSeriesPatch(base, { ...base, country: 'Togo' })).toEqual({ country: 'Togo' })
  })

  it('envoie null pour une description ou un pays vidés (espaces compris)', () => {
    expect(toSeriesPatch(base, { ...base, description: '   ', country: '' })).toEqual({
      description: null,
      country: null,
    })
  })

  it('compare le titre sans les espaces du bord et l’envoie nettoyé', () => {
    expect(toSeriesPatch(base, { ...base, title: '  Le Secret  ' })).toEqual({})
    expect(toSeriesPatch(base, { ...base, title: ' Le Secret 2 ' })).toEqual({
      title: 'Le Secret 2',
    })
  })

  it('compare catégories et langues comme des ensembles', () => {
    expect(
      toSeriesPatch(base, { ...base, categoryIds: ['c2', 'c1'], languages: ['fon', 'fr'] }),
    ).toEqual({})
    expect(toSeriesPatch(base, { ...base, categoryIds: ['c1'] })).toEqual({ categoryIds: ['c1'] })
  })

  it('n’envoie jamais une année vide', () => {
    expect(toSeriesPatch(base, { ...base, releaseYear: '' })).toEqual({})
    expect(toSeriesPatch(base, { ...base, releaseYear: 2024 })).toEqual({ releaseYear: 2024 })
  })

  it('décocher premium n’envoie que isPremium et garde le nombre de gratuits', () => {
    expect(toSeriesPatch(base, { ...base, isPremium: false })).toEqual({ isPremium: false })
  })

  it('liste les champs modifiés', () => {
    expect([...changedFields(base, { ...base, status: 'completed', releaseYear: '' })]).toEqual([
      'status',
      'releaseYear',
    ])
  })
})

describe('toCreatePayload (AC-4)', () => {
  it('n’envoie que les champs remplis, jamais null', () => {
    expect(
      toCreatePayload({ ...EMPTY_SERIES_FORM, title: '  Nouvelle  ', categoryIds: ['c1', 'c1'] }),
    ).toEqual({
      title: 'Nouvelle',
      categoryIds: ['c1'],
      status: 'ongoing',
      isPremium: false,
      freeEpisodeCount: 0,
    })
  })

  it('envoie les champs facultatifs remplis', () => {
    expect(toCreatePayload(base)).toEqual({
      title: 'Le Secret',
      categoryIds: ['c1', 'c2'],
      status: 'ongoing',
      isPremium: true,
      freeEpisodeCount: 3,
      description: 'Un médecin cache un passé.',
      languages: ['fr', 'fon'],
      country: 'Bénin',
      releaseYear: 2025,
    })
  })

  it('met 0 épisode gratuit pour une série non premium', () => {
    expect(toCreatePayload({ ...base, isPremium: false }).freeEpisodeCount).toBe(0)
  })
})

describe('makeSeriesFormSchema (AC-3)', () => {
  it('accepte un formulaire valide', () => {
    expect(issues(base)).toEqual({})
  })

  it('donne les messages en français sous chaque champ', () => {
    expect(
      issues({
        ...EMPTY_SERIES_FORM,
        title: '   ',
        description: 'x'.repeat(2001),
        languages: ['fr', 'FRA'],
        releaseYear: 1700,
        isPremium: true,
        freeEpisodeCount: -1,
      }),
    ).toEqual({
      title: MESSAGES.titleRequired,
      description: MESSAGES.descriptionTooLong,
      categoryIds: MESSAGES.categoriesRequired,
      languages: MESSAGES.languageInvalid,
      releaseYear: MESSAGES.yearInvalid,
      freeEpisodeCount: MESSAGES.freeEpisodesInvalid,
    })
  })

  it('refuse un titre de plus de 100 caractères et une année décimale', () => {
    expect(issues({ ...base, title: 'x'.repeat(101), releaseYear: 2020.5 })).toEqual({
      title: MESSAGES.titleTooLong,
      releaseYear: MESSAGES.yearInvalid,
    })
  })

  it('ignore les épisodes gratuits d’une série non premium', () => {
    expect(issues({ ...base, isPremium: false, freeEpisodeCount: '' })).toEqual({})
  })

  it('en modification, refuse de vider une année déjà renseignée', () => {
    expect(issues({ ...base, releaseYear: '' }, 'edit', 2025)).toEqual({
      releaseYear: MESSAGES.yearRemoved,
    })
    expect(issues({ ...base, releaseYear: '' }, 'edit', '')).toEqual({})
    expect(issues({ ...base, releaseYear: '' }, 'create', '')).toEqual({})
  })

  it('trouve le premier champ en erreur dans l’ordre d’affichage', () => {
    expect(firstInvalidField({ releaseYear: 'x', 'languages.1': 'y', title: 'z' })).toBe('title')
    expect(firstInvalidField({})).toBeUndefined()
  })
})

describe('toFormValues (AC-6)', () => {
  it('tire les valeurs de départ de la réponse admin', () => {
    const series = adminSeriesSchema.parse({
      _id: 's1',
      title: 'Le Secret',
      categories: [
        { _id: 'c1', name: 'Drame' },
        { _id: 'c9', name: 'Bientôt', isVisible: false },
      ],
      status: 'brouillon',
      description: null,
      country: null,
      languages: null,
      releaseYear: null,
      isPremium: true,
      freeEpisodeCount: 2,
    })

    expect(toFormValues(series)).toEqual({
      title: 'Le Secret',
      description: '',
      categoryIds: ['c1', 'c9'],
      status: 'ongoing',
      languages: [],
      country: '',
      releaseYear: '',
      isPremium: true,
      freeEpisodeCount: 2,
    })
    expect(series.categories[1]?.isVisible).toBe(false)
    expect(series.categories[0]?.isVisible).toBe(true)
  })
})
