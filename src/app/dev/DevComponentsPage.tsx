import {
  Anchor,
  Badge,
  Button,
  Code,
  Group,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { useState, type ReactNode } from 'react'
import { ApiError } from '@/shared/api/errors'
import { confirmDanger } from '@/shared/ui/confirmDanger'
import { DataTable, type DataTableColumn } from '@/shared/ui/DataTable'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { formatDate, formatDateTime, formatDuration } from '@/shared/ui/format'
import { notifyError } from '@/shared/ui/notifyError'
import { notifySuccess } from '@/shared/ui/notifySuccess'
import { PageHeader } from '@/shared/ui/PageHeader'

// Vitrine des composants communs, en développement seulement (spec 0003, AC-13).
// Les données ci dessous sont des exemples locaux, jamais un appel à l'API.

interface SampleSeries {
  readonly id: string
  readonly title: string
  readonly episodes: number
  readonly premium: boolean
  readonly updatedAt: string
}

const SAMPLE_SERIES: readonly SampleSeries[] = Array.from({ length: 34 }, (_, index) => ({
  id: `serie-${String(index + 1)}`,
  title: `Série d'exemple ${String(index + 1)}`,
  episodes: (index % 7) + 3,
  premium: index % 3 === 0,
  updatedAt: new Date(2026, 9, 13 - index, 14, 5).toISOString(),
}))

const COLUMNS: readonly DataTableColumn<SampleSeries>[] = [
  {
    key: 'title',
    header: 'Titre',
    render: (row) => (
      <Anchor href="#" fw={600}>
        {row.title}
      </Anchor>
    ),
  },
  { key: 'episodes', header: 'Épisodes', render: (row) => row.episodes, width: 110 },
  {
    key: 'access',
    header: 'Accès',
    width: 120,
    render: (row) =>
      row.premium ? (
        <Badge variant="light">Premium</Badge>
      ) : (
        <Badge variant="light" color="gray">
          Gratuit
        </Badge>
      ),
  },
  { key: 'updatedAt', header: 'Modifiée le', render: (row) => formatDate(row.updatedAt) },
]

const PAGE_SIZE = 10
type TableMode = 'données' | 'chargement' | 'rechargement' | 'vide' | 'erreur'

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <Paper withBorder p="lg">
      <Title order={2} size="h4" mb="md">
        {title}
      </Title>
      {children}
    </Paper>
  )
}

function TableDemo() {
  const [mode, setMode] = useState<TableMode>('données')
  const [page, setPage] = useState(1)
  const rows = SAMPLE_SERIES.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  return (
    <Stack gap="md">
      <SegmentedControl
        aria-label="État du tableau"
        value={mode}
        onChange={(value) => {
          setMode(value)
        }}
        data={['données', 'chargement', 'rechargement', 'vide', 'erreur']}
      />
      <DataTable
        caption="Séries d'exemple"
        columns={COLUMNS}
        rows={mode === 'chargement' ? undefined : mode === 'vide' ? [] : rows}
        getRowKey={(row) => row.id}
        total={mode === 'vide' ? 0 : SAMPLE_SERIES.length}
        page={page}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
        isLoading={mode === 'chargement' || mode === 'rechargement'}
        error={mode === 'erreur' ? new ApiError({ kind: 'network' }) : undefined}
        onRetry={() => {
          setMode('données')
        }}
        empty={{
          title: 'Aucune série pour le moment',
          description: 'Créez la première série pour commencer à remplir le catalogue.',
          action: <Button leftSection={<IconPlus size={16} />}>Nouvelle série</Button>,
        }}
      />
    </Stack>
  )
}

function ActionsDemo() {
  const [lastAnswer, setLastAnswer] = useState<string>('aucune')

  return (
    <Stack gap="md">
      <Group gap="sm">
        <Button
          color="noliRed.8"
          onClick={() => {
            void confirmDanger({
              title: 'Supprimer « Série d’exemple 1 » ?',
              message:
                'La série, ses 12 épisodes, ses images et ses vidéos seront supprimés. Cette action est définitive.',
            }).then((confirmed) => {
              setLastAnswer(confirmed ? 'Supprimer' : 'Annuler')
            })
          }}
        >
          Supprimer une série
        </Button>
        <Button
          variant="light"
          onClick={() => {
            notifySuccess('Série enregistrée.')
          }}
        >
          Notification de succès
        </Button>
        <Button
          variant="default"
          onClick={() => {
            notifyError(new ApiError({ kind: 'http', status: 413 }))
          }}
        >
          Notification d’erreur
        </Button>
      </Group>
      <Text size="sm" c="dimmed">
        Dernière réponse de la confirmation : {lastAnswer}
      </Text>
    </Stack>
  )
}

export function DevComponentsPage() {
  return (
    <>
      <PageHeader
        title="Composants"
        description="Vitrine du design system, visible seulement en développement."
        actions={<Button leftSection={<IconPlus size={16} />}>Action principale</Button>}
      />
      <Stack gap="lg">
        <Section title="Couleurs et boutons">
          <Group gap="sm">
            <Button>Principal</Button>
            <Button variant="light">Léger</Button>
            <Button variant="default">Secondaire</Button>
            <Button color="noliIndigo">Indigo</Button>
            <Button color="noliRed.8">Danger</Button>
            <Button disabled>Désactivé</Button>
            <Anchor href="#">Lien</Anchor>
          </Group>
        </Section>

        <Section title="Champ de formulaire">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <TextInput label="Titre de la série" placeholder="Ex. : Les Héritiers" />
            <TextInput label="Titre (erreur)" defaultValue="Les Héritiers" error="Déjà utilisé." />
          </SimpleGrid>
        </Section>

        <Section title="Tableau paginé">
          <TableDemo />
        </Section>

        <Section title="États">
          <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
            <Paper withBorder>
              <EmptyState
                title="Aucune catégorie"
                description="Les catégories regroupent les séries dans l'app."
                action={<Button variant="light">Créer une catégorie</Button>}
              />
            </Paper>
            <ErrorState
              error={new ApiError({ kind: 'http', status: 400, backendMessage: 'title too long' })}
              onRetry={() => undefined}
            />
          </SimpleGrid>
        </Section>

        <Section title="Confirmation et notifications">
          <ActionsDemo />
        </Section>

        <Section title="Formatage">
          <Stack gap={4}>
            <Text size="sm">
              <Code>formatDate</Code> : {formatDate('2026-10-13T14:05:00.000Z')}
            </Text>
            <Text size="sm">
              <Code>formatDateTime</Code> : {formatDateTime('2026-10-13T14:05:00.000Z')}
            </Text>
            <Text size="sm">
              <Code>formatDuration</Code> : {formatDuration(30)} · {formatDuration(1500)} ·{' '}
              {formatDuration(3900)} · {formatDuration(undefined)}
            </Text>
          </Stack>
        </Section>
      </Stack>
    </>
  )
}
