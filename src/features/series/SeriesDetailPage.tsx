// Fiche d'une série : aperçu, formulaire, épisodes, suppression (spec 0005, spec 0006).
import { Alert, Anchor, Button, Group, Paper, Skeleton, Stack, Text, Title } from '@mantine/core'
import { IconArrowLeft, IconTrash } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router'
import { seriesKeys, updateSeries, useSeriesDetail } from '@/features/series/api'
import { DeleteSeriesModal, type DeleteOutcome } from '@/features/series/DeleteSeriesModal'
import { POLL_EVERY_MS, shouldPoll } from '@/features/series/episodes/episodeModel'
import { EpisodesSection } from '@/features/series/episodes/EpisodesSection'
import { useVideoUploads } from '@/features/series/episodes/uploads/uploadsContext'
import { VideoUploadsProvider } from '@/features/series/episodes/uploads/VideoUploadsProvider'
import { backToListPath, isSeriesId, SERIES_LIST_PATH } from '@/features/series/navigation'
import type { AdminSeries } from '@/features/series/schemas'
import { SeriesForm } from '@/features/series/SeriesForm'
import { toFormValues, type SeriesFormValues } from '@/features/series/seriesFormSchema'
import { SeriesOverview } from '@/features/series/SeriesOverview'
import { toSeriesPatch } from '@/features/series/seriesPayload'
import { useUnsavedChangesGuard } from '@/features/series/useUnsavedChangesGuard'
import { isApiError } from '@/shared/api/errors'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { notifySuccess } from '@/shared/ui/notifySuccess'
import { PageHeader } from '@/shared/ui/PageHeader'
import { usePageTitle } from '@/shared/ui/usePageTitle'

function BackLink({ to, onClick }: { readonly to: string; readonly onClick?: () => void }) {
  return (
    <Anchor component={Link} to={to} onClick={onClick} size="sm" mb="xs">
      <Group gap={4} component="span">
        <IconArrowLeft size={16} aria-hidden="true" />
        Retour aux séries
      </Group>
    </Anchor>
  )
}

function SeriesNotFound({ listPath }: { readonly listPath: string }) {
  usePageTitle('Série introuvable')
  return (
    <EmptyState
      title="Série introuvable"
      description="Elle a peut être été supprimée."
      action={
        <Button component={Link} to={listPath} variant="light">
          Retour aux séries
        </Button>
      }
    />
  )
}

export const UPLOAD_LEAVE_MESSAGE = "Un envoi de vidéo est en cours. Quitter l'arrêtera."
export const REFRESH_FAILED_MESSAGE = "La fiche n'a pas pu être actualisée."

