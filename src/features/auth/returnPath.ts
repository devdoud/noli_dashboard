// Adresse de retour après connexion, filtrée contre les redirections ouvertes (spec 0004, AC-3).

export const DEFAULT_AFTER_LOGIN = '/series'

/** Caractères de contrôle (U+0000 à U+001F, et U+007F). */
function hasControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0)
    return code <= 0x1f || code === 0x7f
  })
}

function isLoginPath(pathname: string): boolean {
  return pathname === '/connexion' || pathname.startsWith('/connexion/')
}

/**
 * Renvoie un chemin interne sûr (`pathname + search + hash`), ou `undefined`.
 * `raw` est la valeur déjà décodée une fois par `searchParams.get` : pas de second décodage.
 */
export function safeReturnPath(raw: string | null | undefined): string | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined
  if (!raw.startsWith('/') || raw.startsWith('//')) return undefined
  if (raw.includes('\\') || hasControlCharacter(raw)) return undefined
  const origin = window.location.origin
  const url = (() => {
    try {
      return new URL(raw, origin)
    } catch {
      return undefined
    }
  })()
  if (url === undefined || url.origin !== origin) return undefined
  if (isLoginPath(url.pathname)) return undefined
  return `${url.pathname}${url.search}${url.hash}`
}
