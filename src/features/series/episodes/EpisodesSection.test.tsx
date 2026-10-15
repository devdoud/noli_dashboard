import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { notifications } from '@mantine/notifications'
import { delay, http } from 'msw'
import { routes } from '@/app/routes'
import { EPISODE_EXISTS_MESSAGE } from '@/features/series/episodes/EpisodeModal'
import { EPISODE_MESSAGES } from '@/features/series/episodes/episodeForm'
import { PUBLISH_MESSAGE } from '@/features/series/episodes/episodeConfirms'
import { resetSessionForTests } from '@/shared/session/session'
import {
  apiError,
  DETAIL_PATH,
  episodesBackend,
  makeEpisode,
  UPLOAD_HOST,
  type RawEpisode,
} from '@/test/episodesApi'
import { renderRoutes } from '@/test/render'
import { API } from '@/test/seriesApi'
import { server } from '@/test/server'
import { signInForTests } from '@/test/session'

const EPISODE_PATH = `${API}/series/:id/episodes/:s/:e`
const LEGACY_URL = 'https://cdn.exemple.com/video.mp4'

async function openDetail(episodes: readonly RawEpisode[]) {
  const backend = episodesBackend(episodes)
  server.use(...backend.handlers)
  const rendered = renderRoutes(routes, DETAIL_PATH)
  await screen.findByRole('heading', { level: 2, name: 'Épisodes' })
  return { backend, ...rendered }
}

function seasonTable(seasonNumber: number) {
  return screen.getByRole('table', { name: `Saison ${String(seasonNumber)}` })
}

function rowOf(seasonNumber: number, episodeNumber: number) {
  const button = screen.getByRole('button', {
    name: `Modifier l'épisode ${String(episodeNumber)} de la saison ${String(seasonNumber)}`,
  })
  const row = button.closest('tr')
  if (row === null) throw new Error('Ligne introuvable')
  return row
}

async function openAdd(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getAllByRole('button', { name: 'Ajouter un épisode' })[0] as HTMLElement)
  return screen.findByRole('dialog', { name: 'Ajouter un épisode' })
}

async function openEdit(
  user: ReturnType<typeof userEvent.setup>,
  seasonNumber: number,
  episodeNumber: number,
) {
  const name = `l'épisode ${String(episodeNumber)} de la saison ${String(seasonNumber)}`
  await user.click(screen.getByRole('button', { name: `Modifier ${name}` }))
  return screen.findByRole('dialog', { name: `Modifier ${name}` })
}

function fileInput(dialog: HTMLElement): HTMLInputElement {
  const input = dialog.querySelector<HTMLInputElement>('input[type="file"]')
  if (input === null) throw new Error('Champ fichier introuvable')
  return input
}

const videoFile = () => new File([new Uint8Array(2048)], 'episode.mp4', { type: 'video/mp4' })

async function fillNewEpisode(
  user: ReturnType<typeof userEvent.setup>,
  dialog: HTMLElement,
  title = 'Le retour',
) {
  const box = within(dialog)
  await user.type(box.getByRole('textbox', { name: /^Titre/ }), title)
  await user.clear(box.getByRole('textbox', { name: 'Durée, minutes' }))
  await user.type(box.getByRole('textbox', { name: 'Durée, minutes' }), '24')
  await user.clear(box.getByRole('textbox', { name: 'Durée, secondes' }))
  await user.type(box.getByRole('textbox', { name: 'Durée, secondes' }), '30')
}

beforeEach(() => {
  signInForTests()
})

afterEach(() => {
  act(() => {
    notifications.clean()
    notifications.cleanQueue()
  })
  resetSessionForTests()
})

