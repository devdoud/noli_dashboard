/** Lignes squelettes à la forme d'un tableau, pendant le premier chargement (spec 0003, AC-8). */
import { Skeleton, Table, VisuallyHidden } from '@mantine/core'
import type { ReactNode } from 'react'

export interface SkeletonColumn {
  readonly key: string
  readonly header: ReactNode
  readonly width?: number | string
}

interface TableSkeletonProps {
  readonly columns: readonly SkeletonColumn[]
  readonly rows?: number
  readonly caption?: string
}

export function TableSkeleton({ columns, rows = 5, caption }: TableSkeletonProps) {
  return (
    <Table.ScrollContainer minWidth={640}>
      <Table aria-busy="true">
        {caption === undefined ? null : (
          <Table.Caption>
            <VisuallyHidden>{caption}</VisuallyHidden>
          </Table.Caption>
        )}
        <Table.Thead>
          <Table.Tr>
            {columns.map((column) => (
              <Table.Th key={column.key} w={column.width}>
                {column.header}
              </Table.Th>
            ))}
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {Array.from({ length: rows }, (_, rowIndex) => (
            <Table.Tr key={rowIndex}>
              {columns.map((column) => (
                <Table.Td key={column.key}>
                  <Skeleton height={12} radius="sm" width={rowIndex % 2 === 0 ? '80%' : '60%'} />
                </Table.Td>
              ))}
            </Table.Tr>
          ))}
        </Table.Tbody>
      </Table>
      <VisuallyHidden role="status">Chargement…</VisuallyHidden>
    </Table.ScrollContainer>
  )
}
