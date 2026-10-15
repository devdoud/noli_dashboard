import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notifications } from '@mantine/notifications'
import { http, HttpResponse } from 'msw'
import { routes } from '@/app/routes'
import { CATEGORY_MESSAGES } from '@/features/categories/categoryRules'
import { readImageDimensions } from '@/shared/images/imageDimensions'
import { resetSessionForTests } from '@/shared/session/session'
import { API } from '@/test/apiBase'
import { categoriesBackend, makeCategory, type RawCategory } from '@/test/categoriesApi'
import { renderRoutes } from '@/test/render'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

vi.mock('@/shared/images/imageDimensions', () => ({ readImageDimensions: vi.fn() }))

const dimensions = vi.mocked(readImageDimensions)

const DEFAULT: readonly RawCategory[] = [
  makeCategory(0, 'Drame', { description: 'Des larmes.' }),
  makeCategory(1, 'Comédie'),
  makeCategory(2, 'Bientôt', { isVisible: false }),
]

async function openPage(categories: readonly RawCategory[] = DEFAULT, inUse = {}) {
  const backend = categoriesBackend(categories, inUse)
  server.use(...backend.handlers)
  const rendered = renderRoutes(routes, '/categories')
  await screen.findByRole('heading', { level: 1, name: 'Catégories' })
  if (categories.length > 0) await screen.findByRole('table')
  return { backend, ...rendered }
}

function rowNames(): string[] {
  return within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[2]?.querySelector('p')?.textContent ?? '')
}

beforeEach(() => {
  signInForTests()
  dimensions.mockResolvedValue({ width: 800, height: 800 })
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:apercu'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
})

afterEach(() => {
  act(() => {
    notifications.clean()
    notifications.cleanQueue()
  })
  resetSessionForTests()
})

describe('liste des catégories (AC-1, AC-12)', { timeout: 45_000 }, () => {
  it('montre le menu, le nombre et le tableau dans l’ordre d’affichage', async () => {
    await openPage([
      makeCategory(0, 'Thriller', { displayOrder: 2 }),
      makeCategory(1, 'Drame', { displayOrder: 0, description: 'Des larmes.' }),
      makeCategory(2, 'Bientôt', { displayOrder: 1, isVisible: false }),
    ])

    expect(screen.getByRole('link', { name: 'Catégories' })).toBeInTheDocument()
    expect(screen.getByText('3 catégories')).toBeInTheDocument()
    expect(rowNames()).toEqual(['Drame', 'Bientôt', 'Thriller'])
    expect(screen.getByText('Masquée')).toBeInTheDocument()
    expect(screen.getByText('Des larmes.')).toBeInTheDocument()
    expect(screen.getByText('/drame')).toBeInTheDocument()
    expect(
      screen.getByRole('table', { name: "Catégories dans l'ordre d'affichage" }),
    ).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Visible : Drame' })).toBeChecked()
    expect(screen.getByRole('button', { name: 'Modifier « Drame »' })).toBeInTheDocument()
    expect(document.title).toContain('Catégories')
  })

  it('montre l’état vide', async () => {
    await openPage([])

    expect(await screen.findByText('Aucune catégorie pour le moment')).toBeInTheDocument()
    expect(screen.getByText('0 catégorie')).toBeInTheDocument()
  })

  it('montre l’erreur avec « Réessayer »', async () => {
    server.use(
      http.get(`${API}/categories/all`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )
    renderRoutes(routes, '/categories')

    expect(await screen.findByRole('button', { name: 'Réessayer' })).toBeInTheDocument()
  })
})

describe('création (AC-2, AC-3)', { timeout: 45_000 }, () => {
  it('crée une catégorie avec l’aperçu de l’adresse et l’ajoute en fin de tableau', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Nouvelle catégorie' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nouvelle catégorie' })

    await user.type(within(dialog).getByRole('textbox', { name: /^Nom/ }), '  Comédie romantique ')
    expect(within(dialog).getByText('Adresse : /comedie-romantique')).toBeInTheDocument()
    await user.click(within(dialog).getByRole('button', { name: 'Créer la catégorie' }))

    expect(await screen.findByText('Catégorie créée.')).toBeInTheDocument()
    expect(backend.callsTo('POST', '/categories').map((call) => call.body)).toEqual([
      { name: 'Comédie romantique', isVisible: true },
    ])
    await waitFor(() => {
      expect(rowNames().at(-1)).toBe('Comédie romantique')
    })
  })

  it.each([
    ['   ', CATEGORY_MESSAGES.nameRequired],
    ['!!!', CATEGORY_MESSAGES.nameNoAlnum],
    ['All', CATEGORY_MESSAGES.nameReserved],
    ['comedie', 'Trop proche de la catégorie « Comédie ».'],
  ])('refuse « %s » sans appel', async (name, message) => {
    const user = userEvent.setup()
    const { backend } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Nouvelle catégorie' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nouvelle catégorie' })

    await user.type(within(dialog).getByRole('textbox', { name: /^Nom/ }), name)
    await user.click(within(dialog).getByRole('button', { name: 'Créer la catégorie' }))

    expect(await within(dialog).findByText(message)).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /^Nom/ })).toHaveFocus()
    expect(backend.calls).toEqual([])
  })

  it('affiche le 409 du backend sous le nom', async () => {
    const user = userEvent.setup()
    await openPage()
    server.use(
      http.post(`${API}/categories`, () =>
        HttpResponse.json({ message: 'A category with this name already exists' }, { status: 409 }),
      ),
    )
    await user.click(screen.getByRole('button', { name: 'Nouvelle catégorie' }))
    const dialog = await screen.findByRole('dialog', { name: 'Nouvelle catégorie' })

    await user.type(within(dialog).getByRole('textbox', { name: /^Nom/ }), 'Polar')
    await user.click(within(dialog).getByRole('button', { name: 'Créer la catégorie' }))

    expect(await within(dialog).findByText(CATEGORY_MESSAGES.nameTaken)).toBeInTheDocument()
  })
})

