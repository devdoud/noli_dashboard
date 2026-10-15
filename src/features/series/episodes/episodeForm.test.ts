import {
  changedEpisodeFields,
  EPISODE_MESSAGES,
  emptyEpisodeForm,
  isHttpsLink,
  makeEpisodeSchema,
  splitDuration,
  toDayInput,
  toEpisodeCreatePayload,
  toEpisodeFormValues,
  toEpisodePatch,
  toNoonUtc,
  totalSeconds,
  type EpisodeFormValues,
} from '@/features/series/episodes/episodeForm'

const base: EpisodeFormValues = {
  seasonNumber: 1,
  episodeNumber: 3,
  title: 'Le retour',
  durationMinutes: 24,
  durationSeconds: 30,
  description: 'Une description.',
  releaseDate: '2026-10-20',
}

function errorsOf(
  values: Partial<EpisodeFormValues>,
  mode: 'create' | 'edit' = 'create',
  initialReleaseDate = '',
): Readonly<Record<string, string>> {
  const result = makeEpisodeSchema({ mode, initialReleaseDate }).safeParse({ ...base, ...values })
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue): [string, string] => [String(issue.path[0]), issue.message]),
  )
}

describe('durée (AC-3, AC-4)', () => {
  it('convertit minutes et secondes en secondes', () => {
    expect(totalSeconds({ durationMinutes: 24, durationSeconds: 30 })).toBe(1470)
    expect(totalSeconds({ durationMinutes: '', durationSeconds: 5 })).toBe(5)
  })

  it('découpe une durée en minutes et secondes, 0 si elle manque', () => {
    expect(splitDuration(1470)).toEqual({ durationMinutes: 24, durationSeconds: 30 })
    expect(splitDuration(4.6)).toEqual({ durationMinutes: 0, durationSeconds: 5 })
    expect(splitDuration(null)).toEqual({ durationMinutes: 0, durationSeconds: 0 })
    expect(splitDuration(-3)).toEqual({ durationMinutes: 0, durationSeconds: 0 })
  })
})

describe('date de sortie à midi UTC', () => {
  it('envoie le jour saisi à midi UTC', () => {
    expect(toNoonUtc('2026-10-20')).toBe('2026-10-20T12:00:00.000Z')
  })

  it('préremplit le jour en UTC, quel que soit l’heure enregistrée', () => {
    expect(toDayInput('2026-10-20T23:30:00.000Z')).toBe('2026-10-20')
    expect(toDayInput('2026-10-20T00:30:00.000Z')).toBe('2026-10-20')
  })

  it('laisse vide une date absente ou illisible', () => {
    expect(toDayInput(null)).toBe('')
    expect(toDayInput('pas une date')).toBe('')
  })
})

describe('isHttpsLink (AC-3, AC-8)', () => {
  it.each([
    ['https://cdn.exemple.com/v.mp4', true],
    ['  https://cdn.exemple.com/v.mp4  ', true],
    ['http://cdn.exemple.com/v.mp4', false],
    ['https://localhost/v.mp4', false],
    ['ftp://cdn.exemple.com/v.mp4', false],
    ['cdn.exemple.com/v.mp4', false],
    ['', false],
  ])('%s → %s', (link, expected) => {
    expect(isHttpsLink(link)).toBe(expected)
  })
})

