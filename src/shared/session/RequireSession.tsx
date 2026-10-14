/**
 * Garde des pages protégées (spec 0004, AC-5, AC-6), en route de mise en page.
 * Sans session : vers /connexion, avec `retour` sauf après une déconnexion volontaire.
 * Confort d'interface seulement : la vraie protection reste l'API.
 */
import { Navigate, Outlet, useLocation } from 'react-router'
import { useSession } from '@/shared/session/useSession'
import { FullPageLoader } from '@/shared/ui/FullPageLoader'

export const LOGIN_PATH = '/connexion'

export function RequireSession() {
  const { status, endReason } = useSession()
  const { pathname, search } = useLocation()

  if (status === 'restoring') return <FullPageLoader />
  if (status === 'authenticated') return <Outlet />
  if (endReason === 'logout') return <Navigate to={LOGIN_PATH} replace />
  return <Navigate to={`${LOGIN_PATH}?retour=${encodeURIComponent(pathname + search)}`} replace />
}
