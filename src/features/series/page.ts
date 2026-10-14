// Page de la liste lue dans l'adresse (spec 0004, AC-9). Fonctions pures.

export const SERIES_PAGE_SIZE = 20
export const MAX_PAGE = 10_000

/** Entier de 1 à 10 000 écrit uniquement en chiffres ; toute autre valeur vaut 1. */
export function parsePage(raw: string | null | undefined): number {
  if (raw === null || raw === undefined || !/^\d+$/.test(raw)) return 1
  const page = Number(raw)
  return Number.isSafeInteger(page) && page >= 1 && page <= MAX_PAGE ? page : 1
}

/** Dernière page existante pour un total donné (au moins 1). */
export function lastPage(total: number): number {
  return Math.max(1, Math.ceil(total / SERIES_PAGE_SIZE))
}
