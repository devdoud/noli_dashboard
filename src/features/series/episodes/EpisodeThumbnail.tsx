// Vignette d'un épisode (spec 0007, AC-6) : partie « Vignette » de la fenêtre de modification,
// et petite vignette décorative de la colonne Titre.
import { Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { useImageMutations } from '@/features/series/api'
import { episodeName } from '@/features/series/episodes/episodeModel'
import { IMAGE_SLOTS } from '@/shared/images/imageRules'
import { ImageSlot } from '@/shared/images/ImageSlot'
import type { AdminEpisode } from '@/features/series/schemas'

interface EpisodeThumbnailProps {
  readonly seriesId: string
  readonly episode: AdminEpisode
  readonly onPendingChange: (pending: boolean) => void
  /** L'épisode a disparu (404) : la fenêtre se ferme sans question. */
  readonly onGone: () => void
}

export function EpisodeThumbnail({
  seriesId,
  episode,
  onPendingChange,
  onGone,
}: EpisodeThumbnailProps) {
  const { seasonNumber, episodeNumber } = episode
  const mutations = useImageMutations(seriesId, {
    kind: 'thumbnail',
    seasonNumber,
    episodeNumber,
  })
  const name = episodeName(seasonNumber, episodeNumber)
  return (
    <Stack gap="xs">
      <ImageSlot
        slot={IMAGE_SLOTS.thumbnail}
        currentUrl={episode.thumbnail ?? undefined}
        alt={`Vignette de ${name}`}
        nameSuffix={`de ${name}`}
        mutations={mutations}
        onPendingChange={onPendingChange}
        onGone={onGone}
        maxWidth={360}
      />
      <Text size="xs" c="dimmed">
        JPEG, PNG ou WebP, 5 Mo au plus, 640 × 360 px au moins.
      </Text>
    </Stack>
  )
}

/** Petite vignette 16:9 devant le titre ; cachée si elle ne charge pas. */
export function EpisodeThumbnailMini({ url }: { readonly url: string }) {
  const [failed, setFailed] = useState(false)
  if (failed) return null
  return (
    <img
      src={url}
      alt=""
      width={64}
      height={36}
      style={{ objectFit: 'cover', borderRadius: 4, flexShrink: 0, display: 'block' }}
      onError={() => {
        setFailed(true)
      }}
    />
  )
}
