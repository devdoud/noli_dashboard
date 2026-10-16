import type { RouteObject } from 'react-router'
import { NotFoundPage } from '@/app/NotFoundPage'
import { LoginPage } from '@/features/auth/LoginPage'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { OverviewPage } from '@/features/overview/OverviewPage'
import { SeriesCreatePage } from '@/features/series/SeriesCreatePage'
import { SeriesDetailPage } from '@/features/series/SeriesDetailPage'
import { SeriesListPage } from '@/features/series/SeriesListPage'
import { RequireSession } from '@/shared/session/RequireSession'
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

// /connexion est publique ; tout le reste passe par la garde de session (spec 0004, AC-5).
export const routes: RouteObject[] = [
  { path: 'connexion', element: <LoginPage /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <OverviewPage /> },
          { path: 'series', element: <SeriesListPage /> },
          { path: 'series/nouvelle', element: <SeriesCreatePage /> },
          { path: 'series/:id', element: <SeriesDetailPage /> },
          { path: 'categories', element: <CategoriesPage /> },
          ...devRoutes,
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
]
