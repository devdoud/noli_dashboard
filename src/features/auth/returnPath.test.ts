import { safeReturnPath } from '@/features/auth/returnPath'

describe('safeReturnPath (AC-3)', () => {
  it.each([
    ['/series', '/series'],
    ['/series?page=2', '/series?page=2'],
    ['/series?page=2#haut', '/series?page=2#haut'],
    ['/', '/'],
    ['/connexions-anciennes', '/connexions-anciennes'],
  ])('garde le chemin interne %s', (raw, expected) => {
    expect(safeReturnPath(raw)).toBe(expected)
  })

  it.each([
    ['absent', null],
    ['indéfini', undefined],
    ['vide', ''],
    ['relatif', 'series'],
    ['protocole relatif', '//evil.com'],
    ['barre inverse', '/\\evil.com'],
    ['barre inverse plus loin', '/series\\x'],
    ['adresse complète', 'https://evil.com'],
    ['caractère nul', '/series\u0000'],
    ['tabulation', '/\tevil.com'],
    ['caractère DEL', '/series\u007f'],
    ['page de connexion', '/connexion'],
    ['sous chemin de connexion', '/connexion/x'],
    ['connexion avec recherche', '/connexion?retour=/x'],
  ])('refuse une valeur %s', (_label, raw) => {
    expect(safeReturnPath(raw)).toBeUndefined()
  })
})
