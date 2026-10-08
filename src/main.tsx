import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/app/App'
import { ThemeProviders } from '@/app/providers'
import { envResult } from '@/shared/config/env'
import { createQueryClient } from '@/shared/query/queryClient'
import { registerQueryClient, restoreSession } from '@/shared/session/session'
import { ConfigErrorScreen } from '@/shared/ui/ConfigErrorScreen'

const rootElement = document.getElementById('root')
if (!rootElement) {
  throw new Error('Élément #root introuvable dans index.html')
}
const root = createRoot(rootElement)

if (envResult.ok) {
  const queryClient = createQueryClient()
  registerQueryClient(queryClient)
  // Une seule fois, hors de React (pas de double appel en StrictMode).
  void restoreSession()
  root.render(
    <StrictMode>
      <App queryClient={queryClient} />
    </StrictMode>,
  )
} else {
  root.render(
    <StrictMode>
      <ThemeProviders>
        <ConfigErrorScreen variable={envResult.variable} reason={envResult.reason} />
      </ThemeProviders>
    </StrictMode>,
  )
}
