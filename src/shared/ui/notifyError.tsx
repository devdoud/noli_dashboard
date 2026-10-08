/**
 * Notification d'erreur pour une action (spec 0002, AC-13).
 * Silencieuse pour un abandon et pour une fin de session : l'écran de connexion affiche déjà le message.
 */
import { Stack, Text } from '@mantine/core'
import { notifications } from '@mantine/notifications'
import { isAbortError, isApiError } from '@/shared/api/errors'
import { toUserMessage, type MessageOverrides } from '@/shared/api/messages'
import { ErrorDetails } from '@/shared/ui/ErrorDetails'

export function notifyError(error: unknown, overrides?: MessageOverrides): void {
  if (isAbortError(error)) return
  if (isApiError(error) && error.kind === 'session-ended') return
  const { message, details } = toUserMessage(error, overrides)
  notifications.show({
    color: 'red',
    title: 'Erreur',
    autoClose: 8_000,
    message:
      details === undefined ? (
        message
      ) : (
        <Stack gap={4}>
          <Text size="sm">{message}</Text>
          <ErrorDetails details={details} />
        </Stack>
      ),
  })
}
