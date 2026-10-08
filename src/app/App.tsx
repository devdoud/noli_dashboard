import type { QueryClient } from '@tanstack/react-query'
import { createBrowserRouter, RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { routes } from '@/app/routes'

const router = createBrowserRouter(routes)

export function App({ queryClient }: { readonly queryClient: QueryClient }) {
  return (
    <AppProviders queryClient={queryClient}>
      <RouterProvider router={router} />
    </AppProviders>
  )
}