describe('makeEpisodeSchema (AC-3, AC-6)', () => {
  it('accepte un épisode valide', () => {
    expect(errorsOf({})).toEqual({})
  })

  it.each([
    [{ seasonNumber: 0 }, 'seasonNumber', EPISODE_MESSAGES.season],
    [{ seasonNumber: 101 }, 'seasonNumber', EPISODE_MESSAGES.season],
    [{ seasonNumber: 1.5 }, 'seasonNumber', EPISODE_MESSAGES.season],
    [{ seasonNumber: '' }, 'seasonNumber', EPISODE_MESSAGES.season],
    [{ episodeNumber: 1001 }, 'episodeNumber', EPISODE_MESSAGES.episode],
    [{ title: '   ' }, 'title', EPISODE_MESSAGES.titleRequired],
    [{ title: 'a'.repeat(101) }, 'title', EPISODE_MESSAGES.titleTooLong],
    [{ description: 'a'.repeat(1001) }, 'description', EPISODE_MESSAGES.descriptionTooLong],
    [{ durationMinutes: 0, durationSeconds: 0 }, 'durationMinutes', EPISODE_MESSAGES.durationMin],
    [{ durationMinutes: '', durationSeconds: '' }, 'durationMinutes', EPISODE_MESSAGES.durationMin],
    [{ durationSeconds: 75 }, 'durationSeconds', EPISODE_MESSAGES.seconds],
    [{ durationMinutes: 601 }, 'durationMinutes', EPISODE_MESSAGES.minutes],
    [{ releaseDate: '2026-02-30' }, 'releaseDate', EPISODE_MESSAGES.dateInvalid],
    [{ releaseDate: '20/10/2026' }, 'releaseDate', EPISODE_MESSAGES.dateInvalid],
  ] as const)('%j → %s : %s', (values, field, message) => {
    expect(errorsOf(values)[field]).toBe(message)
  })

  it('accepte les bornes : saison 100, numéro 1 000, 600 min 59 s, 100 caractères', () => {
    expect(
      errorsOf({
        seasonNumber: 100,
        episodeNumber: 1000,
        durationMinutes: 600,
        durationSeconds: 59,
        title: 'a'.repeat(100),
        description: 'a'.repeat(1000),
      }),
    ).toEqual({})
  })

  it('accepte une date vide à l’ajout', () => {
    expect(errorsOf({ releaseDate: '' })).toEqual({})
  })

  it('refuse de vider une date déjà renseignée en modification', () => {
    expect(errorsOf({ releaseDate: '' }, 'edit', '2026-10-20').releaseDate).toBe(
      EPISODE_MESSAGES.dateRemoved,
    )
  })

  it('ne valide pas saison et numéro en modification', () => {
    expect(errorsOf({ seasonNumber: '', episodeNumber: '' }, 'edit', '2026-10-20')).toEqual({})
  })
})

describe('valeurs de départ (AC-2, AC-6)', () => {
  it('prépare un formulaire vide avec saison et numéro proposés', () => {
    expect(emptyEpisodeForm(2, 5)).toEqual({
      seasonNumber: 2,
      episodeNumber: 5,
      title: '',
      durationMinutes: 0,
      durationSeconds: 0,
      description: '',
      releaseDate: '',
    })
  })

  it('préremplit depuis l’épisode, durée découpée et date en UTC', () => {
    expect(
      toEpisodeFormValues({
        seasonNumber: 1,
        episodeNumber: 3,
        title: 'Le retour',
        description: null,
        duration: 1470,
        releaseDate: '2026-10-20T12:00:00.000Z',
        isFree: false,
      }),
    ).toEqual({ ...base, description: '' })
  })
})

describe('toEpisodeCreatePayload (AC-4)', () => {
  it('envoie les champs remplis, la durée en secondes et la date à midi UTC', () => {
    expect(toEpisodeCreatePayload({ ...base, title: '  Le retour  ' })).toEqual({
      seasonNumber: 1,
      episodeNumber: 3,
      title: 'Le retour',
      duration: 1470,
      description: 'Une description.',
      releaseDate: '2026-10-20T12:00:00.000Z',
    })
  })

  it('n’envoie ni description ni date vides, ni null, ni lien vidéo', () => {
    const payload = toEpisodeCreatePayload({ ...base, description: '   ', releaseDate: '' })

    expect(payload).not.toHaveProperty('description')
    expect(payload).not.toHaveProperty('releaseDate')
    expect(payload).not.toHaveProperty('videoUrl')
    expect(Object.values(payload)).not.toContain(null)
  })
})

describe('modification : champs changés et PATCH (AC-6)', () => {
  it('ne voit aucun changement sur des valeurs identiques ou aux espaces près', () => {
    expect(changedEpisodeFields(base, { ...base, title: ' Le retour ' }).size).toBe(0)
  })

  it('n’envoie que le titre modifié', () => {
    expect(toEpisodePatch(base, { ...base, title: 'Nouveau titre' })).toEqual({
      title: 'Nouveau titre',
    })
  })

  it('envoie la durée en secondes quand minutes ou secondes changent', () => {
    expect(toEpisodePatch(base, { ...base, durationSeconds: 45 })).toEqual({ duration: 1485 })
  })

  it('envoie null pour une description vidée', () => {
    expect(toEpisodePatch(base, { ...base, description: '' })).toEqual({ description: null })
  })

  it('n’envoie jamais une date vidée ni une durée nulle', () => {
    const values = { ...base, releaseDate: '', durationMinutes: 0, durationSeconds: 0 }

    expect(changedEpisodeFields(base, values)).toEqual(new Set(['duration', 'releaseDate']))
    expect(toEpisodePatch(base, values)).toEqual({})
  })

  it('envoie une date modifiée à midi UTC', () => {
    expect(toEpisodePatch(base, { ...base, releaseDate: '2026-11-01' })).toEqual({
      releaseDate: '2026-11-01T12:00:00.000Z',
    })
  })
})