function SeriesDetailContent({
  series,
  listPath,
  refreshFailed,
}: {
  readonly series: AdminSeries
  readonly listPath: string
  readonly refreshFailed: boolean
}) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [base, setBase] = useState<SeriesFormValues>(() => toFormValues(series))
  const uploads = useVideoUploads()
  const [guardActive, setGuardActive] = useState(false)
  const [episodeDirty, setEpisodeDirty] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  // Formulaire modifié, fenêtre d'épisode modifiée ou envoi en cours (spec 0006, AC-15).
  const guard = useUnsavedChangesGuard(
    guardActive || episodeDirty || uploads.active,
    uploads.active ? UPLOAD_LEAVE_MESSAGE : undefined,
  )

  const submit = useCallback(
    async (values: SeriesFormValues) => {
      const saved = await updateSeries(series._id, toSeriesPatch(base, values))
      queryClient.setQueryData(seriesKeys.detail(series._id), saved)
      void queryClient.invalidateQueries({ queryKey: seriesKeys.lists })
      const nextBase = toFormValues(saved)
      setBase(nextBase)
      notifySuccess('Modifications enregistrées.')
      return nextBase
    },
    [base, queryClient, series._id],
  )

  const handleDeleted = (outcome: DeleteOutcome) => {
    guard.allowLeave()
    queryClient.removeQueries({ queryKey: seriesKeys.detail(series._id) })
    void queryClient.invalidateQueries({ queryKey: seriesKeys.lists })
    void navigate(SERIES_LIST_PATH, { replace: true })
    notifySuccess(
      outcome === 'deleted' ? 'Série supprimée.' : 'Cette série avait déjà été supprimée.',
    )
  }

  return (
    <>
      <BackLink to={listPath} />
      <PageHeader title={series.title} />
      <Stack gap="lg">
        {refreshFailed ? (
          <Alert color="noliRed" role="status">
            <Text size="sm">{REFRESH_FAILED_MESSAGE}</Text>
          </Alert>
        ) : null}
        <SeriesOverview series={series} />
        <SeriesForm
          mode="edit"
          base={base}
          totalEpisodes={series.totalEpisodes}
          submitLabel="Enregistrer"
          pendingLabel="Enregistrement en cours"
          onSubmit={submit}
          onGuardChange={setGuardActive}
          listPath={listPath}
          onLeaveGone={guard.allowLeave}
          knownCategories={series.categories}
        />
        <EpisodesSection
          series={series}
          onDirtyChange={setEpisodeDirty}
          onLeave={guard.allowLeave}
        />
        <Paper
          withBorder
          p="lg"
          style={{ '--paper-border-color': 'var(--mantine-color-noliRed-6)' }}
        >
          <Stack gap="sm" align="flex-start">
            <Title order={2} size="h4">
              Supprimer la série
            </Title>
            <Text size="sm" c="dimmed">
              La série, ses épisodes, ses vidéos et ses images seront effacés définitivement.
            </Text>
            <Button
              color="noliRed.8"
              leftSection={<IconTrash size={16} aria-hidden="true" />}
              onClick={() => {
                setDeleteOpen(true)
              }}
            >
              Supprimer la série
            </Button>
          </Stack>
        </Paper>
      </Stack>
      <DeleteSeriesModal
        opened={deleteOpen}
        onClose={() => {
          setDeleteOpen(false)
        }}
        seriesId={series._id}
        title={series.title}
        totalEpisodes={series.totalEpisodes}
        onDeleted={handleDeleted}
      />
      {guard.modal}
    </>
  )
}

function DetailSkeleton() {
  return (
    <Stack gap="lg" aria-busy="true">
      <Skeleton height={32} width="40%" />
      <Skeleton height={200} />
      <Skeleton height={420} />
    </Stack>
  )
}

function SeriesDetailBody({ id, listPath }: { readonly id: string; readonly listPath: string }) {
  const uploads = useVideoUploads()
  const query = useSeriesDetail(id, true, (series) =>
    series !== undefined && shouldPoll(series.episodes, uploads.expectsVideo)
      ? POLL_EVERY_MS
      : false,
  )
  usePageTitle(query.data?.title ?? 'Série')
  const { data, dataUpdatedAt } = query
  const { sync } = uploads

  // Chaque relecture rapproche les envois de la fiche (autre admin, épisode disparu, encodage).
  useEffect(() => {
    if (data !== undefined) sync(data, dataUpdatedAt)
  }, [data, dataUpdatedAt, sync])

  const notFound =
    query.isError &&
    isApiError(query.error) &&
    query.error.kind === 'http' &&
    query.error.status === 404
  if (notFound) return <SeriesNotFound listPath={listPath} />
  // Une relecture en échec garde la fiche affichée, avec un bandeau.
  if (data !== undefined) {
    // key : la fiche repart de zéro quand on passe d'une série à une autre.
    return (
      <SeriesDetailContent
        key={data._id}
        series={data}
        listPath={listPath}
        refreshFailed={query.isError}
      />
    )
  }
  if (query.isError) {
    return (
      <>
        <BackLink to={listPath} />
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      </>
    )
  }
  return <DetailSkeleton />
}

export function SeriesDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const listPath = backToListPath(location.state)

  if (!isSeriesId(id)) return <InvalidSeries listPath={listPath} />
  // Les envois vivent avec la fiche de cette série ; quitter la fiche les arrête.
  return (
    <VideoUploadsProvider key={id} seriesId={id}>
      <SeriesDetailBody id={id} listPath={listPath} />
    </VideoUploadsProvider>
  )
}

function InvalidSeries({ listPath }: { readonly listPath: string }) {
  return <SeriesNotFound listPath={listPath} />
}
