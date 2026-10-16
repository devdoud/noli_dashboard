import { Button, Group, Paper, Stack, VisuallyHidden } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router'
import { useSeriesPage } from '@/features/series/api'
import {
  hasFilters,
  makeFilters,
  parseFilters,
  resultCountText,
  withFilters,
  type SeriesFilters,
} from '@/features/series/filters'
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
import { SeriesFiltersBar, type HistoryMode } from '@/features/series/SeriesFiltersBar'
import { isApiError } from '@/shared/api/errors'
import { useAllCategories } from '@/shared/api/categories'
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable'
import { ErrorState } from '@/shared/ui/ErrorState'
import { PageHeader } from '@/shared/ui/PageHeader'

// Liste paginée et filtrée des séries (specs 0004 et 0009). Page et filtres vivent dans l'adresse.

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

function getRowKey(series: SeriesSummary): string {
  return series._id
}

export function SeriesListPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const searchKey = searchParams.toString()
  const page = parsePage(searchParams.get('page'))
  const filters = useMemo(() => parseFilters(new URLSearchParams(searchKey)), [searchKey])
  const filtered = hasFilters(filters)
  const searchRef = useRef<HTMLInputElement>(null)

  // Une catégorie dans l'adresse attend la liste des catégories avant la requête (AC-5) : une
  // catégorie inconnue ne montre jamais un instant « Aucune série ».
  const categories = useAllCategories()
  const waitingCategories = filters.categoryId !== undefined && categories.isPending
  // Adresse invalide (AC-5) : filtres et page invalides retirés, sans entrée d'historique. Une
  // catégorie absente de la liste est retirée seulement quand cette liste est chargée et à jour.
  const unknownCategory =
    filters.categoryId !== undefined &&
    categories.data !== undefined &&
    !categories.isFetching &&
    !categories.data.some((category) => category._id === filters.categoryId)
  const query = useSeriesPage(page, filters, !waitingCategories && !unknownCategory)
  const { data } = query
  const total = data?.data.total ?? 0

  // Sans données encore chargées, TanStack Query efface l'erreur au début d'un nouvel essai.
  // La page garde l'erreur affichée jusqu'à la réponse (spec 0004, « error est prioritaire »).
  const [retrying, setRetrying] = useState<{ readonly key: string; readonly error: unknown }>()
  const retry = useCallback(() => {
    setRetrying({ key: searchKey, error: query.error })
    void query.refetch().finally(() => {
      setRetrying(undefined)
    })
  }, [searchKey, query])
  const shownError =
    query.error ??
    (retrying !== undefined && retrying.key === searchKey && query.isFetching
      ? retrying.error
      : undefined)
  const refused = isApiError(shownError) && shownError.status === 400

  const applyFilters = useCallback(
    (next: SeriesFilters, mode: HistoryMode) => {
      setSearchParams(withFilters(makeFilters(next), 1), { replace: mode === 'replace' })
    },
    [setSearchParams],
  )
  const clearFilters = useCallback(() => {
    setSearchParams(withFilters({}, 1))
    searchRef.current?.focus()
  }, [setSearchParams])

  const canonical = withFilters(
    unknownCategory ? makeFilters({ ...filters, categoryId: undefined }) : filters,
    page,
  ).toString()
  useEffect(() => {
    if (canonical !== searchKey) setSearchParams(new URLSearchParams(canonical), { replace: true })
  }, [canonical, searchKey, setSearchParams])

  // Page au delà de la fin (adresse ancienne ou modifiée à la main, filtre plus étroit) : on
  // remplace l'adresse par la dernière page, filtres gardés, sans entrée d'historique (AC-6).
  // Ces données vides restent affichées en attente pendant le chargement de la dernière page :
  // elles sont neutralisées aussi, sinon le recadrage de DataTable ajouterait une entrée.
  const emptyBeyondEnd =
    data !== undefined && data.data.series.length === 0 && total > 0 && data.data.page > 1
  const mustReplace = emptyBeyondEnd && !query.isPlaceholderData

  useEffect(() => {
    if (mustReplace) setSearchParams(withFilters(filters, lastPage(total)), { replace: true })
  }, [mustReplace, total, filters, setSearchParams])

  const onPageChange = useCallback(
    (next: number) => {
      setSearchParams(withFilters(filters, next))
      window.scrollTo({ top: 0 })
    },
    [filters, setSearchParams],
  )

  // Annonces faites sur des résultats arrivés, jamais sur ceux de la requête précédente (AC-10).
  const settled = data !== undefined && !query.isPlaceholderData
  const displayedPage = data?.data.page ?? page
  const announcement =
    settled && !emptyBeyondEnd && total > 0
      ? `Page ${String(displayedPage)} sur ${String(lastPage(total))}`
      : ''
  const countText = filtered && settled && !emptyBeyondEnd ? resultCountText(total) : ''

  const clearButton = (
    <Button variant="light" size="xs" onClick={clearFilters}>
      Effacer les filtres
    </Button>
  )

  return (
    <>
      <PageHeader
        title="Séries"
        description="Toutes les séries du catalogue, des plus récentes aux plus anciennes."
        actions={
          <Button
            component={Link}
            to="/series/nouvelle"
            state={{ from: location.pathname + location.search }}
            leftSection={<IconPlus size={16} aria-hidden="true" />}
          >
            Nouvelle série
          </Button>
        }
      />
      <SeriesFiltersBar
        filters={filters}
        onChange={applyFilters}
        onClear={clearFilters}
        categories={categories.data}
        categoriesStatus={categories.status}
        countText={countText}
        searchRef={searchRef}
      />
      <VisuallyHidden aria-live="polite">{announcement}</VisuallyHidden>
      <Paper withBorder p="md">
        {shownError === undefined || shownError === null ? (
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
            isLoading={query.isFetching || emptyBeyondEnd || waitingCategories || unknownCategory}
            empty={
              filtered
                ? { title: 'Aucune série ne correspond à ces filtres.', action: clearButton }
                : {
                    title: 'Aucune série pour le moment',
                    description:
                      "Les séries créées dans le dashboard ou par l'API apparaîtront ici.",
                  }
            }
          />
        ) : (
          <Stack gap="sm">
            {/* Un filtre refusé (400) redonnerait la même erreur : pas de « Réessayer » (AC-8). */}
            <ErrorState error={shownError} onRetry={refused ? undefined : retry} />
            {filtered || refused ? <Group>{clearButton}</Group> : null}
          </Stack>
        )}
      </Paper>
    </>
  )
}
