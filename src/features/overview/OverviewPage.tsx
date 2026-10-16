import { SimpleGrid, Skeleton } from '@mantine/core'
import { IconMovie, IconPlayerPlay, IconVideo } from '@tabler/icons-react'
import { useSeriesStats } from '@/features/overview/api'
import {
  episodesTileLabel,
  seriesTileLabel,
  videoDetailText,
  videosTileLabel,
} from '@/features/overview/overviewFormat'
import { StatTile } from '@/features/overview/StatTile'
import { ErrorState } from '@/shared/ui/ErrorState'
import { PageHeader } from '@/shared/ui/PageHeader'

// Accueil du dashboard : les chiffres du catalogue et le travail en attente (spec 0010).

/** Liste des séries filtrée sur les vidéos à traiter (spec 0010, AC-3, AC-4). */
export const VIDEOS_TO_PROCESS_PATH = '/series?videos=a-traiter'

const GRID_COLS = { base: 1, sm: 3 } as const

function OverviewTiles() {
  const stats = useSeriesStats()

  if (stats.isError) {
    return <ErrorState error={stats.error} onRetry={() => void stats.refetch()} />
  }

  if (stats.data === undefined) {
    return (
      <SimpleGrid cols={GRID_COLS} spacing="md" aria-busy="true">
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} height={128} radius="md" />
        ))}
      </SimpleGrid>
    )
  }

  const { series, episodes, videosToProcess } = stats.data
  const allReady = videosToProcess.total === 0

  return (
    <SimpleGrid cols={GRID_COLS} spacing="md">
      <StatTile
        icon={<IconMovie size={20} />}
        title="Séries"
        value={series}
        label={seriesTileLabel(series)}
        to="/series"
      />
      <StatTile
        icon={<IconPlayerPlay size={20} />}
        title="Épisodes"
        value={episodes}
        label={episodesTileLabel(episodes)}
        to="/series"
      />
      <StatTile
        icon={<IconVideo size={20} />}
        title="Vidéos à traiter"
        value={videosToProcess.total}
        detail={allReady ? 'Tout est prêt' : videoDetailText(videosToProcess)}
        label={videosTileLabel(videosToProcess.total)}
        {...(allReady ? {} : { to: VIDEOS_TO_PROCESS_PATH })}
      />
    </SimpleGrid>
  )
}

export function OverviewPage() {
  return (
    <>
      <PageHeader title="Vue d'ensemble" />
      <OverviewTiles />
    </>
  )
}
