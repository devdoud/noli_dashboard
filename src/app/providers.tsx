import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'

import { MantineProvider } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SlowServerNotice } from '@/shared/ui/SlowServerNotice'

/** Thème Mantine et notifications : suffisent pour l'écran de configuration invalide. */
export function ThemeProviders({ children }: { readonly children: ReactNode }) {
  return (
    <MantineProvider>
      <Notifications position="top-right" />
      {children}
    </MantineProvider>
  )
}

interface AppProvidersProps {
  readonly queryClient: QueryClient
  readonly children: ReactNode
}

export function AppProviders({ queryClient, children }: AppProvidersProps) {
  return (
    <ThemeProviders>
      <QueryClientProvider client={queryClient}>
        <SlowServerNotice />
        {children}
      </QueryClientProvider>
    </ThemeProviders>
  )
}