describe('section Épisodes (AC-1, AC-11, AC-12, AC-17)', { timeout: 45_000 }, () => {
  it('affiche un tableau par saison, épisodes dans l’ordre, avec le nombre', async () => {
    await openDetail([makeEpisode(2, 1), makeEpisode(1, 2), makeEpisode(1, 1)])

    expect(screen.getByText('3 épisodes')).toBeInTheDocument()
    const tables = screen.getAllByRole('table').filter((table) => table.querySelector('caption'))
    expect(tables.map((table) => table.querySelector('caption')?.textContent)).toEqual([
      'Saison 1',
      'Saison 2',
    ])
    const rows = within(seasonTable(1)).getAllByRole('row').slice(1)
    expect(rows.map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual(['1', '2'])
    expect(
      within(seasonTable(1))
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['N°', 'Titre', 'Durée', 'Sortie', 'Accès', 'Vidéo', 'Actions'])
  })

  it('affiche l’état vide sans épisode', async () => {
    await openDetail([])

    expect(screen.getByText('Aucun épisode pour le moment')).toBeInTheDocument()
    expect(screen.getByText('Ajoutez le premier épisode de la série.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ajouter un épisode' })).toBeInTheDocument()
  })

  it('montre l’état de chaque vidéo et l’accès qui en découle', async () => {
    await openDetail([
      makeEpisode(1, 1, { isFree: true, video: { status: 'ready' } }),
      makeEpisode(1, 2, { video: { status: 'ready', pendingStatus: 'processing' } }),
      makeEpisode(1, 3, { video: { status: 'legacy', hasPastedUrl: true } }),
      makeEpisode(1, 4, { video: { status: 'error', pendingError: 'upload_expired' } }),
      makeEpisode(1, 5, { video: { status: 'none' } }),
    ])

    expect(within(rowOf(1, 1)).getByText('Prête')).toBeInTheDocument()
    expect(within(rowOf(1, 1)).getByText('Gratuit')).toBeInTheDocument()
    expect(within(rowOf(1, 2)).getByText('Remplacement en cours')).toBeInTheDocument()
    expect(within(rowOf(1, 2)).getByText('Premium')).toBeInTheDocument()
    expect(within(rowOf(1, 3)).getByText('Lien collé')).toBeInTheDocument()
    expect(within(rowOf(1, 3)).getByText('Non protégé')).toBeInTheDocument()
    expect(within(rowOf(1, 3)).queryByText('Non visible')).not.toBeInTheDocument()
    expect(within(rowOf(1, 4)).getByText('Erreur')).toBeInTheDocument()
    expect(within(rowOf(1, 4)).getByText("Lien d'envoi expiré")).toBeInTheDocument()
    expect(within(rowOf(1, 4)).getByText('Non visible')).toBeInTheDocument()
    expect(within(rowOf(1, 5)).getByText('Aucune vidéo')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Seuls les épisodes visibles (avec une vidéo prête ou un lien) comptent dans les épisodes gratuits.',
      ),
    ).toBeInTheDocument()
  })

  it('affiche durée et date de sortie en UTC', async () => {
    await openDetail([makeEpisode(1, 1, { duration: 1470, releaseDate: '2026-10-20T23:30:00Z' })])

    expect(within(rowOf(1, 1)).getByText('24 min')).toBeInTheDocument()
    expect(within(rowOf(1, 1)).getByText('20 oct. 2026')).toBeInTheDocument()
  })

  it('donne un nom complet à chaque bouton d’action', async () => {
    await openDetail([makeEpisode(1, 3)])

    expect(
      screen.getByRole('button', { name: "Modifier l'épisode 3 de la saison 1" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: "Supprimer l'épisode 3 de la saison 1" }),
    ).toBeInTheDocument()
  })
})

