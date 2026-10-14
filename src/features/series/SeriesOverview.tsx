// Aperçu en lecture seule de la fiche : couverture, chiffres clés, dates (spec 0005, AC-6).
import { Group, Paper, SimpleGrid, Stack, Text } from '@mantine/core'
import type { ReactNode } from 'react'
import type { AdminSeries } from '@/features/series/schemas'
import { CoverThumbnail } from '@/features/series/SeriesCells'
import { formatRating } from '@/features/series/seriesFormat'
import { formatDateTime, MISSING_VALUE } from '@/shared/ui/format'

function Fact({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <Stack gap={2}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text size="sm" fw={600}>
        {children}
      </Text>
    </Stack>
  )
}

export function SeriesOverview({ series }: { readonly series: AdminSeries }) {
  return (
    <Paper withBorder p="lg">
      <Group align="flex-start" gap="lg" wrap="wrap">
        <CoverThumbnail src={series.coverImage} width={120} height={180} />
        <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="lg" style={{ flex: 1, minWidth: 220 }}>
          <Fact label="Épisodes">{series.totalEpisodes}</Fact>
          <Fact label="Note">
            {series.votes > 0
              ? `${formatRating(series.rating)} (${series.votes.toLocaleString('fr-FR')})`
              : MISSING_VALUE}
          </Fact>
          <Fact label="Créée le">{formatDateTime(series.createdAt)}</Fact>
          <Fact label="Modifiée le">{formatDateTime(series.updatedAt)}</Fact>
        </SimpleGrid>
      </Group>
    </Paper>
  )
}
