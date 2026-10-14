/** Chargement plein écran, pendant la reprise de session (spec 0004, AC-5). */
import { Center, Loader, VisuallyHidden } from '@mantine/core'

export function FullPageLoader() {
  return (
    <Center mih="100dvh">
      <Loader aria-hidden="true" />
      <VisuallyHidden role="status">Chargement…</VisuallyHidden>
    </Center>
  )
}
