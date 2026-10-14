// Suppression d'une série, en retapant son titre (spec 0005, AC-13, « Suppression »).
import { Alert, Button, Group, List, Modal, Stack, Text, TextInput } from '@mantine/core'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { deleteSeries } from '@/features/series/api'
import { titleMatches } from '@/features/series/navigation'
import { isApiError } from '@/shared/api/errors'
import { toUserMessage } from '@/shared/api/messages'

export const PARTIAL_DELETE_MESSAGE =
  "La suppression n'a pas abouti. Réessayez : ce qui a déjà été effacé ne sera pas recréé."

export type DeleteOutcome = 'deleted' | 'already-deleted'

interface DeleteSeriesModalProps {
  readonly opened: boolean
  readonly onClose: () => void
  readonly seriesId: string
  readonly title: string
  readonly totalEpisodes: number
  readonly onDeleted: (outcome: DeleteOutcome) => void
}

function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.kind === 'http' && error.status === 404
}

function deleteErrorMessage(error: unknown): string {
  if (isApiError(error) && error.kind === 'http' && (error.status ?? 0) >= 500) {
    return PARTIAL_DELETE_MESSAGE
  }
  return toUserMessage(error).message
}

export function DeleteSeriesModal({
  opened,
  onClose,
  seriesId,
  title,
  totalEpisodes,
  onDeleted,
}: DeleteSeriesModalProps) {
  const [typed, setTyped] = useState('')
  const mutation = useMutation({
    mutationFn: () => deleteSeries(seriesId),
    onSuccess: () => {
      onDeleted('deleted')
    },
    onError: (error) => {
      if (isNotFound(error)) onDeleted('already-deleted')
    },
  })
  const pending = mutation.isPending
  const confirmed = titleMatches(typed, title)
  const shownError = mutation.isError && !isNotFound(mutation.error) ? mutation.error : undefined

  const close = () => {
    if (pending) return
    setTyped('')
    mutation.reset()
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={close}
      title={`Supprimer « ${title} » ?`}
      centered
      closeOnClickOutside={!pending}
      closeOnEscape={!pending}
      withCloseButton={!pending}
    >
      <Stack gap="md">
        <Text size="sm">Cette action est définitive. Seront effacés :</Text>
        <List size="sm" spacing={4}>
          <List.Item>{`ses ${String(totalEpisodes)} épisodes et leurs vidéos`}</List.Item>
          <List.Item>sa couverture et sa bannière</List.Item>
          <List.Item>{"l'historique de visionnage des spectateurs pour cette série"}</List.Item>
        </List>
        <Text size="sm" fw={700}>
          {title}
        </Text>
        <TextInput
          label="Tapez le titre de la série pour confirmer"
          value={typed}
          disabled={pending}
          autoComplete="off"
          onChange={(event) => {
            setTyped(event.currentTarget.value)
          }}
        />
        {shownError === undefined ? null : (
          <Alert color="noliRed" role="alert">
            {deleteErrorMessage(shownError)}
          </Alert>
        )}
        <Group justify="flex-end">
          <Button variant="default" data-autofocus onClick={close} disabled={pending}>
            Annuler
          </Button>
          <Button
            color="noliRed.8"
            disabled={!confirmed}
            loading={pending}
            aria-label={pending ? 'Suppression en cours' : undefined}
            onClick={() => {
              if (!pending && confirmed) mutation.mutate()
            }}
          >
            Supprimer définitivement
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
