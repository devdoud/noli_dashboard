// Section « Images » de la fiche (spec 0007, AC-1, AC-11) : couverture et bannière.
import { Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core'
import { useCallback, useEffect, useState } from 'react'
import { useImageMutations } from '@/features/series/api'
import { IMAGE_SLOTS } from '@/shared/images/imageRules'
import { ImageSlot } from '@/shared/images/ImageSlot'
import type { AdminSeries } from '@/features/series/schemas'

const COVER_MAX_WIDTH = 240

export const IMAGES_HELP =
  'JPEG, PNG ou WebP, 5 Mo au plus. Couverture : 400 × 600 px au moins. Bannière : 1280 × 720 px au moins. 10 envois ou retraits d’images ou de vidéos au plus par 10 minutes.'

interface SeriesImagesSectionProps {
  readonly series: AdminSeries
  /** Un aperçu attend ou un envoi est en cours dans l'un des emplacements (AC-9). */
  readonly onPendingChange: (pending: boolean) => void
}

export function SeriesImagesSection({ series, onPendingChange }: SeriesImagesSectionProps) {
  const cover = useImageMutations(series._id, { kind: 'cover' })
  const banner = useImageMutations(series._id, { kind: 'banner' })
  const [coverPending, setCoverPending] = useState(false)
  const [bannerPending, setBannerPending] = useState(false)
  const pending = coverPending || bannerPending

  useEffect(() => {
    onPendingChange(pending)
  }, [pending, onPendingChange])

  const onCoverPending = useCallback((value: boolean) => {
    setCoverPending(value)
  }, [])
  const onBannerPending = useCallback((value: boolean) => {
    setBannerPending(value)
  }, [])

  return (
    <Paper withBorder p="lg">
      <Stack gap="md">
        <Stack gap={4}>
          <Title order={2} size="h4">
            Images
          </Title>
          <Text size="xs" c="dimmed">
            {IMAGES_HELP}
          </Text>
        </Stack>
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          <ImageSlot
            slot={IMAGE_SLOTS.cover}
            currentUrl={series.coverImage ?? undefined}
            alt={`Couverture de ${series.title}`}
            mutations={cover}
            onPendingChange={onCoverPending}
            maxWidth={COVER_MAX_WIDTH}
          />
          <ImageSlot
            slot={IMAGE_SLOTS.banner}
            currentUrl={series.bannerImage ?? undefined}
            alt={`Bannière de ${series.title}`}
            mutations={banner}
            onPendingChange={onBannerPending}
          />
        </SimpleGrid>
      </Stack>
    </Paper>
  )
}
