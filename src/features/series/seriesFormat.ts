// Libellés des colonnes de la liste des séries (spec 0004, « Colonnes »). Fonctions pures.

const ratingFormat = new Intl.NumberFormat('fr-FR', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

/** « 8,4 » : une décimale, virgule française. */
export function formatRating(rating: number): string {
  return ratingFormat.format(rating)
}

/** « aucun gratuit », « 1 gratuit », « 3 gratuits ». */
export function freeEpisodesLabel(count: number): string {
  if (count <= 0) return 'aucun gratuit'
  return count === 1 ? '1 gratuit' : `${String(count)} gratuits`
}

export type SeriesStatusLabel = { readonly label: string; readonly color: string } | undefined

/** « En cours » ou « Terminée » ; toute autre valeur n'a pas de libellé (« — »). */
export function statusLabel(status: string | null | undefined): SeriesStatusLabel {
  if (status === 'ongoing') return { label: 'En cours', color: 'noliIndigo' }
  if (status === 'completed') return { label: 'Terminée', color: 'gray' }
  return undefined
}
