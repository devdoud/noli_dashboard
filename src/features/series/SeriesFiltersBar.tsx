// Barre de filtres de la liste des séries (spec 0009, AC-1 à AC-4, AC-6, AC-8, AC-10 ; spec 0010, AC-4).
// La saisie de la recherche est locale ; l'adresse, tenue par la page, reste la seule source des
// filtres actifs. La barre décrit chaque changement ; la page écrit l'adresse.
import {
  Box,
  Button,
  CloseButton,
  Group,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useDebouncedValue } from '@mantine/hooks'
import { IconSearch } from '@tabler/icons-react'
import { useEffect, useEffectEvent, useId, useRef, useState, type Ref } from 'react'
import {
  normalizeSearch,
  SEARCH_MAX_LENGTH,
  searchValue,
  hasFilters,
  type SeriesAccess,
  type SeriesFilters,
  type SeriesVideos,
} from '@/features/series/filters'
import type { Category } from '@/shared/api/categories'

export const SEARCH_DEBOUNCE_MS = 300

/** `push` crée une entrée d'historique, `replace` remplace l'entrée courante (AC-4). */
export type HistoryMode = 'push' | 'replace'

export interface SeriesFiltersBarProps {
  readonly filters: SeriesFilters
  readonly onChange: (next: SeriesFilters, mode: HistoryMode) => void
  readonly onClear: () => void
  readonly categories: readonly Category[] | undefined
  readonly categoriesStatus: 'pending' | 'error' | 'success'
  /** Compte des résultats à annoncer ; vide quand aucun filtre n'est actif ou pendant un chargement. */
  readonly countText: string
  readonly searchRef: Ref<HTMLInputElement>
}

const ACCESS_ALL = 'toutes'
const ACCESS_OPTIONS = [
  { label: 'Toutes', value: ACCESS_ALL },
  { label: 'Premium', value: 'premium' },
  { label: 'Gratuites', value: 'gratuites' },
]

function toAccess(value: string): SeriesAccess | undefined {
  return value === 'premium' || value === 'gratuites' ? value : undefined
}

// Filtre « Vidéos » (spec 0010, AC-4).
const VIDEOS_ALL = 'toutes'
const VIDEOS_OPTIONS = [
  { label: 'Toutes', value: VIDEOS_ALL },
  { label: 'À traiter', value: 'a-traiter' },
]

function toVideos(value: string): SeriesVideos | undefined {
  return value === 'a-traiter' ? value : undefined
}

function categoryLabel(category: Category): string {
  return category.isVisible ? category.name : `${category.name} (masquée)`
}

