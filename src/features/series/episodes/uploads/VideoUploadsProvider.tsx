// File des envois de vidéos d'une fiche (spec 0006, AC-7, AC-9, « Envois en arrière plan ») :
// un envoi à la fois, pause sur la limite, vérification après l'envoi, arrêt en fin de session.
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { refreshVideo, requestVideoUpload, seriesKeys } from '@/features/series/api'
import { episodeKey, findEpisode, isVideoProcessing } from '@/features/series/episodes/episodeModel'
import { VIDEO_MESSAGE_OVERRIDES } from '@/features/series/episodes/videoMessages'
import { sendBasic, sendTus, TransportError } from '@/features/series/episodes/uploads/transports'
import {
  VideoUploadsContext,
  type EnqueueOptions,
  type VideoUploads,
} from '@/features/series/episodes/uploads/uploadsContext'
import {
  canReuseLink,
  formatClock,
  hasActiveUploads,
  INITIAL_UPLOADS,
  nextTask,
  overrunEstimate,
  uploadsReducer,
  type UploadsState,
  type UploadTask,
} from '@/features/series/episodes/uploads/uploadsReducer'
import type { AdminSeries } from '@/features/series/schemas'
import { isApiError } from '@/shared/api/errors'
import { toUserMessage } from '@/shared/api/messages'
import { useSession } from '@/shared/session/useSession'

const PAUSE_MS = 2 * 60_000
const REFRESH_EVERY_MS = 60_000
const OTHER_ADMIN_MESSAGE = 'Une autre vidéo a été lancée pour cet épisode.'
const SESSION_ENDED_MESSAGE = 'Session terminée : envoi arrêté.'

function failureMessage(error: unknown): string {
  if (error instanceof TransportError) {
    return error.failure === 'refused'
      ? 'Cloudflare a refusé le fichier.'
      : "La connexion a été coupée pendant l'envoi."
  }
  return toUserMessage(error, VIDEO_MESSAGE_OVERRIDES).message
}

