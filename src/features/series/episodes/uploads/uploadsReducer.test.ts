import {
  canReuseLink,
  formatClock,
  hasActiveUploads,
  INITIAL_UPLOADS,
  nextTask,
  overrunEstimate,
  uploadsReducer,
  type UploadsAction,
  type UploadsState,
  type UploadTask,
} from '@/features/series/episodes/uploads/uploadsReducer'

const NOW = Date.UTC(2026, 9, 15, 12, 0, 0)

function enqueue(key: string, fromCreation = false): UploadsAction {
  const [season = '1', episode = '1'] = key.split(':')
  return {
    type: 'enqueue',
    key,
    seasonNumber: Number(season),
    episodeNumber: Number(episode),
    fileName: `${key}.mp4`,
    size: 1000,
    fromCreation,
  }
}

function run(actions: readonly UploadsAction[], state: UploadsState = INITIAL_UPLOADS) {
  return actions.reduce(uploadsReducer, state)
}

const link = (expiresAt: number) => ({
  method: 'post' as const,
  uploadUrl: 'https://upload.cloudflarestream.com/abc',
  uid: 'abc',
  expiresAt: new Date(expiresAt).toISOString(),
})

describe('file des envois (AC-7)', () => {
  it('ajoute une tâche en attente, sans progression', () => {
    const state = run([enqueue('1:1', true)])

    expect(state.tasks).toEqual([
      expect.objectContaining({ key: '1:1', status: 'queued', progress: 0, fromCreation: true }),
    ])
  })

  it('remplace la tâche d’un épisode par un nouveau fichier', () => {
    const state = run([enqueue('1:1'), { type: 'start', key: '1:1' }, enqueue('1:1')])

    expect(state.tasks).toHaveLength(1)
    expect(state.tasks[0]?.status).toBe('queued')
  })

  it('ne lance qu’une tâche à la fois, dans l’ordre d’ajout', () => {
    const queued = run([enqueue('1:1'), enqueue('1:2')])

    expect(nextTask(queued, NOW)?.key).toBe('1:1')
    expect(nextTask(run([{ type: 'start', key: '1:1' }], queued), NOW)).toBeUndefined()
  })

  it('passe à la tâche suivante quand la première est terminée ou retirée', () => {
    const queued = run([enqueue('1:1'), enqueue('1:2'), { type: 'start', key: '1:1' }])

    expect(nextTask(run([{ type: 'done', key: '1:1', at: NOW }], queued), NOW)?.key).toBe('1:2')
    expect(nextTask(run([{ type: 'remove', key: '1:1' }], queued), NOW)?.key).toBe('1:2')
  })

  it('suit le lien, la progression et l’avertissement', () => {
    const state = run([
      enqueue('1:1'),
      { type: 'start', key: '1:1' },
      { type: 'linked', key: '1:1', link: link(NOW + 3600e3), at: NOW },
      { type: 'progress', key: '1:1', progress: 0.42, warning: 'Lent' },
    ])

    expect(state.tasks[0]).toEqual(
      expect.objectContaining({
        status: 'sending',
        progress: 0.42,
        warning: 'Lent',
        linkedAt: NOW,
      }),
    )
    const cleared = run([{ type: 'progress', key: '1:1', progress: 0.5 }], state)
    expect(cleared.tasks[0]?.warning).toBeUndefined()
  })

  it('termine à 100 % et note l’heure de la vérification', () => {
    const state = run([enqueue('1:1'), { type: 'done', key: '1:1', at: NOW }])

    expect(state.tasks[0]).toEqual(
      expect.objectContaining({ status: 'done', progress: 1, lastRefreshAt: NOW }),
    )
  })

  it('interrompt avec un message, puis remet en file sur « Relancer » sans garder l’erreur au départ', () => {
    const interrupted = run([
      enqueue('1:1'),
      { type: 'start', key: '1:1' },
      { type: 'interrupted', key: '1:1', error: 'Coupure' },
    ])
    expect(interrupted.tasks[0]).toEqual(
      expect.objectContaining({ status: 'interrupted', error: 'Coupure' }),
    )

    const restarted = run(
      [
        { type: 'requeue', key: '1:1' },
        { type: 'start', key: '1:1' },
      ],
      interrupted,
    )
    expect(restarted.tasks[0]?.status).toBe('requesting')
    expect(restarted.tasks[0]?.error).toBeUndefined()
  })

  it('ne touche pas aux autres tâches', () => {
    const state = run([enqueue('1:1'), enqueue('1:2'), { type: 'start', key: '1:2' }])

    expect(state.tasks.find((task) => task.key === '1:1')?.status).toBe('queued')
  })
})

