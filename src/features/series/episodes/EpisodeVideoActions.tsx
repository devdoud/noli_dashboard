// Partie Vidéo de la fenêtre de modification (spec 0006, AC-8, AC-10, AC-13) : actions selon l'état
// en direct de l'épisode, exécutées tout de suite, indépendamment de « Enregistrer ».
import { Alert, Badge, Button, Group, Stack, Text, Title } from '@mantine/core'
import { IconCloudUpload, IconRefresh, IconTrash } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useRef, useState, type CSSProperties } from 'react'
import {
  importPastedVideo,
  importVideo,
  refreshVideo,
  removeVideo,
  seriesKeys,
} from '@/features/series/api'
import { confirmPublish } from '@/features/series/episodes/episodeConfirms'
import {
  episodeName,
  isVideoProcessing,
  needsPublishConfirm,
  videoBadge,
} from '@/features/series/episodes/episodeModel'
import { useVideoUploads } from '@/features/series/episodes/uploads/uploadsContext'
import { useVideoDraft } from '@/features/series/episodes/useVideoDraft'
import {
  EPISODE_VIDEO_OVERRIDES,
  importRefusal,
  isHttpStatus,
  VIDEO_CONFLICT_MESSAGE,
} from '@/features/series/episodes/videoMessages'
import { hasDraftErrors } from '@/features/series/episodes/videoSource'
import { VideoSourceInput } from '@/features/series/episodes/VideoSourceInput'
import type { AdminEpisode, AdminSeries } from '@/features/series/schemas'
import { confirmDanger } from '@/shared/ui/confirmDanger'
import { notifyError } from '@/shared/ui/notifyError'
import { notifySuccess } from '@/shared/ui/notifySuccess'

type VideoAction = 'send' | 'import' | 'migrate' | 'check' | 'remove'

const BADGE_STYLE: CSSProperties = { flexShrink: 0, minWidth: 'max-content' }

interface EpisodeVideoActionsProps {
  readonly series: AdminSeries
  readonly episode: AdminEpisode
  /** Un envoi de fichier ferme la fenêtre (en passant par sa question de fermeture). */
  readonly onLaunched: () => void
  /** L'épisode a disparu : la fenêtre se ferme sans question. */
  readonly onGone: () => void
}

function sectionTitle(episode: AdminEpisode): string {
  switch (episode.video?.status ?? 'none') {
    case 'none':
      return 'Ajouter une vidéo'
    case 'legacy':
      return 'Envoyer ou importer une autre vidéo'
    default:
      return 'Remplacer la vidéo'
  }
}

