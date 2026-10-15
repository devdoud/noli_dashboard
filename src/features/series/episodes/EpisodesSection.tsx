// Section « Épisodes » de la fiche (spec 0006, AC-1, AC-12, AC-14, AC-17).
import {
  ActionIcon,
  Badge,
  Button,
  Group,
  Paper,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconPencil, IconPlus, IconTrash } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useState, type CSSProperties } from 'react'
import { deleteEpisode, seriesKeys } from '@/features/series/api'
import { EpisodeModal, type EpisodeModalTarget } from '@/features/series/episodes/EpisodeModal'
import {
  episodeKey,
  episodeName,
  groupBySeason,
  isEpisodeVisible,
} from '@/features/series/episodes/episodeModel'
import { EpisodeVideoCell } from '@/features/series/episodes/EpisodeVideoCell'
import { useVideoUploads } from '@/features/series/episodes/uploads/uploadsContext'
import type { AdminEpisode, AdminSeries } from '@/features/series/schemas'
import { isApiError } from '@/shared/api/errors'
import { confirmDanger } from '@/shared/ui/confirmDanger'
import { EmptyState } from '@/shared/ui/EmptyState'
import { formatDate, formatDuration, MISSING_VALUE } from '@/shared/ui/format'
import { notifyError } from '@/shared/ui/notifyError'
import { notifySuccess } from '@/shared/ui/notifySuccess'

const BADGE_STYLE: CSSProperties = { flexShrink: 0, minWidth: 'max-content' }
const NO_WRAP: CSSProperties = { whiteSpace: 'nowrap' }

function AccessBadge({ episode }: { readonly episode: AdminEpisode }) {
  if (!isEpisodeVisible(episode)) {
    return (
      <Badge variant="light" color="gray" style={BADGE_STYLE}>
        Non visible
      </Badge>
    )
  }
  return episode.isFree ? (
    <Badge variant="light" color="gray" style={BADGE_STYLE}>
      Gratuit
    </Badge>
  ) : (
    <Badge variant="light" color="noliAmber" style={BADGE_STYLE}>
      Premium
    </Badge>
  )
}

interface EpisodesSectionProps {
  readonly series: AdminSeries
  /** Une fenêtre d'épisode a des changements non enregistrés (protection de la page). */
  readonly onDirtyChange: (dirty: boolean) => void
  /** Avant une navigation voulue (série disparue). */
  readonly onLeave: () => void
}

