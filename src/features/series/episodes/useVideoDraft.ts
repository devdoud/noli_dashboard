// État de la zone Vidéo d'une fenêtre d'épisode (spec 0006, AC-2, AC-3) : onglet, fichier, lien.
import { useCallback, useState } from 'react'
import {
  EMPTY_VIDEO_DRAFT,
  readVideoDuration,
  videoDraftErrors,
  type VideoDraft,
  type VideoDraftErrors,
  type VideoTab,
} from '@/features/series/episodes/videoSource'

export interface VideoDraftState {
  readonly draft: VideoDraft
  readonly errors: VideoDraftErrors
  readonly setTab: (tab: VideoTab) => void
  /** Choisit un fichier ; `onDuration` reçoit sa durée quand le navigateur sait la lire. */
  readonly chooseFile: (file: File | null, onDuration?: (seconds: number) => void) => void
  readonly setLink: (link: string) => void
  /** Valide l'onglet affiché, affiche les erreurs, et les renvoie. */
  readonly validate: (required: boolean) => VideoDraftErrors
  readonly showError: (errors: VideoDraftErrors) => void
  readonly reset: () => void
}

export function useVideoDraft(): VideoDraftState {
  const [draft, setDraft] = useState<VideoDraft>(EMPTY_VIDEO_DRAFT)
  const [errors, setErrors] = useState<VideoDraftErrors>({})

  const setTab = useCallback((tab: VideoTab) => {
    setDraft((current) => ({ ...current, tab }))
    setErrors({})
  }, [])

  const chooseFile = useCallback((file: File | null, onDuration?: (seconds: number) => void) => {
    setDraft(({ tab, link }) => (file === null ? { tab, link } : { tab, link, file }))
    setErrors({})
    if (file === null) return
    void readVideoDuration(file).then((seconds) => {
      if (seconds === undefined) return
      // Un autre fichier a pu être choisi entre temps : seule la durée du fichier affiché compte.
      setDraft((current) =>
        current.file === file ? { ...current, fileSeconds: seconds } : current,
      )
      onDuration?.(seconds)
    })
  }, [])

  const setLink = useCallback((link: string) => {
    setDraft((current) => ({ ...current, link }))
    setErrors((current) => ({ ...current, link: undefined }))
  }, [])

  const validate = useCallback(
    (required: boolean) => {
      const found = videoDraftErrors(draft, required)
      setErrors(found)
      return found
    },
    [draft],
  )

  const reset = useCallback(() => {
    setDraft(EMPTY_VIDEO_DRAFT)
    setErrors({})
  }, [])

  return { draft, errors, setTab, chooseFile, setLink, validate, showError: setErrors, reset }
}