export function VideoUploadsProvider({
  seriesId,
  children,
}: {
  readonly seriesId: string
  readonly children: ReactNode
}) {
  const queryClient = useQueryClient()
  const session = useSession()
  const [state, dispatch] = useReducer(uploadsReducer, INITIAL_UPLOADS)
  const stateRef = useRef<UploadsState>(state)
  const files = useRef(new Map<string, File>())
  const aborts = useRef(new Map<string, () => void>())

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const putSeries = useCallback(
    (series: AdminSeries) => {
      queryClient.setQueryData(seriesKeys.detail(seriesId), series)
      void queryClient.invalidateQueries({ queryKey: seriesKeys.lists })
    },
    [queryClient, seriesId],
  )

  const stop = useCallback((key: string) => {
    aborts.current.get(key)?.()
    aborts.current.delete(key)
  }, [])

  // Vérification auprès de l'hébergement (seul moyen de passer à « Prête » sans webhook, AC-9).
  const checkVideo = useCallback(
    async (task: UploadTask) => {
      dispatch({ type: 'refreshed', key: task.key, at: Date.now() })
      try {
        putSeries(await refreshVideo(seriesId, task.seasonNumber, task.episodeNumber))
      } catch (error) {
        if (isApiError(error) && error.status === 429) {
          dispatch({ type: 'pause', until: Date.now() + PAUSE_MS })
        }
        // Sinon la relecture automatique et la vérification suivante prennent le relais.
      }
    },
    [putSeries, seriesId],
  )

  const fail = useCallback(
    (task: UploadTask, error: unknown) => {
      if (error instanceof TransportError && error.failure === 'aborted') return
      if (isApiError(error) && error.status === 429) {
        dispatch({ type: 'pause', until: Date.now() + PAUSE_MS })
        dispatch({ type: 'requeue', key: task.key })
        return
      }
      if (isApiError(error) && error.kind === 'session-ended') {
        dispatch({ type: 'interrupted', key: task.key, error: SESSION_ENDED_MESSAGE })
        return
      }
      if (isApiError(error) && error.status === 404) {
        files.current.delete(task.key)
        dispatch({ type: 'remove', key: task.key })
        notifications.show({ color: 'red', title: 'Erreur', message: "Cet épisode n'existe plus." })
        void queryClient.invalidateQueries({ queryKey: seriesKeys.detail(seriesId) })
        return
      }
      const message = failureMessage(error)
      dispatch({ type: 'interrupted', key: task.key, error: message })
      if (task.fromCreation) {
        notifications.show({
          color: 'red',
          title: 'Erreur',
          message: `Épisode ajouté, mais la vidéo n'a pas démarré. ${message}`,
        })
      }
    },
    [queryClient, seriesId],
  )

  const run = useCallback(
    async (task: UploadTask) => {
      dispatch({ type: 'start', key: task.key })
      const file = files.current.get(task.key)
      if (file === undefined) {
        dispatch({
          type: 'interrupted',
          key: task.key,
          error: "Le fichier n'est plus disponible : choisissez le à nouveau.",
        })
        return
      }
      try {
        const link =
          task.link !== undefined && canReuseLink(task, Date.now())
            ? task.link
            : await requestVideoUpload(seriesId, task.seasonNumber, task.episodeNumber, file.size)
        dispatch({ type: 'linked', key: task.key, link, at: Date.now() })
        const startedAt = Date.now()
        const lastPercent = { value: -1 }
        const send = link.method === 'post' ? sendBasic : sendTus
        const transfer = send(file, link.uploadUrl, (sent, total) => {
          const percent = Math.floor((sent / Math.max(total, 1)) * 100)
          if (percent === lastPercent.value) return
          lastPercent.value = percent
          const end = overrunEstimate(startedAt, Date.now(), sent, total, link.expiresAt)
          dispatch({
            type: 'progress',
            key: task.key,
            progress: sent / Math.max(total, 1),
            ...(end === undefined
              ? {}
              : {
                  warning: `À ce rythme, l'envoi risque de dépasser la durée du lien (fin vers ${formatClock(end)}).`,
                }),
          })
        })
        aborts.current.set(task.key, transfer.abort)
        await transfer.done
        aborts.current.delete(task.key)
        files.current.delete(task.key)
        dispatch({ type: 'done', key: task.key, at: Date.now() })
        await checkVideo(task)
      } catch (error) {
        aborts.current.delete(task.key)
        fail(task, error)
      }
    },
    [checkVideo, fail, seriesId],
  )

  // Lance la tâche suivante quand aucune n'est active.
  useEffect(() => {
    const task = nextTask(state, Date.now())
    if (task !== undefined) void run(task)
  }, [state, run])

  // Reprise de la file à la fin de la pause.
  useEffect(() => {
    if (state.pausedUntil === undefined) return undefined
    const timer = window.setTimeout(
      () => {
        dispatch({ type: 'resume' })
      },
      Math.max(0, state.pausedUntil - Date.now()),
    )
    return () => {
      window.clearTimeout(timer)
    }
  }, [state.pausedUntil])

  // Fin de session : tout s'arrête, sans notification par envoi.
  useEffect(() => {
    if (session.status === 'authenticated') return
    aborts.current.forEach((abort) => {
      abort()
    })
    aborts.current.clear()
    dispatch({ type: 'interruptAll', error: SESSION_ENDED_MESSAGE })
  }, [session.status])

  // Quitter la fiche arrête les envois.
  useEffect(() => {
    const running = aborts.current
    return () => {
      running.forEach((abort) => {
        abort()
      })
      running.clear()
    }
  }, [])

  const enqueue = useCallback(
    ({ seasonNumber, episodeNumber, file, fromCreation = false }: EnqueueOptions) => {
      const key = episodeKey(seasonNumber, episodeNumber)
      stop(key)
      files.current.set(key, file)
      dispatch({
        type: 'enqueue',
        key,
        seasonNumber,
        episodeNumber,
        fileName: file.name,
        size: file.size,
        fromCreation,
      })
    },
    [stop],
  )

  const drop = useCallback(
    (key: string) => {
      stop(key)
      files.current.delete(key)
      dispatch({ type: 'remove', key })
    },
    [stop],
  )

  const relaunch = useCallback((key: string) => {
    dispatch({ type: 'requeue', key })
  }, [])

  const sync = useCallback(
    (series: AdminSeries, updatedAt: number) => {
      const now = Date.now()
      const paused =
        stateRef.current.pausedUntil !== undefined && stateRef.current.pausedUntil > now
      stateRef.current.tasks.forEach((task) => {
        const episode = findEpisode(series.episodes, task.seasonNumber, task.episodeNumber)
        if (episode === undefined) {
          drop(task.key)
          return
        }
        const ourUid = task.link?.uid
        if (
          task.status === 'sending' &&
          ourUid !== undefined &&
          task.linkedAt !== undefined &&
          updatedAt > task.linkedAt + 1000 &&
          episode.video?.pendingStreamUid !== ourUid
        ) {
          stop(task.key)
          files.current.delete(task.key)
          dispatch({ type: 'interrupted', key: task.key, error: OTHER_ADMIN_MESSAGE })
          return
        }
        if (task.status === 'done') {
          if (!isVideoProcessing(episode)) {
            dispatch({ type: 'remove', key: task.key })
          } else if (!paused && now - (task.lastRefreshAt ?? 0) >= REFRESH_EVERY_MS) {
            void checkVideo(task)
          }
        }
      })
    },
    [checkVideo, drop, stop],
  )

  const value = useMemo<VideoUploads>(
    () => ({
      tasks: state.tasks,
      pausedUntil: state.pausedUntil,
      active: hasActiveUploads(state),
      enqueue,
      cancel: drop,
      relaunch,
      drop,
      sync,
      taskFor: (key) => state.tasks.find((task) => task.key === key),
      expectsVideo: (key) =>
        state.tasks.some(
          (task) =>
            task.key === key &&
            (task.status === 'requesting' || task.status === 'sending' || task.status === 'done'),
        ),
    }),
    [state, enqueue, drop, relaunch, sync],
  )

  return <VideoUploadsContext.Provider value={value}>{children}</VideoUploadsContext.Provider>
}
