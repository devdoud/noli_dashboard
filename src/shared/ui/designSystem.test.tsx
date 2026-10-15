import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import colorSchemeScript from '../../../public/color-scheme.js?raw'
import { routes } from '@/app/routes'
import { ApiError } from '@/shared/api/errors'
import { resetSessionForTests } from '@/shared/session/session'
import { getSessionState, setSessionState } from '@/shared/session/store'
import { confirmDanger } from '@/shared/ui/confirmDanger'
import { ColorSchemeToggle } from '@/shared/ui/ColorSchemeToggle'
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable'
import { EmptyState } from '@/shared/ui/EmptyState'
import { navItems, visibleNavItems } from '@/shared/ui/navItems'
import { notifySuccess } from '@/shared/ui/notifySuccess'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableSkeleton } from '@/shared/ui/TableSkeleton'
import { COLOR_SCHEME_STORAGE_KEY } from '@/shared/ui/theme'
import { renderRoutes, renderWithProviders } from '@/test/render'
import { signInForTests } from '@/test/session'

interface Row {
  readonly id: string
  readonly title: string
}

const COLUMNS: readonly DataTableColumn<Row>[] = [
  { key: 'title', header: 'Titre', render: (row) => row.title },
]

const ROWS: readonly Row[] = Array.from({ length: 20 }, (_, index) => ({
  id: String(index),
  title: `Série ${String(index + 1)}`,
}))

function renderTable(props: Partial<Parameters<typeof DataTable<Row>>[0]> = {}) {
  const onPageChange = vi.fn()
  const onRetry = vi.fn()
  renderWithProviders(
    <DataTable<Row>
      caption="Séries"
      columns={COLUMNS}
      rows={ROWS}
      getRowKey={(row) => row.id}
      total={134}
      page={1}
      pageSize={20}
      onPageChange={onPageChange}
      onRetry={onRetry}
      empty={{ title: 'Aucune série' }}
      {...props}
    />,
  )
  return { onPageChange, onRetry }
}

afterEach(() => {
  act(() => {
    modals.closeAll()
    notifications.clean()
    notifications.cleanQueue()
  })
  window.localStorage.clear()
  resetSessionForTests()
})

