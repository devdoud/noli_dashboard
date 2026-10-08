/** Notification « le serveur se réveille » tant qu'un appel dépasse 5 s (spec 0002, AC-9). */
import { notifications } from '@mantine/notifications'
import { useEffect } from 'react'
import { useSlowRequestCount } from '@/shared/api/slowRequests'

export const SLOW_SERVER_NOTICE_ID = 'slow-server'
export const SLOW_SERVER_MESSAGE = "Le serveur se réveille, cela peut prendre jusqu'à une minute."

export function SlowServerNotice() {
  const isSlow = useSlowRequestCount() > 0

  useEffect(() => {
    if (isSlow) {
      notifications.show({
        id: SLOW_SERVER_NOTICE_ID,
        loading: true,
        title: 'Patience',
        message: SLOW_SERVER_MESSAGE,
        autoClose: false,
        withCloseButton: false,
      })
    } else {
      notifications.hide(SLOW_SERVER_NOTICE_ID)
    }
  }, [isSlow])

  return null
}
