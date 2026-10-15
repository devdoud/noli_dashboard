// Règles d'affichage des épisodes (spec 0006, « Section » et « États de vidéo »). Fonctions pures.
import type { AdminEpisode } from '@/features/series/schemas'

export const MAX_SEASON = 100

export interface SeasonGroup {
  readonly seasonNumber: number
  readonly episodes: readonly AdminEpisode[]
}

/** Saisons croissantes, épisodes croissants dans chaque saison. */
export function groupBySeason(episodes: readonly AdminEpisode[]): readonly SeasonGroup[] {
  const bySeason = new Map<number, AdminEpisode[]>()
  episodes.forEach((episode) => {
    bySeason.set(episode.seasonNumber, [...(bySeason.get(episode.seasonNumber) ?? []), episode])
  })
  return [...bySeason.entries()]
    .sort(([a], [b]) => a - b)
    .map(([seasonNumber, list]) => ({
      seasonNumber,
      episodes: [...list].sort((a, b) => a.episodeNumber - b.episodeNumber),
    }))
}

/** Plus grande saison existante, ramenée à 100 ; 1 s'il n'y a pas d'épisode (AC-2). */
export function suggestedSeason(episodes: readonly AdminEpisode[]): number {
  if (episodes.length === 0) return 1
  return Math.min(Math.max(...episodes.map((episode) => episode.seasonNumber)), MAX_SEASON)
}

/** Numéro libre suivant d'une saison : le plus grand + 1, ou 1 (AC-2). */
export function nextEpisodeNumber(episodes: readonly AdminEpisode[], seasonNumber: number): number {
  const numbers = episodes
    .filter((episode) => episode.seasonNumber === seasonNumber)
    .map((episode) => episode.episodeNumber)
  return numbers.length === 0 ? 1 : Math.max(...numbers) + 1
}

/** Jouable par les spectateurs : une vidéo prête, ou un ancien lien collé (AC-12). */
export function isEpisodeVisible(episode: AdminEpisode): boolean {
  return episode.video?.status === 'ready' || episode.video?.hasPastedUrl === true
}

/** Lancer une vidéo publie l'épisode s'il n'est pas encore visible (AC-13). */
export function needsPublishConfirm(episode: AdminEpisode | undefined): boolean {
  return episode === undefined || !isEpisodeVisible(episode)
}

export type BadgeColor = 'green' | 'noliIndigo' | 'noliRed' | 'noliAmber' | 'gray'

export interface VideoBadge {
  readonly label: string
  readonly color: BadgeColor
  readonly detail?: string
}

const ERROR_TEXTS: Readonly<Record<string, string>> = {
  upload_expired: "Lien d'envoi expiré",
}

function pendingErrorText(error: string | null | undefined): string | undefined {
  if (error === null || error === undefined || error.trim() === '') return undefined
  return ERROR_TEXTS[error] ?? error
}

/** Badge et détail de la colonne Vidéo (tableau « États de vidéo »). */
export function videoBadge(episode: AdminEpisode): VideoBadge | undefined {
  const video = episode.video
  const pending = video?.pendingStatus
  const pasted = video?.hasPastedUrl === true
  switch (video?.status ?? 'none') {
    case 'ready':
      if (pending === 'awaiting_upload' || pending === 'processing') {
        return { label: 'Prête', color: 'green', detail: 'Remplacement en cours' }
      }
      if (pending === 'error') {
        return { label: 'Prête', color: 'green', detail: 'Le remplacement a échoué' }
      }
      return { label: 'Prête', color: 'green' }
    case 'pending': {
      const detail = pending === 'awaiting_upload' ? 'En attente du fichier' : undefined
      const withPasted = pasted ? 'Ancien lien encore joué' : undefined
      const text = [detail, withPasted].filter((part) => part !== undefined).join(' · ')
      return text === ''
        ? { label: 'En traitement', color: 'noliIndigo' }
        : { label: 'En traitement', color: 'noliIndigo', detail: text }
    }
    case 'error': {
      const parts = [
        pendingErrorText(video?.pendingError),
        pasted ? 'Ancien lien encore joué' : undefined,
      ].filter((part) => part !== undefined)
      return parts.length === 0
        ? { label: 'Erreur', color: 'noliRed' }
        : { label: 'Erreur', color: 'noliRed', detail: parts.join(' · ') }
    }
    case 'legacy':
      return { label: 'Lien collé', color: 'noliAmber', detail: 'Non protégé' }
    case 'none':
      return { label: 'Aucune vidéo', color: 'gray' }
    default:
      return undefined
  }
}

/** Le backend attend une vidéo (relecture et vérifications automatiques, AC-9). */
export function isVideoProcessing(episode: AdminEpisode | undefined): boolean {
  const pending = episode?.video?.pendingStatus
  return pending === 'processing' || pending === 'awaiting_upload'
}

export function episodeKey(seasonNumber: number, episodeNumber: number): string {
  return `${String(seasonNumber)}:${String(episodeNumber)}`
}

/** « l'épisode 3 de la saison 1 », pour les noms des boutons et les titres (AC-17). */
export function episodeName(seasonNumber: number, episodeNumber: number): string {
  return `l'épisode ${String(episodeNumber)} de la saison ${String(seasonNumber)}`
}

export function findEpisode(
  episodes: readonly AdminEpisode[],
  seasonNumber: number,
  episodeNumber: number,
): AdminEpisode | undefined {
  return episodes.find(
    (episode) => episode.seasonNumber === seasonNumber && episode.episodeNumber === episodeNumber,
  )
}

export const POLL_EVERY_MS = 15_000

/**
 * La fiche se relit toute seule (AC-9) tant qu'un épisode est en traitement, ou attend le fichier
 * d'un envoi lancé depuis cet onglet (les liens abandonnés ailleurs ne font pas relire sans fin).
 */
export function shouldPoll(
  episodes: readonly AdminEpisode[],
  expectsVideo: (key: string) => boolean,
): boolean {
  return episodes.some((episode) => {
    const pending = episode.video?.pendingStatus
    return (
      pending === 'processing' ||
      (pending === 'awaiting_upload' &&
        expectsVideo(episodeKey(episode.seasonNumber, episode.episodeNumber)))
    )
  })
}