describe('ajout d’un épisode (AC-2 à AC-5, AC-16)', { timeout: 45_000 }, () => {
  it('propose la saison et le numéro, puis recalcule le numéro au changement de saison', async () => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1), makeEpisode(2, 1), makeEpisode(2, 4)])

    const dialog = await openAdd(user)
    const season = within(dialog).getByRole('textbox', { name: /^Saison/ })
    const number = within(dialog).getByRole('textbox', { name: /^Numéro/ })
    expect(season).toHaveValue('2')
    expect(number).toHaveValue('5')
    expect(season).toHaveFocus()

    await user.clear(season)
    await user.type(season, '1')

    // Le champ Numéro est recréé par le formulaire non contrôlé : on le relit.
    expect(within(dialog).getByRole('textbox', { name: /^Numéro/ })).toHaveValue('2')
  })

  it('garde le numéro saisi par l’admin quand la saison change', async () => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1)])
    const dialog = await openAdd(user)
    const number = within(dialog).getByRole('textbox', { name: /^Numéro/ })

    await user.clear(number)
    await user.type(number, '7')
    await user.clear(within(dialog).getByRole('textbox', { name: /^Saison/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Saison/ }), '3')

    expect(number).toHaveValue('7')
  })

  it('refuse un formulaire invalide sans appeler l’API et place le focus', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([])
    const dialog = await openAdd(user)
    const box = within(dialog)

    await user.type(box.getByRole('textbox', { name: 'Durée, secondes' }), '75')
    await user.click(box.getByRole('tab', { name: 'Depuis un lien' }))
    await user.type(box.getByRole('textbox', { name: 'Lien de la vidéo' }), 'http://exemple.com/v')
    await user.click(box.getByRole('button', { name: "Ajouter l'épisode" }))

    expect(await box.findByText(EPISODE_MESSAGES.titleRequired)).toBeInTheDocument()
    expect(box.getByText(EPISODE_MESSAGES.seconds)).toBeInTheDocument()
    expect(box.getByText(EPISODE_MESSAGES.link)).toBeInTheDocument()
    expect(box.getByRole('textbox', { name: /^Titre/ })).toHaveFocus()
    expect(backend.calls).toEqual([])
  })

  it('refuse une durée nulle', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([])
    const dialog = await openAdd(user)

    await user.type(within(dialog).getByRole('textbox', { name: /^Titre/ }), 'Sans durée')
    await user.click(within(dialog).getByRole('button', { name: "Ajouter l'épisode" }))

    expect(await within(dialog).findByText(EPISODE_MESSAGES.durationMin)).toBeInTheDocument()
    expect(backend.calls).toEqual([])
  })

  it('ajoute l’épisode, ferme la fenêtre et met le tableau à jour', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([makeEpisode(1, 1), makeEpisode(1, 2)])
    const dialog = await openAdd(user)

    await fillNewEpisode(user, dialog)
    await user.type(within(dialog).getByLabelText('Date de sortie'), '2026-10-20')
    await user.click(within(dialog).getByRole('button', { name: "Ajouter l'épisode" }))

    expect(await screen.findByText('Épisode ajouté.')).toBeInTheDocument()
    expect(backend.callsTo('POST', '/episodes').map((call) => call.body)).toEqual([
      {
        seasonNumber: 1,
        episodeNumber: 3,
        title: 'Le retour',
        duration: 1470,
        releaseDate: '2026-10-20T12:00:00.000Z',
      },
    ])
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Ajouter un épisode' })).not.toBeInTheDocument()
    })
    expect(screen.getByText('3 épisodes')).toBeInTheDocument()
    expect(within(rowOf(1, 3)).getByText('Le retour')).toBeInTheDocument()
  })

  it('signale un épisode qui existe déjà sous Numéro, fenêtre ouverte', async () => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1)])
    const dialog = await openAdd(user)
    const number = within(dialog).getByRole('textbox', { name: /^Numéro/ })

    await user.clear(number)
    await user.type(number, '1')
    await fillNewEpisode(user, dialog, 'Doublon')
    await user.click(within(dialog).getByRole('button', { name: "Ajouter l'épisode" }))

    expect(await within(dialog).findByText(EPISODE_EXISTS_MESSAGE)).toBeInTheDocument()
    expect(number).toHaveFocus()
    expect(screen.getByRole('dialog', { name: 'Ajouter un épisode' })).toBeInTheDocument()
  })

  it('n’envoie qu’un ajout sur un double clic', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([])
    const bodies: unknown[] = []
    server.use(
      http.post(`${API}/series/:id/episodes`, async ({ request }) => {
        bodies.push(await request.clone().json())
        await delay(300)
        return undefined
      }),
    )
    const dialog = await openAdd(user)
    await fillNewEpisode(user, dialog)
    const add = within(dialog).getByRole('button', { name: "Ajouter l'épisode" })

    await user.dblClick(add)

    expect(await screen.findByText('Épisode ajouté.')).toBeInTheDocument()
    expect(bodies).toHaveLength(1)
    expect(backend.callsTo('POST', '/episodes')).toHaveLength(1)
  })

  it('revient à la liste quand la série a disparu (404)', async () => {
    const user = userEvent.setup()
    const { router } = await openDetail([])
    server.use(http.post(`${API}/series/:id/episodes`, () => apiError(404, 'Series not found')))
    const dialog = await openAdd(user)
    await fillNewEpisode(user, dialog)

    await user.click(within(dialog).getByRole('button', { name: "Ajouter l'épisode" }))

    expect(await screen.findByText("Cette série n'existe plus.")).toBeInTheDocument()
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/series')
    })
  })
})