// Délai plus long : le premier rendu de Mantine dans jsdom peut dépasser 5 s sous forte charge.
describe('DataTable (AC-8)', { timeout: 15_000 }, () => {
  it('affiche les lignes, la légende et le résumé', () => {
    renderTable()

    expect(screen.getByRole('table', { name: 'Séries' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Série 1' })).toBeInTheDocument()
    expect(screen.getByText('1 à 20 sur 134')).toBeInTheDocument()
  })

  it('change de page avec « Page suivante »', async () => {
    const { onPageChange } = renderTable()

    await userEvent.click(screen.getByRole('button', { name: 'Page suivante' }))

    expect(onPageChange).toHaveBeenCalledWith(2)
  })

  it('montre des squelettes au premier chargement', () => {
    renderTable({ rows: undefined, isLoading: true })

    expect(screen.getByRole('status')).toHaveTextContent('Chargement…')
    expect(screen.queryByRole('cell', { name: 'Série 1' })).not.toBeInTheDocument()
  })

  it('garde les lignes grisées pendant un rechargement', () => {
    renderTable({ isLoading: true })

    expect(screen.getByRole('table')).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('cell', { name: 'Série 1' })).toBeInTheDocument()
  })

  it('montre l’état vide sans pagination', () => {
    renderTable({ rows: [], total: 0 })

    expect(screen.getByRole('heading', { name: 'Aucune série' })).toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })

  it('donne la priorité à l’erreur et relance avec Réessayer', async () => {
    const { onRetry } = renderTable({ error: new ApiError({ kind: 'network' }), isLoading: true })

    await userEvent.click(screen.getByRole('button', { name: 'Réessayer' }))

    expect(onRetry).toHaveBeenCalledOnce()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('ramène une page trop grande à la dernière page', () => {
    const { onPageChange } = renderTable({ page: 9 })

    expect(onPageChange).toHaveBeenCalledWith(7)
  })

  it('masque la pagination quand tout tient sur une page', () => {
    renderTable({ rows: ROWS.slice(0, 5), total: 5 })

    expect(screen.queryByRole('navigation', { name: 'Pagination' })).not.toBeInTheDocument()
  })
})

describe('confirmDanger (AC-9)', () => {
  it('met le focus sur Annuler et renvoie true sur Supprimer', async () => {
    renderWithProviders(<p>page</p>)

    const answer = confirmDanger({ title: 'Supprimer « Pilote » ?', message: 'Action définitive.' })
    const dialog = await screen.findByRole('dialog', { name: 'Supprimer « Pilote » ?' })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Annuler' })).toHaveFocus()
    })
    expect(dialog).toHaveTextContent('Action définitive.')

    await userEvent.click(screen.getByRole('button', { name: 'Supprimer' }))

    await expect(answer).resolves.toBe(true)
  })

  it('renvoie false avec Échap', async () => {
    renderWithProviders(<p>page</p>)

    const answer = confirmDanger({ title: 'Supprimer ?', message: 'Définitif.' })
    await screen.findByRole('dialog')
    await userEvent.keyboard('{Escape}')

    await expect(answer).resolves.toBe(false)
  })

  it('renvoie false avec Annuler', async () => {
    renderWithProviders(<p>page</p>)

    const answer = confirmDanger({ title: 'Supprimer ?', message: 'Définitif.' })
    await userEvent.click(await screen.findByRole('button', { name: 'Annuler' }))

    await expect(answer).resolves.toBe(false)
  })
})

describe('notifySuccess (AC-10)', () => {
  it('affiche un message court avec une icône', () => {
    const show = vi.spyOn(notifications, 'show')

    notifySuccess('Série enregistrée.')

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'green', message: 'Série enregistrée.', autoClose: 4000 }),
    )
    vi.restoreAllMocks()
  })
})

