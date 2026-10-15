// Vidéo choisie dans la fenêtre d'épisode (spec 0006, AC-3, « Fichier ») : fichier ou lien, et ses règles.
import { EPISODE_MESSAGES, isHttpsLink } from '@/features/series/episodes/episodeForm'

export type VideoTab = 'file' | 'link'

export interface VideoDraft {
  readonly tab: VideoTab
  readonly file?: File
  /** Durée lue dans le fichier, en secondes, quand le navigateur sait la lire. */
  readonly fileSeconds?: number
  readonly link: string
}

export interface VideoDraftErrors {
  readonly file?: string
  readonly link?: string
}

export const EMPTY_VIDEO_DRAFT: VideoDraft = { tab: 'file', link: '' }

export const MAX_VIDEO_BYTES = 32_212_254_720
export const MAX_VIDEO_SECONDS = 10_800

export const VIDEO_FILE_MESSAGES = {
  notVideo: 'Choisissez un fichier vidéo.',
  tooHeavy: 'Fichier trop lourd : 30 Go au plus.',
  tooLong: 'Vidéo trop longue : 3 heures au plus.',
  required: 'Choisissez un fichier.',
} as const

/** Une vidéo est donnée dans l'onglet affiché. */
export function hasVideo(draft: VideoDraft): boolean {
  return draft.tab === 'file' ? draft.file !== undefined : draft.link.trim() !== ''
}

export function videoFileError(file: File, seconds: number | undefined): string | undefined {
  // Un type vide (certains formats) n'est pas refusé : Cloudflare tranche.
  if (file.type !== '' && !file.type.startsWith('video/')) return VIDEO_FILE_MESSAGES.notVideo
  if (file.size > MAX_VIDEO_BYTES) return VIDEO_FILE_MESSAGES.tooHeavy
  if (seconds !== undefined && seconds > MAX_VIDEO_SECONDS) return VIDEO_FILE_MESSAGES.tooLong
  return undefined
}

/** Erreurs de la vidéo de l'onglet affiché ; `required` exige une vidéo (lancement direct). */
export function videoDraftErrors(draft: VideoDraft, required: boolean): VideoDraftErrors {
  if (draft.tab === 'file') {
    if (draft.file === undefined) return required ? { file: VIDEO_FILE_MESSAGES.required } : {}
    const error = videoFileError(draft.file, draft.fileSeconds)
    return error === undefined ? {} : { file: error }
  }
  const link = draft.link.trim()
  if (link === '') return required ? { link: EPISODE_MESSAGES.link } : {}
  return isHttpsLink(link) ? {} : { link: EPISODE_MESSAGES.link }
}

export function hasDraftErrors(errors: VideoDraftErrors): boolean {
  return errors.file !== undefined || errors.link !== undefined
}

/**
 * Durée du fichier lue par un élément `video` (métadonnées seulement, adresse `blob:` révoquée).
 * Renvoie undefined si le navigateur ne sait pas la lire.
 */
export function readVideoDuration(file: File): Promise<number | undefined> {
  if (typeof URL.createObjectURL !== 'function') return Promise.resolve(undefined)
  return new Promise((resolve) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    const finish = (seconds: number | undefined) => {
      window.clearTimeout(timer)
      video.removeAttribute('src')
      video.load()
      URL.revokeObjectURL(url)
      resolve(seconds)
    }
    const timer = window.setTimeout(() => {
      finish(undefined)
    }, 10_000)
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      finish(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : undefined)
    }
    video.onerror = () => {
      finish(undefined)
    }
    video.src = url
  })
}
