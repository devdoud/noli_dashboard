import { Group, Paper, Text, ThemeIcon, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { formatCount } from '@/features/overview/overviewFormat'

// Une tuile de chiffre de la vue d'ensemble (spec 0010, AC-1, AC-3, AC-8) : toute la tuile est un
// lien quand `to` est donné, sinon un simple bloc ; le nom accessible dit le nombre et la suite.

interface StatTileProps {
  readonly icon: ReactNode
  readonly title: string
  readonly value: number
  readonly detail?: string
  readonly label: string
  readonly to?: string
}

function TileContent({ icon, title, value, detail }: Omit<StatTileProps, 'label' | 'to'>) {
  return (
    <>
      <Group gap="sm" mb="xs" wrap="nowrap">
        <ThemeIcon variant="light" size="lg" aria-hidden="true">
          {icon}
        </ThemeIcon>
        <Title order={2} size="h5">
          {title}
        </Title>
      </Group>
      <Text fz={32} fw={700} lh={1.2}>
        {formatCount(value)}
      </Text>
      {detail === undefined || detail === '' ? null : (
        <Text size="sm" c="dimmed" mt={4}>
          {detail}
        </Text>
      )}
    </>
  )
}

export function StatTile({ label, to, ...content }: StatTileProps) {
  if (to === undefined) {
    return (
      <Paper withBorder p="md" role="group" aria-label={label}>
        <TileContent {...content} />
      </Paper>
    )
  }
  return (
    <Paper withBorder p="md" component={Link} to={to} aria-label={label} td="none" c="inherit">
      <TileContent {...content} />
    </Paper>
  )
}