export function SeriesFiltersBar({
  filters,
  onChange,
  onClear,
  categories,
  categoriesStatus,
  countText,
  searchRef,
}: SeriesFiltersBarProps) {
  const accessLabelId = useId()
  const videosLabelId = useId()
  const urlQuery = filters.q ?? ''

  const [text, setText] = useState(urlQuery)
  const [debounced] = useDebouncedValue(text, SEARCH_DEBOUNCE_MS)

  // Le champ reprend la recherche de l'adresse quand celle ci change de l'extérieur (retour arrière,
  // « Effacer les filtres », lien). Une adresse qui vient de la barre elle même (texte envoyé après
  // la pause, ou emporté par un autre filtre) ne touche pas au champ, même si la frappe a continué.
  const [seenUrlQuery, setSeenUrlQuery] = useState(urlQuery)
  if (urlQuery !== seenUrlQuery) {
    setSeenUrlQuery(urlQuery)
    const ownWrite =
      (searchValue(debounced) ?? '') === urlQuery || (searchValue(text) ?? '') === urlQuery
    if (!ownWrite) setText(urlQuery)
  }

  // Après 300 ms sans frappe, la recherche saisie part dans l'adresse. Seul un nouveau texte attendu
  // déclenche l'écriture : un changement d'adresse venu d'ailleurs n'y renvoie jamais l'ancien texte.
  const handledText = useRef(debounced)
  const commitSearch = useEffectEvent((typed: string) => {
    const next = searchValue(typed)
    if (next === filters.q) return
    const mode: HistoryMode = filters.q === undefined && next !== undefined ? 'push' : 'replace'
    onChange({ ...filters, q: next }, mode)
  })
  useEffect(() => {
    if (debounced === handledText.current) return
    handledText.current = debounced
    commitSearch(debounced)
  }, [debounced])

  // Un autre filtre change pendant l'attente : il emporte le texte saisi.
  const withPendingSearch = (next: SeriesFilters): SeriesFilters => ({
    ...next,
    q: searchValue(text),
  })

  const clearSearch = () => {
    setText('')
    if (filters.q !== undefined) onChange({ ...filters, q: undefined }, 'push')
  }

  const tooShort = normalizeSearch(text).length === 1
  const categoryOptions = (categories ?? []).map((category) => ({
    value: category._id,
    label: categoryLabel(category),
  }))
  const active = hasFilters(filters)

  return (
    <Box role="search" aria-label="Filtres des séries" mb="md">
      <Group align="flex-start" gap="md" wrap="wrap">
        <TextInput
          ref={searchRef}
          label="Rechercher un titre"
          value={text}
          onChange={(event) => {
            setText(event.currentTarget.value)
          }}
          maxLength={SEARCH_MAX_LENGTH}
          leftSection={<IconSearch size={16} aria-hidden="true" />}
          rightSection={
            text === '' ? null : (
              <CloseButton size="sm" aria-label="Effacer la recherche" onClick={clearSearch} />
            )
          }
          description={tooShort ? '2 caractères au moins' : undefined}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          w={{ base: '100%', sm: 280 }}
        />
        <Select
          id="series-filter-category"
          label="Catégorie"
          placeholder={
            categoriesStatus === 'pending' ? 'Chargement des catégories' : 'Toutes les catégories'
          }
          data={categoryOptions}
          value={categoriesStatus === 'success' ? (filters.categoryId ?? null) : null}
          onChange={(value) => {
            onChange(withPendingSearch({ ...filters, categoryId: value ?? undefined }), 'push')
          }}
          searchable
          clearable
          nothingFoundMessage="Aucune catégorie"
          disabled={categoriesStatus !== 'success'}
          description={categoriesStatus === 'error' ? 'Catégories indisponibles' : undefined}
          inputWrapperOrder={['label', 'input', 'description', 'error']}
          comboboxProps={{ withinPortal: true }}
          w={{ base: '100%', sm: 240 }}
        />
        <Stack gap={4} role="group" aria-labelledby={accessLabelId}>
          <Text id={accessLabelId} size="sm" fw={500}>
            Accès
          </Text>
          <SegmentedControl
            data={ACCESS_OPTIONS}
            value={filters.access ?? ACCESS_ALL}
            onChange={(value) => {
              onChange(withPendingSearch({ ...filters, access: toAccess(value) }), 'push')
            }}
          />
        </Stack>
        <Stack gap={4} role="group" aria-labelledby={videosLabelId}>
          <Text id={videosLabelId} size="sm" fw={500}>
            Vidéos
          </Text>
          <SegmentedControl
            data={VIDEOS_OPTIONS}
            value={filters.videos ?? VIDEOS_ALL}
            onChange={(value) => {
              onChange(withPendingSearch({ ...filters, videos: toVideos(value) }), 'push')
            }}
          />
        </Stack>
        <Stack gap={4} ml={{ base: 0, sm: 'auto' }} align="flex-end" justify="flex-end">
          <Text size="sm" c="dimmed" aria-live="polite" mih={20}>
            {countText}
          </Text>
          {active ? (
            <Button variant="subtle" size="xs" onClick={onClear}>
              Effacer les filtres
            </Button>
          ) : null}
        </Stack>
      </Group>
    </Box>
  )
}
