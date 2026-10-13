import type { RouteObject } from 'react-router'
import { HomePage } from '@/app/HomePage'
import { NotFoundPage } from '@/app/NotFoundPage'
import { AppLayout } from '@/shared/ui/AppLayout'

// Vitrine des composants : chargée à la demande et retirée du build de production (spec 0003, AC-13).
const devRoutes: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: 'dev/composants',
        lazy: async () => {
          const { DevComponentsPage } = await import('@/app/dev/DevComponentsPage')
          return { Component: DevComponentsPage }
        },
      },
    ]
  : []

export const routes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      ...devRoutes,
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
