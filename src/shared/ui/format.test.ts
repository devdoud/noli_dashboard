import { formatDate, formatDateTime, formatDuration, MISSING_VALUE } from '@/shared/ui/format'
import { pageCount, rangeSummary } from '@/shared/ui/pagination'

describe('formatDuration (AC-11)', () => {
  it.each([
    [30, "moins d'1 min"],
    [59, "moins d'1 min"],
    [60, '1 min'],
    [1500, '25 min'],
    [1559, '25 min'],
    [3600, '1 h 00'],
    [3900, '1 h 05'],
    [7260, '2 h 01'],
  ])('formate %i secondes en « %s »', (seconds, expected) => {
    expect(formatDuration(seconds)).toBe(expected)
  })

  it.each([[0], [-5], [Number.NaN], [Number.POSITIVE_INFINITY], [undefined], [null]])(
    'affiche « — » pour %s',
    (value) => {
      expect(formatDuration(value)).toBe(MISSING_VALUE)
    },
  )
})

describe('formatDate et formatDateTime (AC-11)', () => {
  it('formate une date en français court', () => {
    expect(formatDate(new Date(2026, 9, 13, 14, 5).toISOString())).toBe('13 oct. 2026')
  })

  it('ajoute l’heure locale', () => {
    expect(formatDateTime(new Date(2026, 9, 13, 14, 5).toISOString())).toBe('13 oct. 2026, 14:05')
  })

  it.each([[undefined], [null], [''], ['pas une date']])('affiche « — » pour %s', (value) => {
    expect(formatDate(value)).toBe(MISSING_VALUE)
    expect(formatDateTime(value)).toBe(MISSING_VALUE)
  })
})

describe('pagination (AC-8)', () => {
  it('compte au moins une page', () => {
    expect(pageCount(0, 20)).toBe(1)
    expect(pageCount(134, 20)).toBe(7)
    expect(pageCount(140, 20)).toBe(7)
  })

  it('résume la plage affichée', () => {
    expect(rangeSummary(1, 20, 134)).toBe('1 à 20 sur 134')
    expect(rangeSummary(7, 20, 134)).toBe('121 à 134 sur 134')
    expect(rangeSummary(1, 20, 0)).toBe('')
  })
})
