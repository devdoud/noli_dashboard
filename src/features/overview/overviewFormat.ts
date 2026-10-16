// Textes de la vue d'ensemble (spec 0010, AC-1, AC-2, AC-8). Fonctions pures.
import type { VideosToProcess } from '@/features/overview/api'

const numberFormat = new Intl.NumberFormat('fr-FR')

/** Nombre écrit à la française (« 1 234 »). */
export function formatCount(n: number): string {
  return numberFormat.format(n)
}

/** Singulier à 0 et à 1, comme en français. */
function plural(n: number, singular: string, pluralForm: string): string {
  return `${formatCount(n)} ${n <= 1 ? singular : pluralForm}`
}

/** « 2 sans vidéo · 1 en erreur · 3 en cours · 4 anciens liens », états à 0 omis. */
export function videoDetailText(counts: VideosToProcess): string {
  const parts: readonly (readonly [number, string])[] = [
    [counts.none, `${formatCount(counts.none)} sans vidéo`],
    [counts.error, `${formatCount(counts.error)} en erreur`],
    [counts.pending, `${formatCount(counts.pending)} en cours`],
    [counts.legacy, plural(counts.legacy, 'ancien lien', 'anciens liens')],
  ]
  return parts
    .filter(([n]) => n > 0)
    .map(([, text]) => text)
    .join(' · ')
}

export function seriesTileLabel(n: number): string {
  return `${plural(n, 'série', 'séries')}, voir la liste des séries`
}

export function episodesTileLabel(n: number): string {
  return `${plural(n, 'épisode', 'épisodes')}, voir la liste des séries`
}

export function videosTileLabel(n: number): string {
  const counted = plural(n, 'vidéo à traiter', 'vidéos à traiter')
  return n === 0 ? `${counted}, tout est prêt` : `${counted}, voir les séries concernées`
}