describe('AppLayout (AC-5, AC-6, AC-7)', () => {
  // Les pages sous AppLayout exigent une session depuis la spec 0004 (AC-5).
  beforeEach(() => {
    signInForTests()
  })

  it('ne montre que les entrées prêtes et marque la page courante', async () => {
    renderRoutes(routes)

    const nav = await screen.findByRole('navigation', { name: 'Menu principal' })
    const links = nav.querySelectorAll('a')
    expect([...links].map((link) => link.textContent)).toEqual([
      "Vue d'ensemble",
      'Séries',
      'Catégories',
    ])
    expect(screen.getByRole('link', { name: "Vue d'ensemble" })).toHaveAttribute(
      'aria-current',
      'page',
    )
  })

  it('n’affiche rien de la session tant qu’elle n’est pas ouverte', async () => {
    setSessionState({ status: 'restoring' })
    renderRoutes(routes)

    expect(await screen.findByRole('status')).toHaveTextContent('Chargement…')
    expect(getSessionState().status).toBe('restoring')
    expect(screen.queryByRole('navigation', { name: 'Menu principal' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Se déconnecter' })).not.toBeInTheDocument()
  })

  it('montre l’admin connecté et le déconnecte', async () => {
    renderRoutes(routes)

    expect(await screen.findByText('admin@noli.test')).toBeInTheDocument()
    // Deux boutons existent (texte sur ordinateur, icône sur téléphone) ; jsdom ne masque pas par CSS.
    const [logoutButton] = screen.getAllByRole('button', { name: 'Se déconnecter' })
    if (logoutButton === undefined) throw new Error('Bouton « Se déconnecter » introuvable')
    await userEvent.click(logoutButton)

    expect(getSessionState()).toEqual({ status: 'anonymous', endReason: 'logout' })
    expect(screen.queryByText('admin@noli.test')).not.toBeInTheDocument()
  })

  it('ouvre le menu avec ☰ et le ferme avec Échap en rendant le focus', async () => {
    renderRoutes(routes)
    const burger = await screen.findByRole('button', { name: 'Ouvrir le menu' })
    expect(burger).toHaveAttribute('aria-controls', 'menu-principal')

    await userEvent.click(burger)
    expect(screen.getByRole('button', { name: 'Fermer le menu' })).toHaveAttribute(
      'aria-expanded',
      'true',
    )

    await userEvent.keyboard('{Escape}')
    const closed = screen.getByRole('button', { name: 'Ouvrir le menu' })
    expect(closed).toHaveAttribute('aria-expanded', 'false')
    expect(closed).toHaveFocus()
  })

  it('le premier Tab atteint « Aller au contenu », qui vise le contenu principal', async () => {
    renderRoutes(routes)
    await screen.findByRole('main')

    await userEvent.tab()

    const skip = screen.getByRole('link', { name: 'Aller au contenu' })
    expect(skip).toHaveFocus()
    expect(skip).toHaveAttribute('href', '#contenu')
    expect(screen.getByRole('main')).toHaveAttribute('tabindex', '-1')
  })

  it('met le titre de la page dans l’onglet', async () => {
    renderRoutes(routes)

    await screen.findByRole('heading', { level: 1, name: "Vue d'ensemble" })
    expect(document.title).toBe("Vue d'ensemble · Noli Admin")
  })
})

describe('mode de couleurs (AC-2)', () => {
  it('le bouton bascule le mode et le retient', async () => {
    renderWithProviders(<ColorSchemeToggle />)

    await userEvent.click(await screen.findByRole('button', { name: 'Passer en mode sombre' }))

    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe('dark')
    expect(await screen.findByRole('button', { name: 'Passer en mode clair' })).toBeInTheDocument()
  })

  it('le script de démarrage applique le mode enregistré ou celui du système', () => {
    const run = () => {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      const runScript = new Function(colorSchemeScript) as () => void
      runScript()
      return document.documentElement.getAttribute('data-mantine-color-scheme')
    }

    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'dark')
    expect(run()).toBe('dark')

    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'auto')
    expect(run()).toBe('light')

    window.localStorage.removeItem(COLOR_SCHEME_STORAGE_KEY)
    expect(run()).toBe('light')
  })
})

describe('PageHeader et titre de l’onglet (AC-7, AC-12)', () => {
  it('affiche un seul h1, la description et les actions', () => {
    renderWithProviders(
      <PageHeader
        title="Séries"
        description="Toutes les séries du catalogue."
        actions={<button type="button">Nouvelle série</button>}
      />,
    )

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1, name: 'Séries' })).toBeInTheDocument()
    expect(screen.getByText('Toutes les séries du catalogue.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Nouvelle série' })).toBeInTheDocument()
    expect(document.title).toBe('Séries · Noli Admin')
  })

  it('n’affiche ni description ni actions quand elles manquent', () => {
    const { container } = renderWithProviders(<PageHeader title="Outils" />)

    expect(container.querySelectorAll('p')).toHaveLength(0)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('suit un changement de titre', async () => {
    function Switcher() {
      const [title, setTitle] = useState('Avant')
      return (
        <>
          <PageHeader title={title} />
          <button
            type="button"
            onClick={() => {
              setTitle('Après')
            }}
          >
            Changer
          </button>
        </>
      )
    }
    renderWithProviders(<Switcher />)
    expect(document.title).toBe('Avant · Noli Admin')

    await userEvent.click(screen.getByRole('button', { name: 'Changer' }))

    expect(document.title).toBe('Après · Noli Admin')
  })
})

