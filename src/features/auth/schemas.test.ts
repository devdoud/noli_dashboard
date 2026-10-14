import { loginSchema } from '@/features/auth/schemas'

function issuesOf(values: unknown): Record<string, string | undefined> {
  const result = loginSchema.safeParse(values)
  if (result.success) return {}
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join('.'), issue.message]),
  )
}

describe('loginSchema (AC-2)', () => {
  it('accepte un email valide et nettoie ses espaces', () => {
    expect(loginSchema.parse({ email: '  admin@noli.test ', password: 'secret' })).toEqual({
      email: 'admin@noli.test',
      password: 'secret',
    })
  })

  it('garde le mot de passe tel quel, espaces compris', () => {
    expect(loginSchema.parse({ email: 'a@b.co', password: ' secret ' }).password).toBe(' secret ')
  })

  it.each(['', '   ', 'pas-un-email', 'admin@', '@noli.test', 'admin noli@test.fr'])(
    'refuse l’email « %s » avec un message en français',
    (email) => {
      expect(issuesOf({ email, password: 'x' }).email).toBe('Adresse email invalide.')
    },
  )

  it('refuse un mot de passe vide', () => {
    expect(issuesOf({ email: 'a@b.co', password: '' }).password).toBe('Mot de passe requis.')
  })
})