describe('modification et adresse (AC-4, AC-5)', { timeout: 45_000 }, () => {
  it('n’envoie que les champs changés, description vidée à null', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Modifier « Drame »' }))
    const dialog = await screen.findByRole('dialog', { name: 'Modifier « Drame »' })
    const save = within(dialog).getByRole('button', { name: 'Enregistrer' })
    expect(save).toBeDisabled()
    expect(within(dialog).getByText("Renommer ne change pas l'adresse.")).toBeInTheDocument()

    await user.clear(within(dialog).getByRole('textbox', { name: /^Nom/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Nom/ }), 'Drames')
    await user.clear(within(dialog).getByRole('textbox', { name: 'Description' }))
    await user.click(save)

    expect(await screen.findByText('Catégorie modifiée.')).toBeInTheDocument()
    expect(backend.callsTo('PATCH', '/categories/cat0').map((call) => call.body)).toEqual([
      { name: 'Drames', description: null },
    ])
  })

  it('permet de changer seulement la casse du nom', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Modifier « Drame »' }))
    const dialog = await screen.findByRole('dialog', { name: 'Modifier « Drame »' })

    await user.clear(within(dialog).getByRole('textbox', { name: /^Nom/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Nom/ }), 'DRAME')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Catégorie modifiée.')).toBeInTheDocument()
    expect(backend.callsTo('PATCH', '/categories/cat0').map((call) => call.body)).toEqual([
      { name: 'DRAME' },
    ])
  })

  it('contrôle et envoie une nouvelle adresse', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Modifier « Drame »' }))
    const dialog = await screen.findByRole('dialog', { name: 'Modifier « Drame »' })
    expect(within(dialog).getByText('Adresse : /drame')).toBeInTheDocument()

    await user.click(within(dialog).getByRole('button', { name: "Modifier l'adresse" }))
    const slug = within(dialog).getByRole('textbox', { name: /^Adresse/ })
    expect(
      within(dialog).getByText('Les liens déjà partagés vers cette catégorie ne marcheront plus.'),
    ).toBeInTheDocument()
    await user.clear(slug)
    await user.type(slug, 'comedie')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))
    expect(
      await within(dialog).findByText('Adresse déjà utilisée par « Comédie ».'),
    ).toBeInTheDocument()
    expect(backend.calls).toEqual([])

    await user.clear(slug)
    await user.type(slug, 'drame-intense')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText('Catégorie modifiée.')).toBeInTheDocument()
    expect(backend.callsTo('PATCH', '/categories/cat0').map((call) => call.body)).toEqual([
      { slug: 'drame-intense' },
    ])
  })

  it('« Annuler » referme le champ d’adresse sans rien envoyer', async () => {
    const user = userEvent.setup()
    await openPage()
    await user.click(screen.getByRole('button', { name: 'Modifier « Drame »' }))
    const dialog = await screen.findByRole('dialog', { name: 'Modifier « Drame »' })

    await user.click(within(dialog).getByRole('button', { name: "Modifier l'adresse" }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Adresse/ }), 'x')
    await user.click(
      within(dialog).getByRole('button', { name: "Annuler la modification de l'adresse" }),
    )

    expect(within(dialog).getByText('Adresse : /drame')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: 'Enregistrer' })).toBeDisabled()
  })

  it('demande avant de fermer une fenêtre modifiée (AC-11)', async () => {
    const user = userEvent.setup()
    await openPage()
    await user.click(screen.getByRole('button', { name: 'Modifier « Drame »' }))
    const dialog = await screen.findByRole('dialog', { name: 'Modifier « Drame »' })
    await user.type(within(dialog).getByRole('textbox', { name: /^Nom/ }), 's')

    await user.keyboard('{Escape}')

    expect(
      await screen.findByRole('dialog', { name: 'Abandonner les changements ?' }),
    ).toBeInTheDocument()
  })
})

