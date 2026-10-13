/**
 * Tableau paginé par le serveur (spec 0003, AC-8, section « DataTable »).
 * Priorité d'affichage : erreur, squelettes au premier chargement, état vide, lignes
 * (grisées pendant un rechargement). Une ligne cliquable passe par un vrai lien dans une cellule.
 */
import { Group, Pagination, Stack, Table, Text, VisuallyHidden } from '@mantine/core'
import { useEffect, type ReactNode } from 'react'
import { EmptyState, type EmptyStateProps } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { pageCount, rangeSummary } from '@/shared/ui/pagination'
import { TableSkeleton } from '@/shared/ui/TableSkeleton'

export interface DataTableColumn<T> {
  readonly key: string
  readonly header: ReactNode
  readonly render: (row: T) => ReactNode
  readonly width?: number | string
}

export interface DataTableProps<T> {
  readonly caption: string
  readonly columns: readonly DataTableColumn<T>[]
  readonly rows: readonly T[] | undefined
  readonly getRowKey: (row: T) => string
  readonly total: number
  readonly page: number
  readonly pageSize: number
  readonly onPageChange: (page: number) => void
  readonly isLoading?: boolean
  readonly error?: unknown
  readonly onRetry?: () => void
  readonly empty: EmptyStateProps
}

const CONTROL_LABELS: Readonly<Record<string, string>> = {
  previous: 'Page précédente',
  next: 'Page suivante',
  first: 'Première page',
  last: 'Dernière page',
}

export function DataTable<T>({
  caption,
  columns,
  rows,
  getRowKey,
  total,
  page,
  pageSize,
  onPageChange,
  isLoading = false,
  error,
  onRetry,
  empty,
}: DataTableProps<T>) {
  const pages = pageCount(total, pageSize)
  const hasRows = rows !== undefined && rows.length > 0

  // Après une suppression, la page courante peut dépasser la dernière page.
  useEffect(() => {
    if (total > 0 && page > pages) onPageChange(pages)
  }, [total, page, pages, onPageChange])

  if (error !== undefined && error !== null) return <ErrorState error={error} onRetry={onRetry} />
  if (isLoading && rows === undefined) return <TableSkeleton columns={columns} caption={caption} />
  if (!hasRows || total === 0) return <EmptyState {...empty} />

  const refetching = isLoading

  return (
    <Stack gap="sm">
      <Table.ScrollContainer minWidth={640}>
        <Table
          highlightOnHover
          aria-busy={refetching ? 'true' : undefined}
          style={refetching ? { opacity: 0.6 } : undefined}
        >
          <Table.Caption>
            <VisuallyHidden>{caption}</VisuallyHidden>
          </Table.Caption>
          <Table.Thead>
            <Table.Tr>
              {columns.map((column) => (
                <Table.Th key={column.key} w={column.width} scope="col">
                  {column.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((row) => (
              <Table.Tr key={getRowKey(row)}>
                {columns.map((column) => (
                  <Table.Td key={column.key}>{column.render(row)}</Table.Td>
                ))}
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Table.ScrollContainer>
      <Group justify="space-between" gap="sm" wrap="wrap">
        <Text size="sm" c="dimmed">
          {rangeSummary(page, pageSize, total)}
        </Text>
        {pages > 1 ? (
          <nav aria-label="Pagination">
            <Pagination
              total={pages}
              value={Math.min(page, pages)}
              onChange={onPageChange}
              size="sm"
              getControlProps={(control) => ({ 'aria-label': CONTROL_LABELS[control] })}
              getItemProps={(item) => ({ 'aria-label': `Aller à la page ${String(item)}` })}
            />
          </nav>
        ) : null}
      </Group>
    </Stack>
  )
}