describe('modification d’un épisode (AC-6)', { timeout: 45_000 }, () => {
  it('n’envoie que le titre modifié', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([makeEpisode(1, 2, { title: 'Ancien' })])
    const dialog = await openEdit(user, 1, 2)
    const save = within(dialog).getByRole('button', { name: 'Enregistrer' })

    expect(within(dialog).getByText('Saison 1 · Épisode 2')).toBeInTheDocument()
    expect(save).toBeDisabled()
    expect(within(dialog).getByRole('textbox', { name: /^Titre/ })).toHaveFocus()

    await user.clear(within(dialog).getByRole('textbox', { name: /^Titre/ }))
    await user.type(within(dialog).getByRole('textbox', { name: /^Titre/ }), 'Nouveau')
    await user.click(save)

    expect(await screen.findByText('Épisode modifié.')).toBeInTheDocument()
    expect(backend.callsTo('PATCH', '/episodes/1/2').map((call) => call.body)).toEqual([
      { title: 'Nouveau' },
    ])
    expect(within(rowOf(1, 2)).getByText('Nouveau')).toBeInTheDocument()
  })

  it('refuse de vider une date de sortie déjà renseignée', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([makeEpisode(1, 1)])
    const dialog = await openEdit(user, 1, 1)

    await user.clear(within(dialog).getByLabelText('Date de sortie'))
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await within(dialog).findByText(EPISODE_MESSAGES.dateRemoved)).toBeInTheDocument()
    expect(backend.calls).toEqual([])
  })

  it('ferme la fenêtre et prévient quand l’épisode a disparu (404)', async () => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1)])
    server.use(http.patch(EPISODE_PATH, () => apiError(404, 'Episode not found')))
    const dialog = await openEdit(user, 1, 1)

    await user.type(within(dialog).getByRole('textbox', { name: /^Titre/ }), ' bis')
    await user.click(within(dialog).getByRole('button', { name: 'Enregistrer' }))

    expect(await screen.findByText("Cet épisode n'existe plus.")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })
})

