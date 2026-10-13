/** En tête de page : le seul h1, une description et des actions à droite (spec 0003, AC-12). */
import { Group, Stack, Text, Title } from '@mantine/core'
import type { ReactNode } from 'react'
import { usePageTitle } from '@/shared/ui/usePageTitle'

interface PageHeaderProps {
  readonly title: string
  readonly description?: ReactNode
  readonly actions?: ReactNode
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  usePageTitle(title)

  return (
    <Group justify="space-between" align="flex-start" gap="sm" mb="lg" wrap="wrap">
      <Stack gap={4}>
        <Title order={1} size="h2">
          {title}
        </Title>
        {description === undefined ? null : <Text c="dimmed">{description}</Text>}
      </Stack>
      {actions === undefined ? null : <Group gap="xs">{actions}</Group>}
    </Group>
  )
}
