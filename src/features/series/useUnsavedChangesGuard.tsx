// Protection des changements non enregistrés (spec 0005, AC-12, « Changements non enregistrés »).
import { Button, Group, Modal, Text } from '@mantine/core'
import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useBlocker } from 'react-router'
import { LOGIN_PATH } from '@/shared/session/RequireSession'

export interface UnsavedChangesGuard {
  /** À appeler juste avant une navigation voulue (succès, série disparue) : elle n'est pas bloquée. */
  readonly allowLeave: () => void
  /** La fenêtre « Quitter sans enregistrer ? », à rendre dans la page. */
  readonly modal: ReactNode
}

export function useUnsavedChangesGuard(active: boolean): UnsavedChangesGuard {
  const allowed = useRef(false)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      active &&
      !allowed.current &&
      // Une fin de session redirige toujours, sans question (spec 0004).
      nextLocation.pathname !== LOGIN_PATH &&
      (nextLocation.pathname !== currentLocation.pathname ||
        nextLocation.search !== currentLocation.search),
  )

  useEffect(() => {
    if (!active) return undefined
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (allowed.current) return
      event.preventDefault()
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [active])

  const allowLeave = useCallback(() => {
    allowed.current = true
  }, [])

  const blocked = blocker.state === 'blocked'
  const modal = (
    <Modal
      opened={blocked}
      onClose={() => {
        if (blocker.state === 'blocked') blocker.reset()
      }}
      title="Quitter sans enregistrer ?"
      centered
    >
      <Text size="sm">Vos changements seront perdus.</Text>
      <Group justify="flex-end" mt="lg">
        <Button
          variant="default"
          data-autofocus
          onClick={() => {
            if (blocker.state === 'blocked') blocker.reset()
          }}
        >
          Rester
        </Button>
        <Button
          color="noliRed.8"
          onClick={() => {
            if (blocker.state === 'blocked') blocker.proceed()
          }}
        >
          Quitter
        </Button>
      </Group>
    </Modal>
  )

  return { allowLeave, modal }
}
