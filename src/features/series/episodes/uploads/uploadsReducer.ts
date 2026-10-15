// État des envois de vidéos d'une fiche (spec 0006, « Envois en arrière plan »). Réducteur pur.
import type { VideoUploadLink } from '@/features/series/schemas'

export type UploadStatus = 'queued' | 'requesting' | 'sending' | 'done' | 'interrupted'

export interface UploadTask {
  readonly key: string
  readonly seasonNumber: number
  readonly episodeNumber: number
  readonly fileName: string
  readonly size: number
  readonly status: UploadStatus
  /** De 0 à 1. */
  readonly progress: number
  readonly link?: VideoUploadLink
  /** Date (ms) où le lien a été obtenu : les relectures plus anciennes ne comptent pas. */
  readonly linkedAt?: number
  readonly error?: string
  /** Avertissement : à ce rythme, l'envoi risque de dépasser la durée du lien. */
  readonly warning?: string
  /** Envoi lancé juste après la création de l'épisode (message propre en cas d'échec). */
  readonly fromCreation: boolean
  readonly lastRefreshAt?: number
}

export interface UploadsState {
  readonly tasks: readonly UploadTask[]
  /** Pause de la file après un 429, jusqu'à cette date (ms). */
  readonly pausedUntil?: number
}

export type UploadsAction =
  | {
      readonly type: 'enqueue'
      readonly key: string
      readonly seasonNumber: number
      readonly episodeNumber: number
      readonly fileName: string
      readonly size: number
      readonly fromCreation: boolean
    }
  | { readonly type: 'start'; readonly key: string }
  | {
      readonly type: 'linked'
      readonly key: string
      readonly link: VideoUploadLink
      readonly at: number
    }
  | {
      readonly type: 'progress'
      readonly key: string
      readonly progress: number
      readonly warning?: string
    }
  | { readonly type: 'done'; readonly key: string; readonly at: number }
  | { readonly type: 'refreshed'; readonly key: string; readonly at: number }
  | { readonly type: 'interrupted'; readonly key: string; readonly error: string }
  | { readonly type: 'requeue'; readonly key: string }
  | { readonly type: 'remove'; readonly key: string }
  | { readonly type: 'pause'; readonly until: number }
  | { readonly type: 'resume' }
  | { readonly type: 'interruptAll'; readonly error: string }

export const INITIAL_UPLOADS: UploadsState = { tasks: [] }

function update(
  state: UploadsState,
  key: string,
  change: (task: UploadTask) => UploadTask,
): UploadsState {
  return { ...state, tasks: state.tasks.map((task) => (task.key === key ? change(task) : task)) }
}

export function uploadsReducer(state: UploadsState, action: UploadsAction): UploadsState {
  switch (action.type) {
    case 'enqueue': {
      const task: UploadTask = {
        key: action.key,
        seasonNumber: action.seasonNumber,
        episodeNumber: action.episodeNumber,
        fileName: action.fileName,
        size: action.size,
        status: 'queued',
        progress: 0,
        fromCreation: action.fromCreation,
      }
      // Un nouveau fichier pour le même épisode remplace la tâche précédente.
      return { ...state, tasks: [...state.tasks.filter((t) => t.key !== action.key), task] }
    }
    case 'start':
      return update(state, action.key, (task) => ({
        ...task,
        status: 'requesting',
        error: undefined,
      }))
    case 'linked':
      return update(state, action.key, (task) => ({
        ...task,
        status: 'sending',
        link: action.link,
        linkedAt: action.at,
      }))
    case 'progress':
      return update(state, action.key, (task) => ({
        ...task,
        progress: action.progress,
        warning: action.warning,
      }))
    case 'done':
      return update(state, action.key, (task) => ({
        ...task,
        status: 'done',
        progress: 1,
        lastRefreshAt: action.at,
      }))
    case 'refreshed':
      return update(state, action.key, (task) => ({ ...task, lastRefreshAt: action.at }))
    case 'interrupted':
      return update(state, action.key, (task) => ({
        ...task,
        status: 'interrupted',
        error: action.error,
      }))
    case 'requeue':
      return update(state, action.key, (task) => ({ ...task, status: 'queued' }))
    case 'remove':
      return { ...state, tasks: state.tasks.filter((task) => task.key !== action.key) }
    case 'pause':
      return { ...state, pausedUntil: action.until }
    case 'resume':
      return { ...state, pausedUntil: undefined }
    case 'interruptAll':
      return {
        ...state,
        tasks: state.tasks.map((task) =>
          task.status === 'queued' || task.status === 'requesting' || task.status === 'sending'
            ? { ...task, status: 'interrupted', error: action.error }
            : task,
        ),
      }
  }
}

/** La tâche à lancer : la première en attente, si aucune n'est active et la file pas en pause. */
export function nextTask(state: UploadsState, now: number): UploadTask | undefined {
  if (state.pausedUntil !== undefined && state.pausedUntil > now) return undefined
  if (state.tasks.some((task) => task.status === 'requesting' || task.status === 'sending')) {
    return undefined
  }
  return state.tasks.find((task) => task.status === 'queued')
}

/** Envois actifs ou en attente : ils activent la protection de la page (AC-15). */
export function hasActiveUploads(state: UploadsState): boolean {
  return state.tasks.some(
    (task) => task.status === 'queued' || task.status === 'requesting' || task.status === 'sending',
  )
}

/** Un lien encore valide deux minutes au moins peut être réutilisé par « Relancer » (AC-7). */
export function canReuseLink(task: UploadTask, now: number): boolean {
  if (task.link === undefined) return false
  return new Date(task.link.expiresAt).getTime() - now > 2 * 60_000
}

/**
 * Avertit si, après une minute d'envoi, le débit observé annonce une fin après l'expiration du lien.
 * Renvoie l'heure de fin estimée (ms), ou undefined.
 */
export function overrunEstimate(
  startedAt: number,
  now: number,
  sentBytes: number,
  totalBytes: number,
  expiresAt: string,
): number | undefined {
  const elapsed = now - startedAt
  if (elapsed < 60_000 || sentBytes <= 0) return undefined
  const estimatedEnd = startedAt + (elapsed * totalBytes) / sentBytes
  return estimatedEnd > new Date(expiresAt).getTime() ? estimatedEnd : undefined
}

const clockFormat = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' })

/** « 14 h 32 » : heure de reprise ou de fin estimée. */
export function formatClock(ms: number): string {
  return clockFormat.format(new Date(ms)).replace(':', ' h ')
}