export function EpisodesSection({ series, onDirtyChange, onLeave }: EpisodesSectionProps) {
  const queryClient = useQueryClient()
  const uploads = useVideoUploads()
  const [target, setTarget] = useState<EpisodeModalTarget>()
  const [deleting, setDeleting] = useState<string>()
  const episodes = series.episodes
  const seasons = groupBySeason(episodes)
  const count = episodes.length

  const remove = async (episode: AdminEpisode) => {
    const name = episodeName(episode.seasonNumber, episode.episodeNumber)
    const confirmed = await confirmDanger({
      title: `Supprimer ${name} ?`,
      message: `« ${episode.title} » sera supprimé définitivement, avec sa vidéo, sa vignette et l'historique de visionnage des spectateurs pour cet épisode.`,
    })
    if (!confirmed) return
    const key = episodeKey(episode.seasonNumber, episode.episodeNumber)
    uploads.drop(key)
    setDeleting(key)
    try {
      const saved = await deleteEpisode(series._id, episode.seasonNumber, episode.episodeNumber)
      queryClient.setQueryData(seriesKeys.detail(series._id), saved)
      void queryClient.invalidateQueries({ queryKey: seriesKeys.lists })
      notifySuccess('Épisode supprimé.')
    } catch (error) {
      if (isApiError(error) && error.kind === 'http' && error.status === 404) {
        notifySuccess('Cet épisode avait déjà été supprimé.')
      } else {
        notifyError(error)
      }
      // Une suppression peut échouer après avoir déjà retiré la vidéo : on relit la fiche.
      void queryClient.invalidateQueries({ queryKey: seriesKeys.detail(series._id) })
    } finally {
      setDeleting(undefined)
    }
  }

  const addButton = (
    <Button
      leftSection={<IconPlus size={16} aria-hidden="true" />}
      onClick={() => {
        setTarget({ mode: 'create' })
      }}
    >
      Ajouter un épisode
    </Button>
  )

  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        <Group justify="space-between" align="flex-start" wrap="wrap" gap="sm">
          <Stack gap={2}>
            <Title order={2} size="h4">
              Épisodes
            </Title>
            <Text size="sm" c="dimmed">
              {`${String(count)} épisode${count > 1 ? 's' : ''}`}
            </Text>
            <Text size="xs" c="dimmed" maw={560}>
              Seuls les épisodes visibles (avec une vidéo prête ou un lien) comptent dans les
              épisodes gratuits.
            </Text>
          </Stack>
          {count === 0 ? null : addButton}
        </Group>

        {count === 0 ? (
          <EmptyState
            title="Aucun épisode pour le moment"
            description="Ajoutez le premier épisode de la série."
            action={addButton}
          />
        ) : (
          seasons.map((season) => (
            <Table.ScrollContainer key={season.seasonNumber} minWidth={760}>
              <Table highlightOnHover captionSide="top">
                <Table.Caption style={{ textAlign: 'left', fontWeight: 600 }}>
                  {`Saison ${String(season.seasonNumber)}`}
                </Table.Caption>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th scope="col" ta="right" w={56}>
                      N°
                    </Table.Th>
                    <Table.Th scope="col">Titre</Table.Th>
                    <Table.Th scope="col">Durée</Table.Th>
                    <Table.Th scope="col">Sortie</Table.Th>
                    <Table.Th scope="col">Accès</Table.Th>
                    <Table.Th scope="col">Vidéo</Table.Th>
                    <Table.Th scope="col" w={96}>
                      Actions
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {season.episodes.map((episode) => {
                    const key = episodeKey(episode.seasonNumber, episode.episodeNumber)
                    const name = episodeName(episode.seasonNumber, episode.episodeNumber)
                    const busy = deleting === key
                    return (
                      <Table.Tr key={key}>
                        <Table.Td ta="right">{episode.episodeNumber}</Table.Td>
                        <Table.Td>
                          <Text size="sm" fw={600}>
                            {episode.title}
                          </Text>
                        </Table.Td>
                        <Table.Td style={NO_WRAP}>
                          {episode.duration === null ||
                          episode.duration === undefined ||
                          episode.duration <= 0
                            ? MISSING_VALUE
                            : formatDuration(episode.duration)}
                        </Table.Td>
                        <Table.Td style={NO_WRAP}>
                          {formatDate(episode.releaseDate, { timeZone: 'UTC' })}
                        </Table.Td>
                        <Table.Td>
                          <AccessBadge episode={episode} />
                        </Table.Td>
                        <Table.Td>
                          <EpisodeVideoCell episode={episode} />
                        </Table.Td>
                        <Table.Td>
                          <Group gap={4} wrap="nowrap">
                            <Tooltip label="Modifier">
                              <ActionIcon
                                variant="subtle"
                                aria-label={`Modifier ${name}`}
                                disabled={busy}
                                onClick={() => {
                                  setTarget({
                                    mode: 'edit',
                                    seasonNumber: episode.seasonNumber,
                                    episodeNumber: episode.episodeNumber,
                                  })
                                }}
                              >
                                <IconPencil size={16} aria-hidden="true" />
                              </ActionIcon>
                            </Tooltip>
                            <Tooltip label="Supprimer">
                              <ActionIcon
                                variant="subtle"
                                color="noliRed"
                                aria-label={`Supprimer ${name}`}
                                loading={busy}
                                disabled={busy}
                                onClick={() => {
                                  void remove(episode)
                                }}
                              >
                                <IconTrash size={16} aria-hidden="true" />
                              </ActionIcon>
                            </Tooltip>
                          </Group>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
          ))
        )}
      </Stack>
      {target === undefined ? null : (
        <EpisodeModal
          key={
            target.mode === 'create'
              ? 'create'
              : episodeKey(target.seasonNumber, target.episodeNumber)
          }
          target={target}
          series={series}
          onClose={() => {
            setTarget(undefined)
            onDirtyChange(false)
          }}
          onDirtyChange={onDirtyChange}
          onLeave={onLeave}
        />
      )}
    </Paper>
  )
}
