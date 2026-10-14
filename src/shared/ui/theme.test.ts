import { DEFAULT_THEME, mergeMantineTheme } from '@mantine/core'
import { COLOR_SCHEME_STORAGE_KEY, cssVariablesResolver, theme } from '@/shared/ui/theme'

// Contraste WCAG entre deux couleurs hexadécimales opaques.
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
  const [r = 0, g = 0, b = 0] = channels.map((value) =>
    value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return ((light ?? 0) + 0.05) / ((dark ?? 0) + 0.05)
}

const fullTheme = mergeMantineTheme(DEFAULT_THEME, theme)
const variables = cssVariablesResolver(fullTheme)
const light = variables.light as Record<string, string>
const dark = variables.dark as Record<string, string>

function shade(color: string, index: number): string {
  const value = fullTheme.colors[color]?.[index]
  if (value === undefined) throw new Error(`Nuance ${color}.${String(index)} absente`)
  return value
}

describe('thème : couleurs de marque (AC-1)', () => {
  it('place les couleurs de l’app mobile en nuance 6', () => {
    expect(shade('noliAmber', 6)).toBe('#F5A623')
    expect(shade('noliIndigo', 6)).toBe('#6C5CE7')
    expect(shade('noliRed', 6)).toBe('#FF4D6D')
    expect(shade('noliOrange', 6)).toBe('#FF9500')
  })

  it('prend l’ambre comme couleur principale, en nuance 6 dans les deux modes', () => {
    expect(fullTheme.primaryColor).toBe('noliAmber')
    expect(fullTheme.primaryShade).toEqual({ light: 6, dark: 6 })
    expect(fullTheme.autoContrast).toBe(true)
    expect(fullTheme.black).toBe('#0B0C10')
  })

  it('remplace l’échelle sombre par les surfaces de l’app', () => {
    expect(shade('dark', 9)).toBe('#0B0C10')
    expect(shade('dark', 7)).toBe('#13141B')
    expect(shade('dark', 6)).toBe('#1C1D26')
  })

  it('donne à chaque mode son fond de page et sa surface', () => {
    expect(dark['--mantine-color-body']).toBe('#0B0C10')
    expect(dark['--noli-color-surface']).toBe('#13141B')
    expect(light['--mantine-color-body']).toBe('#F7F7F9')
    expect(light['--noli-color-surface']).toBe('#FFFFFF')
  })

  it('utilise les polices de la marque', () => {
    expect(fullTheme.fontFamily).toMatch(/^'Plus Jakarta Sans'/)
    expect(fullTheme.headings.fontFamily).toMatch(/^'Bricolage Grotesque'/)
  })

  it('partage la clé du mode de couleurs avec public/color-scheme.js (AC-2)', () => {
    expect(COLOR_SCHEME_STORAGE_KEY).toBe('noli-admin-color-scheme')
  })
})

describe('thème : contrastes des tokens (AC-4)', () => {
  const surfaces = { light: '#FFFFFF', dark: '#13141B' }

  it.each([
    ['texte principal clair', '#13141B', surfaces.light, 4.5],
    ['texte secondaire clair', light['--mantine-color-dimmed'], surfaces.light, 4.5],
    ['lien ambre clair', light['--mantine-color-anchor'], surfaces.light, 4.5],
    ['texte d’erreur clair', light['--mantine-color-error'], surfaces.light, 4.5],
    ['bordure de champ claire', light['--noli-color-field-border'], surfaces.light, 3],
    ['focus clair', light['--noli-color-focus'], surfaces.light, 3],
    ['texte principal sombre', dark['--mantine-color-text'], surfaces.dark, 4.5],
    ['texte secondaire sombre', dark['--mantine-color-dimmed'], surfaces.dark, 4.5],
    ['lien ambre sombre', dark['--mantine-color-anchor'], surfaces.dark, 4.5],
    ['texte d’erreur sombre', dark['--mantine-color-error'], surfaces.dark, 4.5],
    ['bordure de champ sombre', dark['--noli-color-field-border'], surfaces.dark, 3],
    ['focus sombre', dark['--noli-color-focus'], surfaces.dark, 3],
  ])('%s atteint son seuil', (_label, foreground, background, minimum) => {
    expect(foreground).toMatch(/^#[0-9A-F]{6}$/i)
    expect(contrast(foreground ?? '', background)).toBeGreaterThanOrEqual(minimum)
  })

  it('bouton principal : texte sombre sur ambre', () => {
    expect(contrast('#0B0C10', shade('noliAmber', 6))).toBeGreaterThanOrEqual(4.5)
  })

  it('bouton danger : texte blanc sur rouge 8', () => {
    expect(contrast('#FFFFFF', shade('noliRed', 8))).toBeGreaterThanOrEqual(4.5)
  })

  it('n’utilise jamais l’ambre 6 comme texte sur fond clair', () => {
    expect(contrast(shade('noliAmber', 6), surfaces.light)).toBeLessThan(4.5)
    expect(light['--mantine-color-anchor']).not.toBe(shade('noliAmber', 6))
    expect(light['--mantine-primary-color-light-color']).toBe(shade('noliAmber', 9))
  })
})