describe('pause sur la limite (AC-7)', () => {
  it('ne lance rien pendant la pause, puis reprend', () => {
    const paused = run([enqueue('1:1'), { type: 'pause', until: NOW + 120_000 }])

    expect(nextTask(paused, NOW)).toBeUndefined()
    expect(nextTask(paused, NOW + 120_001)?.key).toBe('1:1')
    expect(nextTask(run([{ type: 'resume' }], paused), NOW)?.key).toBe('1:1')
  })
})

describe('fin de session (AC-15)', () => {
  it('interrompt les tâches en cours ou en attente, garde les terminées', () => {
    const state = run([
      enqueue('1:1'),
      enqueue('1:2'),
      enqueue('1:3'),
      { type: 'done', key: '1:3', at: NOW },
      { type: 'start', key: '1:1' },
      { type: 'interruptAll', error: 'Session terminée : envoi arrêté.' },
    ])

    expect(state.tasks.map((task) => task.status)).toEqual(['interrupted', 'interrupted', 'done'])
    expect(state.tasks[0]?.error).toBe('Session terminée : envoi arrêté.')
  })
})

describe('hasActiveUploads (AC-15)', () => {
  it.each([
    ['aucune tâche', [], false],
    ['une tâche en attente', [enqueue('1:1')], true],
    ['une tâche terminée', [enqueue('1:1'), { type: 'done', key: '1:1', at: NOW }], false],
    [
      'une tâche interrompue',
      [enqueue('1:1'), { type: 'interrupted', key: '1:1', error: 'x' }],
      false,
    ],
  ] as const)('%s → %s', (_label, actions, expected) => {
    expect(hasActiveUploads(run(actions))).toBe(expected)
  })
})

function onlyTask(state: UploadsState): UploadTask {
  const [task] = state.tasks
  if (task === undefined) throw new Error('Aucune tâche')
  return task
}

describe('canReuseLink (AC-7)', () => {
  const linked = (expiresAt: number) =>
    onlyTask(run([enqueue('1:1'), { type: 'linked', key: '1:1', link: link(expiresAt), at: NOW }]))

  it('réutilise un lien encore valide plus de deux minutes', () => {
    expect(canReuseLink(linked(NOW + 10 * 60_000), NOW)).toBe(true)
  })

  it('redemande un lien qui expire dans moins de deux minutes ou a expiré', () => {
    expect(canReuseLink(linked(NOW + 60_000), NOW)).toBe(false)
    expect(canReuseLink(linked(NOW - 1), NOW)).toBe(false)
  })

  it('redemande un lien quand la tâche n’en a pas', () => {
    expect(canReuseLink(onlyTask(run([enqueue('1:1')])), NOW)).toBe(false)
  })
})

describe('overrunEstimate (AC-7)', () => {
  const expiresAt = new Date(NOW + 30 * 60_000).toISOString()

  it('n’avertit pas avant une minute d’envoi', () => {
    expect(overrunEstimate(NOW, NOW + 59_000, 1, 1000, expiresAt)).toBeUndefined()
  })

  it('n’avertit pas tant que rien n’est envoyé', () => {
    expect(overrunEstimate(NOW, NOW + 120_000, 0, 1000, expiresAt)).toBeUndefined()
  })

  it('n’avertit pas si la fin estimée précède l’expiration', () => {
    expect(overrunEstimate(NOW, NOW + 60_000, 500, 1000, expiresAt)).toBeUndefined()
  })

  it('renvoie la fin estimée quand elle dépasse l’expiration', () => {
    expect(overrunEstimate(NOW, NOW + 60_000, 10, 1000, expiresAt)).toBe(NOW + 100 * 60_000)
  })
})

describe('formatClock', () => {
  it('écrit l’heure à la française', () => {
    expect(formatClock(new Date(2026, 9, 15, 14, 32).getTime())).toBe('14 h 32')
  })
})