describe('vidéos (AC-4, AC-7 à AC-10, AC-13, AC-16)', { timeout: 45_000 }, () => {
  it('envoie le fichier choisi après la création, puis vérifie l’hébergement', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([])
    const dialog = await openAdd(user)
    await fillNewEpisode(user, dialog)
    await user.upload(fileInput(dialog), videoFile())

    await user.click(within(dialog).getByRole('button', { name: "Ajouter l'épisode" }))
    const publish = await screen.findByRole('dialog', { name: "Publier l'épisode ?" })
    expect(within(publish).getByText(PUBLISH_MESSAGE)).toBeInTheDocument()
    await user.click(within(publish).getByRole('button', { name: 'Publier' }))

    await waitFor(() => {
      expect(backend.callsTo('POST', '/video/refresh')).toHaveLength(1)
    })
    expect(backend.calls.map((call) => `${call.method} ${call.path}`)).toEqual([
      expect.stringMatching(/^POST .*\/episodes$/),
      expect.stringMatching(/^POST .*\/episodes\/1\/1\/video\/upload$/),
      expect.stringMatching(/^POST \/up\d+$/),
      expect.stringMatching(/^POST .*\/episodes\/1\/1\/video\/refresh$/),
    ])
    expect(backend.callsTo('POST', '/video/upload')[0]?.body).toEqual({ uploadLength: 2048 })
    expect(await within(rowOf(1, 1)).findByText('En traitement')).toBeInTheDocument()
  })

  it('n’ajoute rien quand l’admin refuse de publier', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([])
    const dialog = await openAdd(user)
    await fillNewEpisode(user, dialog)
    await user.upload(fileInput(dialog), videoFile())

    await user.click(within(dialog).getByRole('button', { name: "Ajouter l'épisode" }))
    const publish = await screen.findByRole('dialog', { name: "Publier l'épisode ?" })
    await user.click(within(publish).getByRole('button', { name: 'Annuler' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: "Publier l'épisode ?" })).not.toBeInTheDocument()
    })
    expect(backend.calls).toEqual([])
    expect(screen.getByRole('dialog', { name: 'Ajouter un épisode' })).toBeInTheDocument()
  })

  it('garde l’épisode créé et propose « Relancer » quand la vidéo ne démarre pas', async () => {
    const user = userEvent.setup()
    await openDetail([])
    server.use(
      http.post(`${EPISODE_PATH}/video/upload`, () => apiError(503, 'Service vidéo indisponible')),
    )
    const dialog = await openAdd(user)
    await fillNewEpisode(user, dialog)
    await user.upload(fileInput(dialog), videoFile())
    await user.click(within(dialog).getByRole('button', { name: "Ajouter l'épisode" }))
    await user.click(
      within(await screen.findByRole('dialog', { name: "Publier l'épisode ?" })).getByRole(
        'button',
        { name: 'Publier' },
      ),
    )

    expect(
      await screen.findByText(/Épisode ajouté, mais la vidéo n'a pas démarré\./),
    ).toBeInTheDocument()
    expect(await within(rowOf(1, 1)).findByText('Envoi interrompu')).toBeInTheDocument()
    expect(
      within(rowOf(1, 1)).getByRole('button', {
        name: "Relancer l'envoi de la vidéo de l'épisode 1 de la saison 1",
      }),
    ).toBeInTheDocument()
  })

  it('met la file en pause sur la limite des envois (429)', async () => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1)])
    server.use(
      http.post(`${EPISODE_PATH}/video/upload`, () =>
        apiError(429, 'ThrottlerException: Too Many Requests'),
      ),
    )
    const dialog = await openEdit(user, 1, 1)
    await user.upload(fileInput(dialog), videoFile())
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer ce fichier' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: "Publier l'épisode ?" })).getByRole(
        'button',
        { name: 'Publier' },
      ),
    )

    expect(
      await within(rowOf(1, 1)).findByText(
        /^Pause : limite d'envois atteinte, reprise à \d\d h \d\d$/,
      ),
    ).toBeInTheDocument()
  })

  it('montre la progression nommée, un second envoi en attente, et protège la page', async () => {
    const user = userEvent.setup()
    const { router } = await openDetail([makeEpisode(1, 1), makeEpisode(1, 2)])
    server.use(
      http.post(`${UPLOAD_HOST}/:uid`, async () => {
        await delay('infinite')
        return undefined
      }),
    )
    for (const episodeNumber of [1, 2]) {
      const dialog = await openEdit(user, 1, episodeNumber)
      await user.upload(fileInput(dialog), videoFile())
      await user.click(within(dialog).getByRole('button', { name: 'Envoyer ce fichier' }))
      await user.click(
        within(await screen.findByRole('dialog', { name: "Publier l'épisode ?" })).getByRole(
          'button',
          { name: 'Publier' },
        ),
      )
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      })
    }

    expect(
      await screen.findByRole('progressbar', {
        name: "Envoi de la vidéo de l'épisode 1 de la saison 1",
      }),
    ).toBeInTheDocument()
    expect(within(rowOf(1, 2)).getByText("En attente d'envoi")).toBeInTheDocument()

    act(() => {
      void router.navigate('/series')
    })
    const leave = await screen.findByRole('dialog', { name: 'Quitter sans enregistrer ?' })
    expect(
      within(leave).getByText("Un envoi de vidéo est en cours. Quitter l'arrêtera."),
    ).toBeInTheDocument()
    await user.click(within(leave).getByRole('button', { name: 'Rester' }))
    expect(router.state.location.pathname).toBe(DETAIL_PATH)
  })

  it('annule un envoi sans appeler le backend', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([makeEpisode(1, 1)])
    server.use(
      http.post(`${UPLOAD_HOST}/:uid`, async () => {
        await delay('infinite')
        return undefined
      }),
    )
    const dialog = await openEdit(user, 1, 1)
    await user.upload(fileInput(dialog), videoFile())
    await user.click(within(dialog).getByRole('button', { name: 'Envoyer ce fichier' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: "Publier l'épisode ?" })).getByRole(
        'button',
        { name: 'Publier' },
      ),
    )
    const cancel = await screen.findByRole('button', {
      name: "Annuler l'envoi de la vidéo de l'épisode 1 de la saison 1",
    })
    const before = backend.calls.length

    await user.click(cancel)

    expect(
      screen.queryByRole('progressbar', {
        name: "Envoi de la vidéo de l'épisode 1 de la saison 1",
      }),
    ).not.toBeInTheDocument()
    expect(backend.calls).toHaveLength(before)
  })

  it('importe un lien https après la question de publication', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([makeEpisode(1, 1)])
    const dialog = await openEdit(user, 1, 1)

    await user.click(within(dialog).getByRole('tab', { name: 'Depuis un lien' }))
    await user.type(within(dialog).getByRole('textbox', { name: 'Lien de la vidéo' }), LEGACY_URL)
    await user.click(within(dialog).getByRole('button', { name: 'Importer ce lien' }))
    await user.click(
      within(await screen.findByRole('dialog', { name: "Publier l'épisode ?" })).getByRole(
        'button',
        { name: 'Publier' },
      ),
    )

    expect(await screen.findByText('Import lancé.')).toBeInTheDocument()
    expect(backend.callsTo('POST', '/video/import').map((call) => call.body)).toEqual([
      { url: LEGACY_URL },
    ])
  })

  it('migre un lien collé sans question de publication', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([
      makeEpisode(1, 1, { video: { status: 'legacy', hasPastedUrl: true } }),
    ])
    const dialog = await openEdit(user, 1, 1)

    await user.click(
      within(dialog).getByRole('button', { name: "Importer ce lien dans l'hébergement" }),
    )

    expect(await screen.findByText('Import du lien lancé.')).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: "Publier l'épisode ?" })).not.toBeInTheDocument()
    expect(backend.callsTo('POST', '/video/import').map((call) => call.body)).toEqual([
      { fromPastedLink: true },
    ])
  })

  it.each([
    [
      400,
      'Lien vidéo refusé par Cloudflare : fichier illisible',
      'Lien vidéo refusé par Cloudflare : fichier illisible',
    ],
    [429, 'ThrottlerException', "Trop d'envois en peu de temps : réessayez dans quelques minutes."],
    [503, 'Service vidéo indisponible', 'Le service vidéo est indisponible pour le moment.'],
    [409, 'Conflict', "Une autre demande vient d'être prise en compte pour cette vidéo."],
  ])('affiche le message d’un import refusé (%i)', async (status, backendMessage, shown) => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1, { video: { status: 'legacy', hasPastedUrl: true } })])
    server.use(http.post(`${EPISODE_PATH}/video/import`, () => apiError(status, backendMessage)))
    const dialog = await openEdit(user, 1, 1)

    await user.click(
      within(dialog).getByRole('button', { name: "Importer ce lien dans l'hébergement" }),
    )

    expect(await screen.findByText(shown)).toBeInTheDocument()
  })

  it('propose les actions selon l’état de la vidéo', async () => {
    const user = userEvent.setup()
    await openDetail([
      makeEpisode(1, 1, { video: { status: 'ready' } }),
      makeEpisode(1, 2, { video: { status: 'pending', pendingStatus: 'processing' } }),
      makeEpisode(1, 3),
    ])

    let dialog = await openEdit(user, 1, 1)
    expect(within(dialog).getByRole('button', { name: 'Retirer la vidéo' })).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Remplacer la vidéo' })).toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    dialog = await openEdit(user, 1, 2)
    expect(within(dialog).getByRole('button', { name: 'Vérifier maintenant' })).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: 'Retirer la vidéo' }),
    ).not.toBeInTheDocument()
    await user.keyboard('{Escape}')
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })

    dialog = await openEdit(user, 1, 3)
    expect(within(dialog).getByRole('heading', { name: 'Ajouter une vidéo' })).toBeInTheDocument()
    expect(
      within(dialog).queryByRole('button', { name: "Importer ce lien dans l'hébergement" }),
    ).not.toBeInTheDocument()
  })

  it('« Vérifier maintenant » interroge l’hébergement', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([
      makeEpisode(1, 1, { video: { status: 'pending', pendingStatus: 'processing' } }),
    ])
    const dialog = await openEdit(user, 1, 1)

    await user.click(within(dialog).getByRole('button', { name: 'Vérifier maintenant' }))

    await waitFor(() => {
      expect(backend.callsTo('POST', '/episodes/1/1/video/refresh')).toHaveLength(1)
    })
  })

  it('retire la vidéo après confirmation', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([makeEpisode(1, 1, { video: { status: 'ready' } })])
    const dialog = await openEdit(user, 1, 1)

    await user.click(within(dialog).getByRole('button', { name: 'Retirer la vidéo' }))
    const confirm = await screen.findByRole('dialog', {
      name: "Retirer la vidéo de l'épisode 1 de la saison 1 ?",
    })
    expect(
      within(confirm).getByText(
        "L'épisode ne sera plus visible des spectateurs. La vidéo hébergée sera effacée.",
      ),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Retirer' }))

    expect(await screen.findByText('Vidéo retirée.')).toBeInTheDocument()
    expect(backend.callsTo('DELETE', '/episodes/1/1/video')).toHaveLength(1)
    expect(within(rowOf(1, 1)).getByText('Aucune vidéo')).toBeInTheDocument()
  })
})

