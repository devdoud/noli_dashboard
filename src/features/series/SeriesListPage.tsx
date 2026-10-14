import { Paper, VisuallyHidden } from '@mantine/core'
import { useCallback, useEffect } from 'react'
import { useSearchParams } from 'react-router'
import { useSeriesPage } from '@/features/series/api'
import { lastPage, parsePage, SERIES_PAGE_SIZE } from '@/features/series/page'
import type { SeriesSummary } from '@/features/series/schemas'
import {
  AccessCell,
  CategoriesCell,
  DateCell,
  RatingCell,
  StatusCell,
  TitleCell,
} from '@/features/series/SeriesCells'
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable'
import { PageHeader } from '@/shared/ui/PageHeader'

// Liste paginée des séries (spec 0004, AC-8 à AC-10), page courante dans l'adresse.

const columns: readonly DataTableColumn<SeriesSummary>[] = [
  {
    key: 'title',
    header: 'Couverture et titre',
    render: (series) => <TitleCell series={series} />,
    width: '32%',
  },
  {
    key: 'categories',
    header: 'Catégories',
    render: (series) => <CategoriesCell series={series} />,
  },
  { key: 'status', header: 'Statut', render: (series) => <StatusCell series={series} /> },
  { key: 'access', header: 'Accès', render: (series) => <AccessCell series={series} /> },
  {
    key: 'episodes',
    header: <span style={{ display: 'block', textAlign: 'right' }}>Épisodes</span>,
    render: (series) => (
      <span style={{ display: 'block', textAlign: 'right' }}>{series.totalEpisodes}</span>
    ),
  },
  { key: 'rating', header: 'Note', render: (series) => <RatingCell series={series} /> },
  {
    key: 'updatedAt',
    header: 'Mise à jour',
    render: (series) => <DateCell iso={series.updatedAt} />,
  },
]

function pageParams(page: number): Record<string, string> {
  return page <= 1 ? {} : { page: String(page) }
}

function getRowKey(series: SeriesSummary): string {
  return series._id
}

export function SeriesListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const query = useSeriesPage(page)
  const { data } = query
  const total = data?.data.total ?? 0

  // Page au delà de la fin (adresse ancienne ou modifiée à la main) : on remplace l'adresse
  // par la dernière page, sans entrée d'historique et sans montrer l'état vide (AC-9).
  // Ces données vides restent affichées en attente pendant le chargement de la dernière page :
  // elles sont neutralisées aussi, sinon le recadrage de DataTable ajouterait une entrée.
  const emptyBeyondEnd =
    data !== undefined && data.data.series.length === 0 && total > 0 && data.data.page > 1
  const mustReplace = emptyBeyondEnd && !query.isPlaceholderData

  useEffect(() => {
    if (mustReplace) setSearchParams(pageParams(lastPage(total)), { replace: true })
  }, [mustReplace, total, setSearchParams])

  const onPageChange = useCallback(
    (next: number) => {
      setSearchParams(pageParams(next))
      window.scrollTo({ top: 0 })
    },
    [setSearchParams],
  )

  const displayedPage = data?.data.page ?? page
  const announcement =
    data !== undefined && !query.isPlaceholderData && !emptyBeyondEnd && total > 0
      ? `Page ${String(displayedPage)} sur ${String(lastPage(total))}`
      : ''

  return (
    <>
      <PageHeader
        title="Séries"
        description="Toutes les séries du catalogue, des plus récentes aux plus anciennes."
      />
      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
      <Paper withBorder p="md">
        <DataTable
          caption="Liste des séries"
          columns={columns}
          rows={emptyBeyondEnd ? undefined : data?.data.series}
          getRowKey={getRowKey}
          // Pendant le recadrage, la page s'en charge : le total nul évite celui de DataTable.
          total={emptyBeyondEnd ? 0 : total}
          page={displayedPage}
          pageSize={SERIES_PAGE_SIZE}
          onPageChange={onPageChange}
          isLoading={query.isFetching || emptyBeyondEnd}
          error={query.error ?? undefined}
          onRetry={() => void query.refetch()}
          empty={{
            title: 'Aucune série pour le moment',
            description: "Les séries créées dans le dashboard ou par l'API apparaîtront ici.",
          }}
        />
      </Paper>
    </>
  )
}