export function EpisodeVideoActions({
  series,
  episode,
  onLaunched,
  onGone,
}: EpisodeVideoActionsProps) {
  const queryClient = useQueryClient()
  const uploads = useVideoUploads()
  const video = useVideoDraft()
  const running = useRef(false)
  const [busy, setBusy] = useState<VideoAction>()
  const [refusal, setRefusal] = useState<string>()
  const { seasonNumber, episodeNumber } = episode
  const name = episodeName(seasonNumber, episodeNumber)
  const status = episode.video?.status ?? 'none'
  const badge = videoBadge(episode)
  const hasPasted = episode.video?.hasPastedUrl === true

  const reloadSeries = () => {
    void queryClient.invalidateQueries({ queryKey: seriesKeys.detail(series._id) })
  }
  const putSeries = (saved: AdminSeries) => {
    queryClient.setQueryData(seriesKeys.detail(series._id), saved)
    void queryClient.invalidateQueries({ queryKey: seriesKeys.lists })
  }

  const handleError = (error: unknown) => {
    if (isHttpStatus(error, 404)) {
      notifyError(error, EPISODE_VIDEO_OVERRIDES)
      reloadSeries()
      onGone()
      return
    }
    if (isHttpStatus(error, 409)) {
      reloadSeries()
      notifyError(error, { '409': VIDEO_CONFLICT_MESSAGE })
      return
    }
    const reason = importRefusal(error)
    if (reason !== undefined) {
      setRefusal(reason)
      return
    }
    notifyError(error, EPISODE_VIDEO_OVERRIDES)
  }

  // Un seul appel à la fois ; le bouton montre un chargement (AC-16).
  const perform = async (action: VideoAction, work: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    setBusy(action)
    setRefusal(undefined)
    try {
      await work()
    } catch (error) {
      handleError(error)
    } finally {
      running.current = false
      setBusy(undefined)
    }
  }

  const launch = async () => {
    if (running.current) return
    if (hasDraftErrors(video.validate(true))) return
    if (needsPublishConfirm(episode) && !(await confirmPublish())) return
    const { draft } = video
    if (draft.tab === 'file') {
      if (draft.file === undefined) return
      uploads.enqueue({ seasonNumber, episodeNumber, file: draft.file })
      video.reset()
      onLaunched()
      return
    }
    await perform('import', async () => {
      await importVideo(series._id, seasonNumber, episodeNumber, draft.link)
      video.reset()
      reloadSeries()
      notifySuccess('Import lancé.')
    })
  }

  const migrate = () =>
    perform('migrate', async () => {
      await importPastedVideo(series._id, seasonNumber, episodeNumber)
      reloadSeries()
      notifySuccess('Import du lien lancé.')
    })

  const check = () =>
    perform('check', async () => {
      putSeries(await refreshVideo(series._id, seasonNumber, episodeNumber))
    })

  const remove = async () => {
    if (running.current) return
    const confirmed = await confirmDanger({
      title: `Retirer la vidéo de ${name} ?`,
      message: "L'épisode ne sera plus visible des spectateurs. La vidéo hébergée sera effacée.",
      confirmLabel: 'Retirer',
    })
    if (!confirmed) return
    await perform('remove', async () => {
      putSeries(await removeVideo(series._id, seasonNumber, episodeNumber))
      notifySuccess('Vidéo retirée.')
    })
  }

  const disabled = busy !== undefined

  return (
    <Stack gap="sm">
      <Group gap="sm" align="center">
        <Title order={3} size="h5">
          Vidéo
        </Title>
        {badge === undefined ? null : (
          <Badge variant="light" color={badge.color} style={BADGE_STYLE}>
            {badge.label}
          </Badge>
        )}
      </Group>
      {badge?.detail === undefined ? null : (
        <Text size="sm" c={status === 'error' ? 'noliRed' : 'dimmed'}>
          {badge.detail}
        </Text>
      )}
      <Text size="sm" c="dimmed">
        Sans vidéo, l&apos;épisode n&apos;est pas visible des spectateurs.
      </Text>

      <Group gap="sm">
        {hasPasted ? (
          <Button
            variant="light"
            leftSection={<IconCloudUpload size={16} aria-hidden="true" />}
            loading={busy === 'migrate'}
            disabled={disabled && busy !== 'migrate'}
            onClick={() => {
              void migrate()
            }}
          >
            Importer ce lien dans l&apos;hébergement
          </Button>
        ) : null}
        {status === 'pending' || isVideoProcessing(episode) ? (
          <Button
            variant="default"
            leftSection={<IconRefresh size={16} aria-hidden="true" />}
            loading={busy === 'check'}
            disabled={disabled && busy !== 'check'}
            onClick={() => {
              void check()
            }}
          >
            Vérifier maintenant
          </Button>
        ) : null}
        {status === 'ready' || status === 'error' ? (
          <Button
            variant="subtle"
            color="noliRed.8"
            leftSection={<IconTrash size={16} aria-hidden="true" />}
            loading={busy === 'remove'}
            disabled={disabled && busy !== 'remove'}
            onClick={() => {
              void remove()
            }}
          >
            Retirer la vidéo
          </Button>
        ) : null}
      </Group>

      <Title order={4} size="h6" mt="xs">
        {sectionTitle(episode)}
      </Title>
      {status === 'ready' ? (
        <Text size="sm" c="dimmed">
          Les spectateurs gardent l&apos;ancienne vidéo jusqu&apos;à ce que la nouvelle soit prête.
        </Text>
      ) : null}
      {refusal === undefined ? null : (
        <Alert color="noliRed" role="alert">
          <Text size="sm">{refusal}</Text>
        </Alert>
      )}
      <VideoSourceInput
        idPrefix="episode-video"
        draft={video.draft}
        errors={video.errors}
        disabled={disabled}
        onTabChange={video.setTab}
        onFileChange={(file) => {
          video.chooseFile(file)
        }}
        onLinkChange={video.setLink}
        action={(tab) => (
          <Group justify="flex-end">
            <Button
              variant="light"
              loading={tab === 'link' && busy === 'import'}
              disabled={disabled && busy !== 'import'}
              onClick={() => {
                void launch()
              }}
            >
              {tab === 'file' ? 'Envoyer ce fichier' : 'Importer ce lien'}
            </Button>
          </Group>
        )}
      />
    </Stack>
  )
}