describe('visibilité (AC-6)', { timeout: 45_000 }, () => {
  it('masque après confirmation, réaffiche sans question', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()

    await user.click(screen.getByRole('switch', { name: 'Visible : Drame' }))
    const confirm = await screen.findByRole('dialog', { name: 'Masquer « Drame » ?' })
    expect(
      within(confirm).getByText(
        "La catégorie disparaîtra de l'app et de l'étiquette de ses séries. Ses séries restent visibles.",
      ),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Masquer' }))

    expect(await screen.findByText('Catégorie masquée.')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Visible : Drame' })).not.toBeChecked()

    await user.click(screen.getByRole('switch', { name: 'Visible : Bientôt' }))
    expect(await screen.findByText('Catégorie affichée.')).toBeInTheDocument()
    expect(backend.callsTo('PATCH', /\/categories\/cat\d$/).map((call) => call.body)).toEqual([
      { isVisible: false },
      { isVisible: true },
    ])
  })

  it('laisse l’interrupteur en place si l’écriture échoue', async () => {
    const user = userEvent.setup()
    await openPage()
    server.use(
      http.patch(`${API}/categories/:id`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 }),
      ),
    )

    await user.click(screen.getByRole('switch', { name: 'Visible : Bientôt' }))

    await waitFor(() => {
      expect(screen.getByRole('switch', { name: 'Visible : Bientôt' })).not.toBeDisabled()
    })
    expect(screen.getByRole('switch', { name: 'Visible : Bientôt' })).not.toBeChecked()
  })
})

