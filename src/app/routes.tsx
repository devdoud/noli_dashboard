import type { RouteObject } from 'react-router'
import { HomePage } from '@/app/HomePage'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <HomePage />,
  },
]
