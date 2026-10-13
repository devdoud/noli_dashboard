/** État vide : une icône, un titre, une explication et une action (spec 0003, AC-8). */
import { Stack, Text, ThemeIcon, Title } from '@mantine/core'
import { IconInbox } from '@tabler/icons-react'
import type { ReactNode } from 'react'

export interface EmptyStateProps {
  readonly title: string
  readonly description?: ReactNode
  readonly action?: ReactNode
  readonly icon?: ReactNode
}

export function EmptyState({ title, description, action, icon }: EmptyStateProps) {
  return (
    <Stack align="center" gap="xs" py="xl" px="md" ta="center">
      <ThemeIcon variant="light" size={48} radius="xl" aria-hidden="true">
        {icon ?? <IconInbox size={24} />}
      </ThemeIcon>
      <Title order={2} size="h4">
        {title}
      </Title>
      {description === undefined ? null : (
        <Text c="dimmed" maw={420}>
          {description}
        </Text>
      )}
      {action === undefined ? null : action}
    </Stack>
  )
}
