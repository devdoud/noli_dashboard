// Cellules de la liste des séries (spec 0004, AC-8, table « Colonnes »).
import { Badge, Box, Group, Image, Text } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import { useState, type CSSProperties } from 'react'
import type { SeriesSummary } from '@/features/series/schemas'
import { formatRating, freeEpisodesLabel, statusLabel } from '@/features/series/seriesFormat'
import { formatDate, MISSING_VALUE } from '@/shared/ui/format'

const COVER_WIDTH = 40
const COVER_HEIGHT = 60

// Un badge ou un texte court ne se coupe jamais ni ne passe à la ligne dans une cellule.
const NO_WRAP: CSSProperties = { whiteSpace: 'nowrap', flexShrink: 0 }
const BADGE_STYLE: CSSProperties = { flexShrink: 0, minWidth: 'max-content' }

function CoverThumbnail({ src }: { readonly src: string | null | undefined }) {
  // Une image qui ne se charge pas affiche le même bloc qu'une couverture absente.
  const [failed, setFailed] = useState(false)
  if (failed || src === undefined || src === null || src.trim() === '') {
    return (
      <Box
        data-testid="couverture-absente"
        w={COVER_WIDTH}
        h={COVER_HEIGHT}
        bg="var(--noli-color-surface-raised)"
        style={{
          borderRadius: 'var(--mantine-radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconPhoto size={18} aria-hidden="true" color="var(--mantine-color-dimmed)" />
      </Box>
    )
  }
  return (
    <Image
      src={src}
      alt=""
      loading="lazy"
      w={COVER_WIDTH}
      h={COVER_HEIGHT}
      fit="cover"
      radius="sm"
      bg="var(--noli-color-surface-raised)"
      style={{ flexShrink: 0 }}
      onError={() => {
        setFailed(true)
      }}
    />
  )
}

export function TitleCell({ series }: { readonly series: SeriesSummary }) {
  return (
    <Group gap="sm" wrap="nowrap">
      <CoverThumbnail src={series.coverImage} />
      <Text fw={600} size="sm">
        {series.title}
      </Text>
    </Group>
  )
}

export function CategoriesCell({ series }: { readonly series: SeriesSummary }) {
  const names = series.categories.map((category) => category.name)
  return <Text size="sm">{names.length === 0 ? MISSING_VALUE : names.join(', ')}</Text>
}

export function StatusCell({ series }: { readonly series: SeriesSummary }) {
  const status = statusLabel(series.status)
  if (status === undefined) return <Text size="sm">{MISSING_VALUE}</Text>
  return (
    <Badge variant="light" color={status.color} style={BADGE_STYLE}>
      {status.label}
    </Badge>
  )
}

export function AccessCell({ series }: { readonly series: SeriesSummary }) {
  if (!series.isPremium) {
    return (
      <Badge variant="light" color="gray" style={BADGE_STYLE}>
        Gratuit
      </Badge>
    )
  }
  return (
    <Group gap="xs" wrap="nowrap">
      <Badge variant="light" color="noliAmber" style={BADGE_STYLE}>
        Premium
      </Badge>
      <Text size="sm" c="dimmed" style={NO_WRAP}>
        {freeEpisodesLabel(series.freeEpisodeCount)}
      </Text>
    </Group>
  )
}

export function DateCell({ iso }: { readonly iso: string | null | undefined }) {
  return (
    <Text size="sm" style={NO_WRAP}>
      {formatDate(iso)}
    </Text>
  )
}

export function RatingCell({ series }: { readonly series: SeriesSummary }) {
  if (series.votes <= 0) return <Text size="sm">{MISSING_VALUE}</Text>
  return (
    <Text size="sm" style={NO_WRAP}>
      {formatRating(series.rating)}{' '}
      <Text span size="sm" c="dimmed">
        ({series.votes.toLocaleString('fr-FR')})
      </Text>
    </Text>
  )
}
