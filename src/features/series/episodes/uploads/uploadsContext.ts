// Contexte des envois de vidéos d'une fiche (spec 0006, « Envois en arrière plan »).
import { createContext, useContext } from 'react'
import type { AdminSeries } from '@/features/series/schemas'
import type { UploadTask } from '@/features/series/episodes/uploads/uploadsReducer'

export interface EnqueueOptions {
  readonly seasonNumber: number
  readonly episodeNumber: number
  readonly file: File
  /** Envoi lancé juste après la création de l'épisode. */
  readonly fromCreation?: boolean
}

export interface VideoUploads {
  readonly tasks: readonly UploadTask[]
  readonly pausedUntil: number | undefined
  /** Envois actifs ou en attente (protection de la page, AC-15). */
  readonly active: boolean
  readonly enqueue: (options: EnqueueOptions) => void
  readonly cancel: (key: string) => void
  readonly relaunch: (key: string) => void
  /** Arrête et retire les tâches d'un épisode (suppression de l'épisode). */
  readonly drop: (key: string) => void
  /** Rapproche les tâches de la fiche relue (autre admin, épisode disparu, vérifications). */
  readonly sync: (series: AdminSeries, updatedAt: number) => void
  readonly taskFor: (key: string) => UploadTask | undefined
  /** Une tâche locale de cet épisode attend encore la fin de l'encodage. */
  readonly expectsVideo: (key: string) => boolean
}

export const VideoUploadsContext = createContext<VideoUploads | undefined>(undefined)

export function useVideoUploads(): VideoUploads {
  const uploads = useContext(VideoUploadsContext)
  if (uploads === undefined) throw new Error('useVideoUploads hors de VideoUploadsProvider')
  return uploads
}
