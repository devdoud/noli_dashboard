/** Erreur affichée dans la page, avec « Réessayer » (spec 0002, AC-13). */
import { Alert, Button, Group, Stack, Text } from '@mantine/core'
import { toUserMessage, type MessageOverrides } from '@/shared/api/messages'
import { ErrorDetails } from '@/shared/ui/ErrorDetails'

interface ErrorStateProps {
  readonly error: unknown
  readonly onRetry?: () => void
  readonly overrides?: MessageOverrides
}

export function ErrorState({ error, onRetry, overrides }: ErrorStateProps) {
  const { message, details } = toUserMessage(error, overrides)
  return (
    <Alert color="red" title="Erreur" variant="light">
      <Stack gap="sm">
        <Text size="sm">{message}</Text>
        {details === undefined ? null : <ErrorDetails details={details} />}
        {onRetry === undefined ? null : (
          <Group>
            <Button variant="light" color="red" size="xs" onClick={onRetry}>
              Réessayer
            </Button>
          </Group>
        )}
      </Stack>
    </Alert>
  )
}
