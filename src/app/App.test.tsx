import { screen } from '@testing-library/react'
import { routes } from '@/app/routes'
import { renderRoutes } from '@/test/render'

describe('coquille de l’application', () => {
  it('affiche la page d’accueil provisoire', () => {
    renderRoutes(routes)

    expect(screen.getByRole('heading', { name: 'Noli Admin' })).toBeInTheDocument()
  })
})
