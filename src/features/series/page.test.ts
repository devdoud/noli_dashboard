import { lastPage, parsePage } from '@/features/series/page'
import { formatRating, freeEpisodesLabel, statusLabel } from '@/features/series/seriesFormat'

describe('parsePage (AC-9)', () => {
  it.each([
    ['1', 1],
    ['2', 2],
    ['10000', 10_000],
    ['007', 7],
  ])('lit %s comme la page %i', (raw, expected) => {
    expect(parsePage(raw)).toBe(expected)
  })

  it.each([null, undefined, '', 'abc', '2abc', '1.5', '-1', '0', '10001', '99999', ' 2', '1e3'])(
    'ramène %s à la page 1',
    (raw) => {
      expect(parsePage(raw)).toBe(1)
    },
  )

  it('calcule la dernière page par 20', () => {
    expect(lastPage(45)).toBe(3)
    expect(lastPage(40)).toBe(2)
    expect(lastPage(0)).toBe(1)
  })
})

describe('libellés des colonnes (AC-8)', () => {
  it('écrit la note avec une décimale à la française', () => {
    expect(formatRating(8.43)).toBe('8,4')
    expect(formatRating(0)).toBe('0,0')
    expect(formatRating(10)).toBe('10,0')
  })

  it('accorde le nombre d’épisodes gratuits', () => {
    expect(freeEpisodesLabel(0)).toBe('aucun gratuit')
    expect(freeEpisodesLabel(1)).toBe('1 gratuit')
    expect(freeEpisodesLabel(2)).toBe('2 gratuits')
  })

  it('traduit le statut et ignore les valeurs inconnues', () => {
    expect(statusLabel('ongoing')?.label).toBe('En cours')
    expect(statusLabel('completed')?.label).toBe('Terminée')
    expect(statusLabel('brouillon')).toBeUndefined()
    expect(statusLabel(null)).toBeUndefined()
  })
})
