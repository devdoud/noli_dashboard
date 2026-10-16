// Cellules de la liste des séries (spec 0004, AC-8, table « Colonnes »).
import { Anchor, Badge, Box, Group, Image, Text } from '@mantine/core'
import { IconPhoto } from '@tabler/icons-react'
import { useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router'
import { videosToProcessText } from '@/features/series/filters'
import { seriesPath } from '@/features/series/navigation'
import type { SeriesSummary } from '@/features/series/schemas'
import { formatRating, freeEpisodesLabel, statusLabel } from '@/features/series/seriesFormat'
import { formatDate, MISSING_VALUE } from '@/shared/ui/format'

const COVER_WIDTH = 40
const COVER_HEIGHT = 60

// Un badge ou un texte court ne se coupe jamais ni ne passe à la ligne dans une cellule.
const NO_WRAP: CSSProperties = { whiteSpace: 'nowrap', flexShrink: 0 }
const BADGE_STYLE: CSSProperties = { flexShrink: 0, minWidth: 'max-content' }

interface CoverThumbnailProps {
  readonly src: string | null | undefined
  readonly width?: number
  readonly height?: number
}

/** Couverture en 2:3, ou le bloc par défaut si elle manque ou ne se charge pas. */
export function CoverThumbnail({
  src,
  width = COVER_WIDTH,
  height = COVER_HEIGHT,
}: CoverThumbnailProps) {
  // Une image qui ne se charge pas affiche le même bloc qu'une couverture absente.
  const [failed, setFailed] = useState(false)
  if (failed || src === undefined || src === null || src.trim() === '') {
    return (
      <Box
        data-testid="couverture-absente"
        w={width}
        h={height}
        bg="var(--noli-color-surface-raised)"
        style={{
          borderRadius: 'var(--mantine-radius-sm)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        <IconPhoto
          size={Math.round(width * 0.45)}
          aria-hidden="true"
          color="var(--mantine-color-dimmed)"
        />
      </Box>
    )
  }
  return (
    <Image
      src={src}
      alt=""
      loading="lazy"
      w={width}
      h={height}
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

interface TitleCellProps {
  readonly series: SeriesSummary
  /** Compte affiché sous le titre avec le filtre « Vidéos à traiter » (spec 0010, AC-5). */
  readonly videosToProcess?: number | undefined
}

export function TitleCell({ series, videosToProcess }: TitleCellProps) {
  const { pathname, search } = useLocation()
  // Un seul lien par ligne, sur le titre ; la fiche sait revenir à cette page (spec 0005, AC-1).
  return (
    <Group gap="sm" wrap="nowrap">
      <CoverThumbnail src={series.coverImage} />
      <Box>
        <Anchor
          component={Link}
          to={seriesPath(series._id)}
          state={{ from: pathname + search }}
          fw={600}
          size="sm"
        >
          {series.title}
        </Anchor>
        {videosToProcess === undefined ? null : (
          <Text size="xs" c="dimmed">
            {videosToProcessText(videosToProcess)}
          </Text>
        )}
      </Box>
    </Group>
  )
}

// Les catégories masquées figurent aussi, suivies de « (masquée) » en texte secondaire (spec 0009, AC-9).
export function CategoriesCell({ series }: { readonly series: SeriesSummary }) {
  if (series.categories.length === 0) return <Text size="sm">{MISSING_VALUE}</Text>
  return (
    <Text size="sm">
      {series.categories.map((category, index) => (
        <span key={category._id}>
          {index === 0 ? null : ', '}
          {category.name}
          {category.isVisible === false ? (
            <Text span size="sm" c="dimmed">
              {' (masquée)'}
            </Text>
          ) : null}
        </span>
      ))}
    </Text>
  )
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
