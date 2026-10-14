// Pays d'une série (spec 0005, « Pays ») : codes ISO 3166 alpha 2, noms français du navigateur.
// L'API stocke le nom français (« Bénin », « Côte d’Ivoire »), comme les données de production.

/** Les 54 pays d'Afrique. */
// prettier-ignore
export const AFRICAN_COUNTRY_CODES: readonly string[] = [
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CV', 'CM', 'CF', 'TD', 'KM', 'CG', 'CD', 'CI',
  'DJ', 'EG', 'GQ', 'ER', 'SZ', 'ET', 'GA', 'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR',
  'LY', 'MG', 'MW', 'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 'SN',
  'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'TZ', 'TG', 'TN', 'UG', 'ZM', 'ZW',
]

/** Les autres codes officiellement attribués, territoires compris (249 en tout avec l'Afrique). */
// prettier-ignore
export const OTHER_COUNTRY_CODES: readonly string[] = [
  'AD', 'AE', 'AF', 'AG', 'AI', 'AL', 'AM', 'AQ', 'AR', 'AS', 'AT', 'AU', 'AW', 'AX',
  'AZ', 'BA', 'BB', 'BD', 'BE', 'BG', 'BH', 'BL', 'BM', 'BN', 'BO', 'BQ', 'BR', 'BS',
  'BT', 'BV', 'BY', 'BZ', 'CA', 'CC', 'CH', 'CK', 'CL', 'CN', 'CO', 'CR', 'CU', 'CW',
  'CX', 'CY', 'CZ', 'DE', 'DK', 'DM', 'DO', 'EC', 'EE', 'EH', 'ES', 'FI', 'FJ', 'FK',
  'FM', 'FO', 'FR', 'GB', 'GD', 'GE', 'GF', 'GG', 'GI', 'GL', 'GP', 'GR', 'GS', 'GT',
  'GU', 'GY', 'HK', 'HM', 'HN', 'HR', 'HT', 'HU', 'ID', 'IE', 'IL', 'IM', 'IN', 'IO',
  'IQ', 'IR', 'IS', 'IT', 'JE', 'JM', 'JO', 'JP', 'KG', 'KH', 'KI', 'KN', 'KP', 'KR',
  'KW', 'KY', 'KZ', 'LA', 'LB', 'LC', 'LI', 'LK', 'LT', 'LU', 'LV', 'MC', 'MD', 'ME',
  'MF', 'MH', 'MK', 'MM', 'MN', 'MO', 'MP', 'MQ', 'MS', 'MT', 'MV', 'MX', 'MY', 'NC',
  'NF', 'NI', 'NL', 'NO', 'NP', 'NR', 'NU', 'NZ', 'OM', 'PA', 'PE', 'PF', 'PG', 'PH',
  'PK', 'PL', 'PM', 'PN', 'PR', 'PS', 'PT', 'PW', 'PY', 'QA', 'RE', 'RO', 'RS', 'RU',
  'SA', 'SB', 'SE', 'SG', 'SH', 'SI', 'SJ', 'SK', 'SM', 'SR', 'SV', 'SX', 'SY', 'TC',
  'TF', 'TH', 'TJ', 'TK', 'TL', 'TM', 'TO', 'TR', 'TT', 'TV', 'TW', 'UA', 'UM', 'US',
  'UY', 'UZ', 'VA', 'VC', 'VE', 'VG', 'VI', 'VN', 'VU', 'WF', 'WS', 'YE', 'YT',
]

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code) ?? code
  } catch {
    return code
  }
}

function sortedNames(codes: readonly string[]): string[] {
  return [...new Set(codes.map(countryName))].sort((a, b) => a.localeCompare(b, 'fr'))
}

export interface CountryGroup {
  readonly group: string
  readonly items: string[]
}

/** Groupes du sélecteur : la valeur actuelle hors liste en tête, puis l'Afrique, puis le reste. */
export function countryGroups(currentValue: string): CountryGroup[] {
  const african = sortedNames(AFRICAN_COUNTRY_CODES)
  const africanSet = new Set(african)
  const others = sortedNames(OTHER_COUNTRY_CODES).filter((name) => !africanSet.has(name))
  const known = new Set([...african, ...others])
  const current = currentValue.trim()
  // Mantine refuse deux options de même valeur : la valeur actuelle n'est ajoutée qu'absente.
  const currentGroup: CountryGroup[] =
    current === '' || known.has(current) ? [] : [{ group: 'Valeur actuelle', items: [current] }]
  return [
    ...currentGroup,
    { group: 'Afrique', items: african },
    { group: 'Autres pays', items: others },
  ]
}
