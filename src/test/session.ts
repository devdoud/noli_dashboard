import { setSessionState, type AdminUser } from '@/shared/session/store'

export const TEST_ADMIN: AdminUser = {
  id: 'u1',
  email: 'admin@noli.test',
  username: 'admin',
  role: 'admin',
}

// Ouvre une session d'admin sans passer par l'API, pour les pages protégées (spec 0004, AC-5).
export function signInForTests(user: AdminUser = TEST_ADMIN): void {
  setSessionState({ status: 'authenticated', user })
}
