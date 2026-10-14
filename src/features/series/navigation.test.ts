import {
  AFRICAN_COUNTRY_CODES,
  countryGroups,
  OTHER_COUNTRY_CODES,
} from '@/features/series/countries'
import { languageLabel } from '@/features/series/languages'
import { backToListPath, isSeriesId, titleMatches } from '@/features/series/navigation'

describe('isSeriesId (AC-6)', () => {
  it.each([
    ['6ac0e7848db827737b2141dc', true],
    ['6AC0E7848DB827737B2141DC', true],
    ['abc', false],
    ['nouvelle', false],
    ['6ac0e7848db827737b2141dz', false],
    [undefined, false],
  ])('%s → %s', (id, expected) => {
    expect(isSeriesId(id)).toBe(expected)
  })
})

describe('backToListPath', () => {
  it.each([
    [{ from: '/series?page=3' }, '/series?page=3'],
    [{ from: '/series' }, '/series'],
    [{ from: '//evil.com' }, '/series'],
    [{ from: '/series?x=\\y' }, '/series'],
    [{ from: '/connexion' }, '/series'],
    [{ from: 42 }, '/series'],
    [null, '/series'],
    [undefined, '/series'],
  ])('%o → %s', (state, expected) => {
    expect(backToListPath(state)).toBe(expected)
  })
})

describe('titleMatches (AC-13)', () => {
  it('accepte le titre exact, avec des espaces au bord', () => {
    expect(titleMatches('  Le Secret  ', 'Le Secret')).toBe(true)
  })

  it('regroupe les espaces, y compris insécables, des deux côtés', () => {
    expect(titleMatches('Le Secret du Docteur', 'Le  Secret du Docteur')).toBe(true)
  })

  it('compare la forme Unicode normalisée', () => {
    expect(titleMatches('Bénin', 'Bénin')).toBe(true)
  })

  it('exige la même casse et les mêmes accents', () => {
    expect(titleMatches('le secret', 'Le Secret')).toBe(false)
    expect(titleMatches('Benin', 'Bénin')).toBe(false)
    expect(titleMatches('', '')).toBe(false)
  })
})

describe('pays (AC-11)', () => {
  it('liste 249 codes sans doublon, dont 54 pour l’Afrique', () => {
    const all = [...AFRICAN_COUNTRY_CODES, ...OTHER_COUNTRY_CODES]
    expect(AFRICAN_COUNTRY_CODES).toHaveLength(54)
    expect(all).toHaveLength(249)
    expect(new Set(all).size).toBe(249)
  })

  it('met l’Afrique en premier, avec les noms français de la production', () => {
    const [africa] = countryGroups('')
    expect(africa?.group).toBe('Afrique')
    expect(africa?.items).toContain('Bénin')
    expect(africa?.items).toContain('Côte d’Ivoire')
  })

  it('ajoute une valeur actuelle hors liste, une seule fois', () => {
    expect(countryGroups('USA')[0]).toEqual({ group: 'Valeur actuelle', items: ['USA'] })
    expect(countryGroups('Bénin')[0]?.group).toBe('Afrique')
  })
})

describe('langues (AC-10)', () => {
  it.each([
    ['fr', 'Français (fr)'],
    ['fon', 'Fon (fon)'],
    ['de', 'Allemand (de)'],
    ['French', 'French'],
    ['Français', 'Français'],
  ])('%s s’affiche « %s »', (code, label) => {
    expect(languageLabel(code)).toBe(label)
  })
})