describe('ordre (AC-7, AC-12)', { timeout: 45_000 }, () => {
  it('déplace, bloque les autres actions, annonce, puis enregistre tout l’ordre', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()
    expect(screen.getByRole('button', { name: 'Monter « Drame »' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Descendre « Bientôt »' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Descendre « Drame »' }))

    expect(rowNames()).toEqual(['Comédie', 'Drame', 'Bientôt'])
    expect(screen.getByRole('button', { name: 'Descendre « Drame »' })).toHaveFocus()
    expect(screen.getByText('« Drame » est maintenant en position 2 sur 3.')).toBeInTheDocument()
    expect(screen.getByText(CATEGORY_MESSAGES.blockedByOrder)).toBeInTheDocument()
    const edit = screen.getByRole('button', { name: 'Modifier « Comédie »' })
    expect(edit).toHaveAttribute('aria-disabled', 'true')
    await user.click(edit)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: "Enregistrer l'ordre" }))

    expect(await screen.findByText('Ordre enregistré.')).toBeInTheDocument()
    expect(backend.callsTo('PUT', '/categories/order').map((call) => call.body)).toEqual([
      { ids: ['cat1', 'cat0', 'cat2'] },
    ])
    expect(screen.queryByText(CATEGORY_MESSAGES.blockedByOrder)).not.toBeInTheDocument()
  })

  it('« Annuler » revient à l’ordre enregistré sans appel', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()

    await user.click(screen.getByRole('button', { name: 'Descendre « Drame »' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(rowNames()).toEqual(['Drame', 'Comédie', 'Bientôt'])
    expect(backend.calls).toEqual([])
  })

  it('revient à l’ordre du serveur sans bandeau quand on défait le déplacement', async () => {
    const user = userEvent.setup()
    await openPage()

    await user.click(screen.getByRole('button', { name: 'Descendre « Drame »' }))
    await user.click(screen.getByRole('button', { name: 'Monter « Drame »' }))

    expect(screen.queryByText(CATEGORY_MESSAGES.blockedByOrder)).not.toBeInTheDocument()
  })

  it('recharge la liste quand l’ordre est refusé (400)', async () => {
    const user = userEvent.setup()
    await openPage()
    server.use(
      http.put(`${API}/categories/order`, () =>
        HttpResponse.json({ message: 'ids must list every category' }, { status: 400 }),
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Descendre « Drame »' }))
    await user.click(screen.getByRole('button', { name: "Enregistrer l'ordre" }))

    expect(await screen.findByText(CATEGORY_MESSAGES.orderChanged)).toBeInTheDocument()
    expect(rowNames()).toEqual(['Drame', 'Comédie', 'Bientôt'])
  })

  it('protège la page pendant un ordre en cours (AC-11)', async () => {
    const user = userEvent.setup()
    const { router } = await openPage()

    await user.click(screen.getByRole('button', { name: 'Descendre « Drame »' }))
    act(() => {
      void router.navigate('/series')
    })

    expect(
      await screen.findByRole('dialog', { name: 'Quitter sans enregistrer ?' }),
    ).toBeInTheDocument()
  })
})

describe('suppression (AC-8)', { timeout: 45_000 }, () => {
  it('supprime une catégorie inutilisée après confirmation', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()

    await user.click(screen.getByRole('button', { name: 'Supprimer « Comédie »' }))
    const confirm = await screen.findByRole('dialog', { name: 'Supprimer « Comédie » ?' })
    expect(
      within(confirm).getByText('La catégorie et son image seront supprimées définitivement.'),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('Catégorie supprimée.')).toBeInTheDocument()
    expect(backend.callsTo('DELETE', '/categories/cat1')).toHaveLength(1)
    await waitFor(() => {
      expect(rowNames()).toEqual(['Drame', 'Bientôt'])
    })
  })

  it('explique un refus et propose de masquer plutôt', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage(DEFAULT, { cat0: 3 })

    await user.click(screen.getByRole('button', { name: 'Supprimer « Drame »' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Supprimer « Drame » ?' })).getByRole(
        'button',
        { name: 'Supprimer' },
      ),
    )
    const refused = await screen.findByRole('dialog', { name: 'Suppression impossible' })
    expect(
      within(refused).getByText(
        '« Drame » est encore utilisée par 3 séries. Retirez la de ces séries, ou masquez la.',
      ),
    ).toBeInTheDocument()
    await user.click(within(refused).getByRole('button', { name: 'Masquer plutôt' }))

    expect(await screen.findByText('Catégorie masquée.')).toBeInTheDocument()
    expect(backend.callsTo('PATCH', '/categories/cat0').map((call) => call.body)).toEqual([
      { isVisible: false },
    ])
    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: 'Suppression impossible' }),
      ).not.toBeInTheDocument()
    })
  })

  it('annonce une catégorie déjà supprimée (404)', async () => {
    const user = userEvent.setup()
    await openPage()
    server.use(
      http.delete(`${API}/categories/:id`, () =>
        HttpResponse.json({ message: 'Category not found' }, { status: 404 }),
      ),
    )

    await user.click(screen.getByRole('button', { name: 'Supprimer « Comédie »' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: 'Supprimer « Comédie » ?' })).getByRole(
        'button',
        { name: 'Supprimer' },
      ),
    )

    expect(await screen.findByText('Cette catégorie avait déjà été supprimée.')).toBeInTheDocument()
  })
})

describe('image (AC-9)', { timeout: 45_000 }, () => {
  it('envoie l’image depuis la fenêtre et montre la miniature', async () => {
    const user = userEvent.setup()
    const { backend } = await openPage()
    await user.click(screen.getByRole('button', { name: 'Modifier « Drame »' }))
    const dialog = await screen.findByRole('dialog', { name: 'Modifier « Drame »' })
    const slot = within(dialog).getByRole('group', { name: 'Image' })
    const input = slot.querySelector<HTMLInputElement>('input[type="file"]')
    if (input === null) throw new Error('Champ fichier introuvable')

    await user.upload(input, new File([new Uint8Array(512)], 'carre.png', { type: 'image/png' }))
    await user.click(
      await within(slot).findByRole('button', { name: "Envoyer l'image de « Drame »" }),
    )

    expect(await screen.findByText('Image mise à jour.')).toBeInTheDocument()
    expect(backend.callsTo('PUT', '/categories/cat0/image')).toHaveLength(1)
    const row = screen.getByRole('button', { name: 'Modifier « Drame »' }).closest('tr')
    expect(row?.querySelector('img[alt=""]')).toHaveAttribute(
      'src',
      expect.stringContaining('res.cloudinary.com'),
    )
  })
})
