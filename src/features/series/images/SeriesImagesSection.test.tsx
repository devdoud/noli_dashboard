import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notifications } from '@mantine/notifications'
import { http } from 'msw'
import { routes } from '@/app/routes'
import { readImageDimensions } from '@/features/series/images/imageDimensions'
import { IMAGE_MESSAGES } from '@/features/series/images/imageRules'
import { resetSessionForTests } from '@/shared/session/session'
import {
  apiError,
  DETAIL_PATH,
  episodesBackend,
  HOSTED_IMAGE,
  makeEpisode,
  type RawEpisode,
  type SeriesImages,
} from '@/test/episodesApi'
import { renderRoutes } from '@/test/render'
import { API } from '@/test/seriesApi'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

// jsdom ne décode pas les images : les dimensions lues sont choisies par chaque test.
vi.mock('@/features/series/images/imageDimensions', () => ({
  readImageDimensions: vi.fn(),
}))

const dimensions = vi.mocked(readImageDimensions)
const revokeObjectURL = vi.fn()
const png = (name = 'image.png') => new File([new Uint8Array(2048)], name, { type: 'image/png' })

async function openDetail(images: SeriesImages = {}, episodes: readonly RawEpisode[] = []) {
  const backend = episodesBackend(episodes, images)
  server.use(...backend.handlers)
  const rendered = renderRoutes(routes, DETAIL_PATH)
  await screen.findByRole('heading', { level: 2, name: 'Images' })
  return { backend, ...rendered }
}

function slot(name: string) {
  return screen.getByRole('group', { name })
}

function fileInput(group: HTMLElement): HTMLInputElement {
  const input = group.querySelector<HTMLInputElement>('input[type="file"]')
  if (input === null) throw new Error('Champ fichier introuvable')
  return input
}

beforeEach(() => {
  signInForTests()
  dimensions.mockResolvedValue({ width: 800, height: 1200 })
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:apercu'),
  })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: revokeObjectURL })
})

afterEach(() => {
  act(() => {
    notifications.clean()
    notifications.cleanQueue()
  })
  resetSessionForTests()
})

describe('section Images (AC-1, AC-7, AC-10)', { timeout: 45_000 }, () => {
  it('montre deux emplacements nommés, vides, et le rappel des règles', async () => {
    await openDetail()

    expect(within(slot('Couverture')).getByText('Aucune couverture')).toBeInTheDocument()
    expect(within(slot('Bannière')).getByText('Aucune bannière')).toBeInTheDocument()
    expect(screen.getByText(/10 envois ou retraits d’images ou de vidéos/)).toBeInTheDocument()
    expect(
      within(slot('Couverture')).getByRole('button', { name: 'Choisir la couverture' }),
    ).toBeInTheDocument()
  })

  it('affiche l’image hébergée avec son texte alternatif, sans mention', async () => {
    await openDetail({ coverImage: HOSTED_IMAGE })

    expect(
      within(slot('Couverture')).getByRole('img', {
        name: 'Couverture de Le Secret du Docteur Mensah',
      }),
    ).toHaveAttribute('src', HOSTED_IMAGE)
    expect(within(slot('Couverture')).queryByText('Lien externe')).not.toBeInTheDocument()
  })

  it('signale un lien externe, et une image qui ne charge pas', async () => {
    await openDetail({
      coverImage: 'https://picsum.photos/400/600',
      bannerImage: 'https://mort.test/b.jpg',
    })
    const banner = slot('Bannière')

    expect(within(slot('Couverture')).getByText('Lien externe')).toBeInTheDocument()
    fireEvent.error(within(banner).getByRole('img'))

    expect(await within(banner).findByText('Image indisponible')).toBeInTheDocument()
    expect(within(banner).getByRole('button', { name: 'Retirer la bannière' })).toBeInTheDocument()
  })
})