describe('EmptyState et TableSkeleton (AC-8)', () => {
  it('affiche le titre, l’explication et l’action', () => {
    renderWithProviders(
      <EmptyState
        title="Aucune catégorie"
        description="Créez la première."
        action={<button type="button">Créer</button>}
      />,
    )

    expect(screen.getByRole('heading', { name: 'Aucune catégorie' })).toBeInTheDocument()
    expect(screen.getByText('Créez la première.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Créer' })).toBeInTheDocument()
  })

  it('garde l’en tête du tableau et le nombre de lignes demandé pendant le chargement', () => {
    renderWithProviders(
      <TableSkeleton
        caption="Séries"
        rows={3}
        columns={[
          { key: 'title', header: 'Titre' },
          { key: 'episodes', header: 'Épisodes' },
        ]}
      />,
    )

    expect(screen.getByRole('table', { name: 'Séries' })).toHaveAttribute('aria-busy', 'true')
    expect(screen.getByRole('columnheader', { name: 'Titre' })).toBeInTheDocument()
    expect(screen.getAllByRole('row')).toHaveLength(4)
    expect(screen.getByRole('status')).toHaveTextContent('Chargement…')
  })
})

describe('menu (AC-6)', () => {
  it('garde l’ordre prévu et ne montre que les entrées prêtes', () => {
    expect(navItems.map((item) => item.label)).toEqual([
      "Vue d'ensemble",
      'Séries',
      'Catégories',
      'Outils',
    ])
    expect(visibleNavItems().map((item) => item.to)).toEqual(['/', '/series', '/categories'])
  })

  it('montre une entrée dès qu’elle passe à ready', () => {
    const items = navItems.map((item) => (item.to === '/outils' ? { ...item, ready: true } : item))

    expect(visibleNavItems(items).map((item) => item.label)).toEqual([
      "Vue d'ensemble",
      'Séries',
      'Catégories',
      'Outils',
    ])
  })
})

describe('vitrine (AC-13)', () => {
  it('se charge à la demande sur /dev/composants en développement', async () => {
    signInForTests()
    renderRoutes(routes, '/dev/composants')

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Composants' }, { timeout: 10_000 }),
    ).toBeInTheDocument()
    expect(screen.getByRole('table', { name: "Séries d'exemple" })).toBeInTheDocument()
  })
})

describe('confirmDanger, cas restants (AC-9)', () => {
  it('ne se résout qu’une fois, même si la fenêtre se ferme après la confirmation', async () => {
    renderWithProviders(<p>page</p>)

    const answer = confirmDanger({ title: 'Supprimer ?', message: 'Définitif.' })
    await userEvent.click(await screen.findByRole('button', { name: 'Supprimer' }))
    act(() => {
      modals.closeAll()
    })

    await expect(answer).resolves.toBe(true)
  })

  it('accepte un libellé de confirmation personnalisé', async () => {
    renderWithProviders(<p>page</p>)

    const answer = confirmDanger({
      title: 'Retirer la vidéo ?',
      message: 'La vidéo sera retirée.',
      confirmLabel: 'Retirer',
    })
    await userEvent.click(await screen.findByRole('button', { name: 'Retirer' }))

    await expect(answer).resolves.toBe(true)
  })
})

describe('script de mode de couleurs, cas limites (AC-2)', () => {
  const runScript = () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const run = new Function(colorSchemeScript) as () => void
    run()
    return document.documentElement.getAttribute('data-mantine-color-scheme')
  }

  it('suit le système en sombre quand rien n’est enregistré', () => {
    const matchMedia = vi.spyOn(window, 'matchMedia').mockImplementation(
      (query: string) =>
        ({
          matches: query === '(prefers-color-scheme: dark)',
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
          addEventListener: () => undefined,
          removeEventListener: () => undefined,
          dispatchEvent: () => false,
        }) as MediaQueryList,
    )

    expect(runScript()).toBe('dark')
    matchMedia.mockRestore()
  })

  it('ignore une valeur inconnue et suit le système', () => {
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'violet')

    expect(runScript()).toBe('light')
  })

  it('le bouton propose le mode clair quand l’app est en sombre', async () => {
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, 'dark')
    renderWithProviders(<ColorSchemeToggle />)

    expect(await screen.findByRole('button', { name: 'Passer en mode clair' })).toBeInTheDocument()
  })
})
