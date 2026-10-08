import { render } from '@testing-library/react'
import type { ReactNode } from 'react'
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router'
import { AppProviders } from '@/app/providers'
import { createQueryClient } from '@/shared/query/queryClient'

// Rend un élément avec les mêmes fournisseurs que l'application, et un cache neuf par test.
export function renderWithProviders(ui: ReactNode) {
  const queryClient = createQueryClient()
  return { queryClient, ...render(<AppProviders queryClient={queryClient}>{ui}</AppProviders>) }
}

// Rend des routes avec les fournisseurs de l'application, sur une URL de départ.
export function renderRoutes(routes: RouteObject[], initialPath = '/') {
  const router = createMemoryRouter(routes, { initialEntries: [initialPath] })
  return renderWithProviders(<RouterProvider router={router} />)
}