describe('suppression d’un épisode (AC-14)', { timeout: 45_000 }, () => {
  it('supprime après une confirmation qui nomme l’épisode et ce qui sera effacé', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([makeEpisode(1, 1), makeEpisode(1, 2, { title: 'Final' })])

    await user.click(screen.getByRole('button', { name: "Supprimer l'épisode 2 de la saison 1" }))
    const confirm = await screen.findByRole('dialog', {
      name: "Supprimer l'épisode 2 de la saison 1 ?",
    })
    expect(
      within(confirm).getByText(
        "« Final » sera supprimé définitivement, avec sa vidéo, sa vignette et l'historique de visionnage des spectateurs pour cet épisode.",
      ),
    ).toBeInTheDocument()
    await user.click(within(confirm).getByRole('button', { name: 'Supprimer' }))

    expect(await screen.findByText('Épisode supprimé.')).toBeInTheDocument()
    expect(backend.callsTo('DELETE', '/episodes/1/2')).toHaveLength(1)
    expect(
      screen.queryByRole('button', { name: "Modifier l'épisode 2 de la saison 1" }),
    ).not.toBeInTheDocument()
  })

  it('ne supprime rien sur Annuler', async () => {
    const user = userEvent.setup()
    const { backend } = await openDetail([makeEpisode(1, 1)])

    await user.click(screen.getByRole('button', { name: "Supprimer l'épisode 1 de la saison 1" }))
    const confirm = await screen.findByRole('dialog', {
      name: "Supprimer l'épisode 1 de la saison 1 ?",
    })
    await user.click(within(confirm).getByRole('button', { name: 'Annuler' }))

    expect(backend.calls).toEqual([])
  })

  it('annonce un épisode déjà supprimé (404)', async () => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1)])
    server.use(http.delete(EPISODE_PATH, () => apiError(404, 'Episode not found')))

    await user.click(screen.getByRole('button', { name: "Supprimer l'épisode 1 de la saison 1" }))
    await user.click(
      within(
        await screen.findByRole('dialog', { name: "Supprimer l'épisode 1 de la saison 1 ?" }),
      ).getByRole('button', { name: 'Supprimer' }),
    )

    expect(await screen.findByText('Cet épisode avait déjà été supprimé.')).toBeInTheDocument()
  })
})

