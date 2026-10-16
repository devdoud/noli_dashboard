import { screen } from '@testing-library/react'
import { routes } from '@/app/routes'
import { resetSessionForTests } from '@/shared/session/session'
import { statsHandler } from '@/test/overviewApi'
import { renderRoutes } from '@/test/render'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

describe('coquille de l’application', () => {
  beforeEach(() => {
    signInForTests()
    server.use(statsHandler())
  })

  afterEach(() => {
    resetSessionForTests()
  })

  it('affiche la vue d’ensemble dans la mise en page (AC-5, AC-12)', async () => {
    renderRoutes(routes)

    expect(
      await screen.findByRole('heading', { level: 1, name: "Vue d'ensemble" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'Menu principal' })).toBeInTheDocument()
    expect(screen.getByRole('main')).toHaveAttribute('id', 'contenu')
  })

  it('affiche la page introuvable pour une adresse inconnue (AC-15)', async () => {
    renderRoutes(routes, '/nimporte-quoi')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Page introuvable' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: "Retour à la vue d'ensemble" })).toHaveAttribute(
      'href',
      '/',
    )
  })
})