describe('choisir et envoyer (AC-2 à AC-4)', { timeout: 45_000 }, () => {
  it('refuse une image trop petite sans appeler l’API', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail()
    dimensions.mockResolvedValue({ width: 300, height: 450 })

    await user.upload(fileInput(slot('Couverture')), png())

    expect(
      await within(slot('Couverture')).findByText(
        'Image trop petite : 400 × 600 px au moins (reçue : 300 × 450).',
      ),
    ).toHaveAttribute('role', 'alert')
    expect(slot('Couverture')).toHaveAccessibleDescription(
      'Image trop petite : 400 × 600 px au moins (reçue : 300 × 450).',
    )
    expect(
      within(slot('Couverture')).queryByRole('button', { name: 'Envoyer la couverture' }),
    ).toBeNull()
    expect(backend.calls).toEqual([])
  })

  it('refuse un format non accepté avant tout décodage', async () => {
    // Le sélecteur filtre déjà par type ; un dépôt ne filtre pas : on contourne le filtre.
    const user = userEvent.setup({ applyAccept: false })
    await openDetail()

    await user.upload(
      fileInput(slot('Couverture')),
      new File(['x'], 'anim.gif', { type: 'image/gif' }),
    )

    expect(await within(slot('Couverture')).findByText(IMAGE_MESSAGES.format)).toBeInTheDocument()
    expect(dimensions).not.toHaveBeenCalled()
  })

  it('montre l’aperçu, puis « Annuler » revient sans appel', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail()

    await user.upload(fileInput(slot('Couverture')), png())
    const cover = slot('Couverture')
    expect(await within(cover).findByRole('img', { name: /^Aperçu/ })).toHaveAttribute(
      'src',
      'blob:apercu',
    )
    expect(
      within(cover).getByText('Cloudinary peut décaler le cadre vers le sujet principal.'),
    ).toBeInTheDocument()
    await user.click(
      within(cover).getByRole('button', { name: "Annuler l'image choisie pour la couverture" }),
    )

    expect(within(cover).getByText('Aucune couverture')).toBeInTheDocument()
    expect(backend.calls).toEqual([])
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:apercu')
  })

  it('envoie le fichier en multipart, affiche l’image du backend et prévient', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail()
    await user.upload(fileInput(slot('Couverture')), png('affiche.png'))

    await user.click(
      await within(slot('Couverture')).findByRole('button', { name: 'Envoyer la couverture' }),
    )

    expect(await screen.findByText('Couverture mise à jour.')).toBeInTheDocument()
    // Le nom du fichier se perd entre jsdom et MSW : on vérifie le champ « file » et sa taille.
    expect(backend.callsTo('PUT', '/cover').map((call) => call.body)).toEqual([
      { file: expect.objectContaining({ size: 2048 }) as unknown },
    ])
    expect(
      within(slot('Couverture')).getByRole('img', {
        name: 'Couverture de Le Secret du Docteur Mensah',
      }),
    ).toHaveAttribute('src', expect.stringContaining('res.cloudinary.com'))
    await waitFor(() => {
      expect(
        within(slot('Couverture')).getByRole('button', { name: 'Changer la couverture' }),
      ).toHaveFocus()
    })
  })

  it('n’envoie qu’une fois sur un double clic', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail()
    dimensions.mockResolvedValue({ width: 1600, height: 900 })

    await user.upload(fileInput(slot('Bannière')), png())
    await user.dblClick(
      await within(slot('Bannière')).findByRole('button', { name: 'Envoyer la bannière' }),
    )

    expect(await screen.findByText('Bannière mise à jour.')).toBeInTheDocument()
    expect(backend.callsTo('PUT', '/banner')).toHaveLength(1)
  })
})

describe('refus du backend (AC-8)', { timeout: 45_000 }, () => {
  it.each([
    [429, 'ThrottlerException', IMAGE_MESSAGES.limit],
    [413, 'File too large', IMAGE_MESSAGES.heavy],
    [415, 'Images animées non acceptées', 'Images animées non acceptées'],
    [400, 'Unexpected field', IMAGE_MESSAGES.refused],
    [503, 'Service d’images indisponible', IMAGE_MESSAGES.unavailable],
  ])('%i : message sous l’emplacement, aperçu gardé', async (status, message, shown) => {
    const user = userEvent.setup()
    await openDetail()
    server.use(http.put(`${API}/series/:id/cover`, () => apiError(status, message)))
    await user.upload(fileInput(slot('Couverture')), png())

    await user.click(
      await within(slot('Couverture')).findByRole('button', { name: 'Envoyer la couverture' }),
    )

    expect(await within(slot('Couverture')).findByText(shown)).toBeInTheDocument()
    expect(
      within(slot('Couverture')).getByRole('button', { name: 'Envoyer la couverture' }),
    ).toBeInTheDocument()
  })

  it('409 : relit la fiche et garde l’aperçu', async () => {
    const user = userEvent.setup()
    await openDetail()
    const reads: string[] = []
    server.use(
      http.put(`${API}/series/:id/cover`, () => apiError(409, "L'image a changé entre temps")),
      http.get(`${API}/series/:id/admin`, ({ request }) => {
        reads.push(request.url)
        return undefined
      }),
    )
    await user.upload(fileInput(slot('Couverture')), png())

    await user.click(
      await within(slot('Couverture')).findByRole('button', { name: 'Envoyer la couverture' }),
    )

    expect(await within(slot('Couverture')).findByText(IMAGE_MESSAGES.conflict)).toBeInTheDocument()
    await waitFor(() => {
      expect(reads.length).toBeGreaterThan(0)
    })
    expect(
      within(slot('Couverture')).getByRole('button', { name: 'Envoyer la couverture' }),
    ).toBeInTheDocument()
  })
})