describe('changements non enregistrés (AC-15)', { timeout: 45_000 }, () => {
  it('demande avant de fermer une fenêtre modifiée, et garde la saisie sur « Continuer »', async () => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1)])
    const dialog = await openAdd(user)
    await user.type(within(dialog).getByRole('textbox', { name: /^Titre/ }), 'Brouillon')

    await user.keyboard('{Escape}')
    const ask = await screen.findByRole('dialog', { name: 'Abandonner les changements ?' })
    await user.click(within(ask).getByRole('button', { name: 'Continuer la saisie' }))

    expect(screen.getByRole('dialog', { name: 'Ajouter un épisode' })).toBeInTheDocument()
    expect(within(dialog).getByRole('textbox', { name: /^Titre/ })).toHaveValue('Brouillon')
  })

  it('ferme une fenêtre sans changement sans rien demander', async () => {
    const user = userEvent.setup()
    await openDetail([makeEpisode(1, 1)])
    await openEdit(user, 1, 1)

    await user.keyboard('{Escape}')

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  it('protège la page tant qu’une fenêtre d’épisode est modifiée', async () => {
    const user = userEvent.setup()
    const { router } = await openDetail([makeEpisode(1, 1)])
    const dialog = await openEdit(user, 1, 1)
    await user.type(within(dialog).getByRole('textbox', { name: /^Titre/ }), ' bis')

    act(() => {
      void router.navigate('/series')
    })

    const leave = await screen.findByRole('dialog', { name: 'Quitter sans enregistrer ?' })
    expect(within(leave).getByText('Vos changements seront perdus.')).toBeInTheDocument()
    await user.click(within(leave).getByRole('button', { name: 'Quitter' }))
    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/series')
    })
  })
})
