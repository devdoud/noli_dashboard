import {
  episodesTileLabel,
  formatCount,
  seriesTileLabel,
  videoDetailText,
  videosTileLabel,
} from '@/features/overview/overviewFormat'

// Espace fine insécable des milliers en français.
const NNBSP = ' '

describe('textes de la vue d’ensemble (spec 0010)', () => {
  it('écrit les nombres à la française (AC-1)', () => {
    expect(formatCount(0)).toBe('0')
    expect(formatCount(48)).toBe('48')
    expect(formatCount(1234)).toBe(`1${NNBSP}234`)
  })

  it('détaille les états non nuls dans l’ordre prévu (AC-2)', () => {
    expect(videoDetailText({ total: 10, none: 2, error: 1, pending: 3, legacy: 4 })).toBe(
      '2 sans vidéo · 1 en erreur · 3 en cours · 4 anciens liens',
    )
    expect(videoDetailText({ total: 5, none: 2, error: 0, pending: 0, legacy: 3 })).toBe(
      '2 sans vidéo · 3 anciens liens',
    )
    expect(videoDetailText({ total: 1, none: 0, error: 0, pending: 0, legacy: 1 })).toBe(
      '1 ancien lien',
    )
    expect(videoDetailText({ total: 0, none: 0, error: 0, pending: 0, legacy: 0 })).toBe('')
  })

  it('donne aux tuiles un nom qui dit le nombre et la suite, au singulier à 0 et 1 (AC-8)', () => {
    expect(seriesTileLabel(48)).toBe('48 séries, voir la liste des séries')
    expect(seriesTileLabel(1)).toBe('1 série, voir la liste des séries')
    expect(episodesTileLabel(140)).toBe('140 épisodes, voir la liste des séries')
    expect(videosTileLabel(7)).toBe('7 vidéos à traiter, voir les séries concernées')
    expect(videosTileLabel(1)).toBe('1 vidéo à traiter, voir les séries concernées')
    expect(videosTileLabel(0)).toBe('0 vidéo à traiter, tout est prêt')
  })
})
