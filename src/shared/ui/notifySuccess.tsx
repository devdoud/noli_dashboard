/** Notification de succès courte, avec icône de coche (spec 0003, AC-10). */
import { notifications } from '@mantine/notifications'
import { IconCheck } from '@tabler/icons-react'

export const SUCCESS_AUTO_CLOSE_MS = 4_000

export function notifySuccess(message: string): void {
  notifications.show({
    color: 'green',
    icon: <IconCheck size={18} aria-hidden="true" />,
    message,
    autoClose: SUCCESS_AUTO_CLOSE_MS,
  })
}
