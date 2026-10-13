import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import '@/shared/ui/global.css'

import { localStorageColorSchemeManager, MantineProvider } from '@mantine/core'
import { ModalsProvider } from '@mantine/modals'
import { Notifications } from '@mantine/notifications'
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { SlowServerNotice } from '@/shared/ui/SlowServerNotice'
import { COLOR_SCHEME_STORAGE_KEY, cssVariablesResolver, theme } from '@/shared/ui/theme'

const colorSchemeManager = localStorageColorSchemeManager({ key: COLOR_SCHEME_STORAGE_KEY })

/** Thème, mode de couleurs, boîtes de dialogue et notifications : suffisent pour l'écran de configuration invalide. */
export function ThemeProviders({ children }: { readonly children: ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      cssVariablesResolver={cssVariablesResolver}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme="auto"
    >
      <ModalsProvider>
        <Notifications position="bottom-right" />
        {children}
      </ModalsProvider>
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
