/**
 * Thème Mantine du dashboard, tiré de l'identité de l'app mobile Noli (spec 0003).
 * Palettes : la couleur source en nuance 6, mélangée au blanc (0 à 5) et au noir (7 à 9).
 * Les valeurs de ce fichier sont la référence ; design.md les explique et note les contrastes mesurés.
 */
import { createTheme, type CSSVariablesResolver, type MantineColorsTuple } from '@mantine/core'

const noliAmber: MantineColorsTuple = [
  '#FEF6E9',
  '#FDE9C8',
  '#FBDBA7',
  '#FACE86',
  '#F8C165',
  '#F7B344',
  '#F5A623',
  '#D08D1E',
  '#AC7419',
  '#875B13',
]

const noliIndigo: MantineColorsTuple = [
  '#F0EFFD',
  '#DAD6F9',
  '#C4BEF5',
  '#AEA5F2',
  '#988DEE',
  '#8274EB',
  '#6C5CE7',
  '#5C4EC4',
  '#4C40A2',
  '#3B337F',
]

const noliRed: MantineColorsTuple = [
  '#FFEDF0',
  '#FFD3DB',
  '#FFB8C5',
  '#FF9DAF',
  '#FF8299',
  '#FF6883',
  '#FF4D6D',
  '#D9415D',
  '#B3364C',
  '#8C2A3C',
]

const noliOrange: MantineColorsTuple = [
  '#FFF4E6',
  '#FFE5BF',
  '#FFD599',
  '#FFC573',
  '#FFB54D',
  '#FFA526',
  '#FF9500',
  '#D97F00',
  '#B36800',
  '#8C5200',
]

/** Échelle sombre remplacée : surfaces de l'app (dark[7], dark[6]) et fond de page (dark[9]). */
const dark: MantineColorsTuple = [
  '#F8F9FA',
  '#C9CAD6',
  '#A0A3BD',
  '#7E8197',
  '#6B6E85',
  '#2B2C37',
  '#1C1D26',
  '#13141B',
  '#0F1015',
  '#0B0C10',
]

const FONT_FALLBACK = "system-ui, -apple-system, 'Segoe UI', sans-serif"

export const theme = createTheme({
  primaryColor: 'noliAmber',
  primaryShade: { light: 6, dark: 6 },
  autoContrast: true,
  black: '#0B0C10',
  colors: { noliAmber, noliIndigo, noliRed, noliOrange, dark },
  fontFamily: `'Plus Jakarta Sans', ${FONT_FALLBACK}`,
  headings: {
    fontFamily: `'Bricolage Grotesque', ${FONT_FALLBACK}`,
    fontWeight: '700',
  },
  fontSizes: { md: '0.875rem' },
  defaultRadius: 'md',
  focusRing: 'auto',
  components: {
    Table: { defaultProps: { verticalSpacing: 'xs' } },
    Button: { defaultProps: { size: 'sm' } },
    TextInput: { defaultProps: { size: 'sm' } },
    Select: { defaultProps: { size: 'sm' } },
    Textarea: { defaultProps: { size: 'sm' } },
    NumberInput: { defaultProps: { size: 'sm' } },
    Notification: { defaultProps: { withBorder: true } },
  },
})

/**
 * Variables par mode : fond de page, texte secondaire, bordure de champ (3:1),
 * et en mode clair un ambre foncé pour tout texte, lien ou focus (l'ambre 6 échoue sur blanc).
 */
/** Vert foncé des badges « Prête » en mode clair : le vert 9 de Mantine reste sous 4,5:1 (spec 0006). */
export const LIGHT_GREEN_TEXT = '#22702F'

export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {},
  light: {
    '--mantine-color-body': '#F7F7F9',
    '--mantine-color-text': '#13141B',
    '--mantine-color-dimmed': '#5B5E73',
    '--mantine-color-default-border': '#E4E5EB',
    '--mantine-color-anchor': noliAmber[9],
    '--mantine-primary-color-light-color': noliAmber[9],
    '--mantine-color-noliAmber-light-color': noliAmber[9],
    '--mantine-color-noliAmber-text': noliAmber[9],
    '--mantine-color-noliRed-light-color': noliRed[9],
    '--mantine-color-noliRed-text': noliRed[9],
    '--mantine-color-green-light-color': LIGHT_GREEN_TEXT,
    '--mantine-color-green-text': LIGHT_GREEN_TEXT,
    '--mantine-color-error': noliRed[8],
    '--noli-color-surface': '#FFFFFF',
    '--noli-color-surface-raised': '#F0F1F5',
    '--noli-color-field-border': '#8A8D9F',
    '--noli-color-focus': noliAmber[9],
  },
  dark: {
    '--mantine-color-body': dark[9],
    '--mantine-color-text': dark[0],
    '--mantine-color-dimmed': dark[2],
    '--mantine-color-default-border': 'rgba(255, 255, 255, 0.08)',
    '--mantine-color-anchor': noliAmber[6],
    '--mantine-color-error': noliRed[6],
    '--noli-color-surface': dark[7],
    '--noli-color-surface-raised': dark[6],
    '--noli-color-field-border': dark[4],
    '--noli-color-focus': noliAmber[6],
  },
})

export const COLOR_SCHEME_STORAGE_KEY = 'noli-admin-color-scheme'