describe('retirer (AC-5)', { timeout: 45_000 }, () => {
  it('retire après confirmation une image hébergée', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail({ coverImage: HOSTED_IMAGE })

    await user.click(
      within(slot('Couverture')).getByRole('button', { name: 'Retirer la couverture' }),
    )
    const confirm = await screen.findByRole('dialog', { name: 'Retirer la couverture ?' })
    expect(
      within(confirm).getByText(
        "L'image sera effacée de l'hébergement. Cette action est définitive.",
      ),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Retirer' }))

    expect(await screen.findByText('Couverture retirée.')).toBeInTheDocument()
    expect(backend.callsTo('DELETE', '/cover')).toHaveLength(1)
    expect(within(slot('Couverture')).getByText('Aucune couverture')).toBeInTheDocument()
  })

  it('dit qu’un lien externe est seulement retiré, et ne fait rien sur Annuler', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail({ bannerImage: 'https://picsum.photos/1600/900' })

    await user.click(within(slot('Bannière')).getByRole('button', { name: 'Retirer la bannière' }))
    const confirm = await screen.findByRole('dialog', { name: 'Retirer la bannière ?' })
    expect(within(confirm).getByText('Le lien sera retiré de la série.')).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }))

    expect(backend.calls).toEqual([])
  })
})

describe('protection et vignette (AC-6, AC-9)', { timeout: 45_000 }, () => {
  it('protège la page tant qu’un aperçu attend', async () => {
    const user = userEvent.setup()
    const { router } = await openDetail()
    await user.upload(fileInput(slot('Couverture')), png())
    await within(slot('Couverture')).findByRole('button', { name: 'Envoyer la couverture' })

    act(() => {
      void router.navigate('/series')
    })

    expect(
      await screen.findByRole('dialog', { name: 'Quitter sans enregistrer ?' }),
    ).toBeInTheDocument()
  })

  it('envoie la vignette depuis la fenêtre et la montre dans le tableau', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail({}, [makeEpisode(1, 2)])
    dimensions.mockResolvedValue({ width: 1280, height: 720 })
    await user.click(screen.getByRole('button', { name: "Modifier l'épisode 2 de la saison 1" }))
    const dialog = await screen.findByRole('dialog', {
      name: "Modifier l'épisode 2 de la saison 1",
    })
    const thumb = within(dialog).getByRole('group', { name: 'Vignette' })

    await user.upload(fileInput(thumb), png())
    await user.click(
      await within(thumb).findByRole('button', {
        name: "Envoyer la vignette de l'épisode 2 de la saison 1",
      }),
    )

    expect(await screen.findByText('Vignette mise à jour.')).toBeInTheDocument()
    expect(backend.callsTo('PUT', '/episodes/1/2/thumbnail')).toHaveLength(1)
    const row = screen
      .getByRole('button', { name: "Supprimer l'épisode 2 de la saison 1" })
      .closest('tr')
    expect(row?.querySelector('img[alt=""]')).toHaveAttribute(
      'src',
      expect.stringContaining('res.cloudinary.com'),
    )
  })

  it('demande avant de fermer la fenêtre quand une vignette attend', async () => {
    const user = userEvent.setup()
    await openDetail({}, [makeEpisode(1, 1)])
    dimensions.mockResolvedValue({ width: 1280, height: 720 })
    await user.click(screen.getByRole('button', { name: "Modifier l'épisode 1 de la saison 1" }))
    const dialog = await screen.findByRole('dialog', {
      name: "Modifier l'épisode 1 de la saison 1",
    })
    const thumb = within(dialog).getByRole('group', { name: 'Vignette' })
    await user.upload(fileInput(thumb), png())
    await within(thumb).findByRole('button', {
      name: "Envoyer la vignette de l'épisode 1 de la saison 1",
    })

    await user.keyboard('{Escape}')

    expect(
      await screen.findByRole('dialog', { name: 'Abandonner les changements ?' }),
    ).toBeInTheDocument()
  })

  it('ferme la fenêtre sans question quand l’épisode a disparu (404)', async () => {
    const user = userEvent.setup()
    await openDetail({}, [makeEpisode(1, 1)])
    dimensions.mockResolvedValue({ width: 1280, height: 720 })
    server.use(
      http.put(`${API}/series/:id/episodes/:s/:e/thumbnail`, () =>
        apiError(404, 'Episode not found'),
      ),
    )
    await user.click(screen.getByRole('button', { name: "Modifier l'épisode 1 de la saison 1" }))
    const dialog = await screen.findByRole('dialog', {
      name: "Modifier l'épisode 1 de la saison 1",
    })
    const thumb = within(dialog).getByRole('group', { name: 'Vignette' })
    await user.upload(fileInput(thumb), png())

    await user.click(
      await within(thumb).findByRole('button', {
        name: "Envoyer la vignette de l'épisode 1 de la saison 1",
      }),
    )

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})
