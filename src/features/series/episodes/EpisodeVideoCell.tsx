// Colonne Vidéo d'un épisode (spec 0006, AC-7, AC-11) : progression d'un envoi, sinon l'état.
import { ActionIcon, Badge, Button, Group, Progress, Stack, Text, Tooltip } from '@mantine/core'
import { IconX } from '@tabler/icons-react'
import type { CSSProperties } from 'react'
import {
  episodeKey,
  episodeName,
  isVideoProcessing,
  videoBadge,
} from '@/features/series/episodes/episodeModel'
import { useVideoUploads } from '@/features/series/episodes/uploads/uploadsContext'
import { formatClock } from '@/features/series/episodes/uploads/uploadsReducer'
import type { AdminEpisode } from '@/features/series/schemas'
import { MISSING_VALUE } from '@/shared/ui/format'

const BADGE_STYLE: CSSProperties = { flexShrink: 0, minWidth: 'max-content' }

function VideoState({ episode }: { readonly episode: AdminEpisode }) {
  const badge = videoBadge(episode)
  if (badge === undefined) return <Text size="sm">{MISSING_VALUE}</Text>
  return (
    <Stack gap={2} align="flex-start">
      <Badge variant="light" color={badge.color} style={BADGE_STYLE}>
        {badge.label}
      </Badge>
      {badge.detail === undefined ? null : (
        <Text size="xs" c={badge.color === 'noliRed' ? 'noliRed' : 'dimmed'}>
          {badge.detail}
        </Text>
      )}
    </Stack>
  )
}

export function EpisodeVideoCell({ episode }: { readonly episode: AdminEpisode }) {
  const uploads = useVideoUploads()
  const key = episodeKey(episode.seasonNumber, episode.episodeNumber)
  const task = uploads.taskFor(key)
  const name = episodeName(episode.seasonNumber, episode.episodeNumber)

  if (task?.status === 'done' && !isVideoProcessing(episode) && episode.video?.status !== 'ready') {
    // Le fichier est reçu mais la fiche n'est pas encore relue : pas d'« Aucune vidéo » trompeur.
    return (
      <Text size="sm" c="dimmed">
        Envoi terminé, vérification…
      </Text>
    )
  }
  if (task === undefined || task.status === 'done') return <VideoState episode={episode} />

  if (task.status === 'queued') {
    // La pause est levée par le fournisseur à son terme : sa présence suffit.
    const { pausedUntil } = uploads
    return (
      <Group gap="xs" wrap="nowrap">
        <Text size="sm" c="dimmed">
          {pausedUntil !== undefined
            ? `Pause : limite d'envois atteinte, reprise à ${formatClock(pausedUntil)}`
            : "En attente d'envoi"}
        </Text>
        <Tooltip label="Annuler l'envoi">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Annuler l'envoi de la vidéo de ${name}`}
            onClick={() => {
              uploads.cancel(key)
            }}
          >
            <IconX size={16} aria-hidden="true" />
          </ActionIcon>
        </Tooltip>
      </Group>
    )
  }

  if (task.status === 'interrupted') {
    return (
      <Stack gap={4} align="flex-start">
        <Text size="sm" c="noliRed" fw={600}>
          Envoi interrompu
        </Text>
        {task.error === undefined ? null : (
          <Text size="xs" c="dimmed" maw={260}>
            {task.error}
          </Text>
        )}
        <Group gap="xs">
          <Button
            size="xs"
            variant="light"
            aria-label={`Relancer l'envoi de la vidéo de ${name}`}
            onClick={() => {
              uploads.relaunch(key)
            }}
          >
            Relancer
          </Button>
          <Button
            size="xs"
            variant="subtle"
            color="gray"
            aria-label={`Abandonner l'envoi de la vidéo de ${name}`}
            onClick={() => {
              uploads.cancel(key)
            }}
          >
            Abandonner
          </Button>
        </Group>
      </Stack>
    )
  }

  const percent = Math.round(task.progress * 100)
  return (
    <Stack gap={4} miw={180}>
      <Group gap="xs" wrap="nowrap" justify="space-between">
        <Text size="sm">{`Envoi ${String(percent)} %`}</Text>
        <Tooltip label="Annuler l'envoi">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label={`Annuler l'envoi de la vidéo de ${name}`}
            onClick={() => {
              uploads.cancel(key)
            }}
          >
            <IconX size={16} aria-hidden="true" />
          </ActionIcon>
        </Tooltip>
      </Group>
      <Progress
        value={percent}
        size="sm"
        aria-label={`Envoi de la vidéo de ${name}`}
        aria-valuetext={`${String(percent)} %`}
      />
      {task.warning === undefined ? null : (
        <Text size="xs" c="noliRed">
          {task.warning}
        </Text>
      )}
    </Stack>
  )
}
