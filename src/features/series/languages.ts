// Langues d'une série (spec 0005, « Langues ») : l'API stocke des codes ISO 639, l'admin lit des noms.

export interface LanguageSuggestion {
  readonly code: string
  readonly name: string
}

export const LANGUAGE_SUGGESTIONS: readonly LanguageSuggestion[] = [
  { code: 'fr', name: 'Français' },
  { code: 'en', name: 'Anglais' },
  { code: 'fon', name: 'Fon' },
  { code: 'yo', name: 'Yoruba' },
  { code: 'ha', name: 'Haoussa' },
  { code: 'wo', name: 'Wolof' },
  { code: 'bm', name: 'Bambara' },
  { code: 'ee', name: 'Éwé' },
  { code: 'tw', name: 'Twi' },
  { code: 'dyu', name: 'Dioula' },
  { code: 'mos', name: 'Mooré' },
  { code: 'ff', name: 'Peul' },
  { code: 'ln', name: 'Lingala' },
  { code: 'sw', name: 'Swahili' },
  { code: 'ar', name: 'Arabe' },
  { code: 'pt', name: 'Portugais' },
]

const suggestedNames = new Map(
  LANGUAGE_SUGGESTIONS.map((language) => [language.code, language.name]),
)

const ISO_CODE = /^[a-z]{2,3}$/

function intlLanguageName(code: string): string | undefined {
  // Seul un vrai code passe par Intl : une valeur ancienne (« French ») s'affiche telle quelle.
  if (!ISO_CODE.test(code)) return undefined
  try {
    const name = new Intl.DisplayNames(['fr'], { type: 'language' }).of(code)
    if (name === undefined || name === code) return undefined
    return name.charAt(0).toLocaleUpperCase('fr') + name.slice(1)
  } catch {
    // Une valeur ancienne qui n'est pas un code valide (« French ») lève une RangeError.
    return undefined
  }
}

/** Nom français d'un code, ou undefined si aucun nom n'est connu. */
export function languageName(code: string): string | undefined {
  return suggestedNames.get(code) ?? intlLanguageName(code)
}

/** « Français (fr) », ou la valeur seule quand aucun nom n'est connu (AC-10). */
export function languageLabel(code: string): string {
  const name = languageName(code)
  return name === undefined ? code : `${name} (${code})`
}

/** Minuscules sans accents, pour chercher « ewe » dans « Éwé ». */
export function foldForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
}
