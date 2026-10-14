// Formulaire de série, partagé par la création et la fiche (spec 0005, « Formulaire »).
import {
  Alert,
  Anchor,
  Box,
  Button,
  Group,
  Input,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { schemaResolver, useForm, type FormErrors } from '@mantine/form'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router'
import { categoriesKeys, useAllCategories } from '@/features/series/api'
import { countryGroups } from '@/features/series/countries'
import { LanguagesInput } from '@/features/series/LanguagesInput'
import {
  DESCRIPTION_MAX,
  fieldId,
  firstInvalidField,
  makeSeriesFormSchema,
  rootField,
  type SeriesFormField,
  type SeriesFormValues,
} from '@/features/series/seriesFormSchema'
import { changedFields } from '@/features/series/seriesPayload'
import { isApiError } from '@/shared/api/errors'
import { applyFieldErrors } from '@/shared/ui/applyFieldErrors'

export const TITLE_TAKEN_MESSAGE = 'Ce titre est déjà utilisé par une autre série.'
export const SERIES_GONE_MESSAGE = "Cette série n'existe plus."

// Mot clé du backend → champ du formulaire, pour les 400 (spec 0002, applyFieldErrors).
const FIELD_MAP = {
  title: 'title',
  description: 'description',
  categoryIds: 'categor',
  languages: 'language',
  country: 'country',
  releaseYear: 'year',
  freeEpisodeCount: 'freeEpisode',
  isPremium: 'premium',
} as const

const STATUS_OPTIONS = [
  { value: 'ongoing', label: 'En cours' },
  { value: 'completed', label: 'Terminée' },
]

export interface SeriesFormProps {
  readonly mode: 'create' | 'edit'
  /** Valeurs de référence : vides à la création, tirées de la dernière réponse sur la fiche. */
  readonly base: SeriesFormValues
  /** Nombre d'épisodes actuel, pour l'indication de la section Accès (0 à la création). */
  readonly totalEpisodes: number
  readonly submitLabel: string
  readonly pendingLabel: string
  /** Envoie le formulaire ; renvoie la nouvelle base (fiche) ou rien (création). Lève en cas d'erreur. */
  readonly onSubmit: (values: SeriesFormValues) => Promise<SeriesFormValues | undefined>
  /** Vrai tant qu'il y a des changements non enregistrés et qu'aucun envoi n'est en cours. */
  readonly onGuardChange: (active: boolean) => void
  /** Destination du lien de l'alerte « Cette série n'existe plus. ». */
  readonly listPath: string
  readonly onLeaveGone?: () => void
}

function focusField(field: SeriesFormField): void {
  document.getElementById(fieldId(field))?.focus()
}

function errorsForChangedFields(
  errors: FormErrors,
  changed: ReadonlySet<SeriesFormField>,
): FormErrors {
  return Object.fromEntries(
    Object.entries(errors).filter(([path]) => changed.has(rootField(path) as SeriesFormField)),
  )
}

function isConflictWithoutCode(error: unknown): boolean {
  return (
    isApiError(error) && error.kind === 'http' && error.status === 409 && error.code === undefined
  )
}

function isNotFound(error: unknown): boolean {
  return isApiError(error) && error.kind === 'http' && error.status === 404
}

function mentionsUnknownCategory(error: unknown): boolean {
  if (!isApiError(error) || error.status !== 400) return false
  const message = error.backendMessage
  const text = typeof message === 'string' ? message : (message ?? []).join(' ')
  return text.toLowerCase().includes('unknown category')
}

export function SeriesForm({
  mode,
  base,
  totalEpisodes,
  submitLabel,
  pendingLabel,
  onSubmit,
  onGuardChange,
  listPath,
  onLeaveGone,
}: SeriesFormProps) {
  const queryClient = useQueryClient()
  const categories = useAllCategories()
  const baseRef = useRef(base)
  const submitting = useRef(false)
  const [pending, setPending] = useState(false)
  const [gone, setGone] = useState(false)
  const [values, setValues] = useState<SeriesFormValues>(base)

  const resolver = useMemo(
    () =>
      schemaResolver(makeSeriesFormSchema({ mode, initialReleaseYear: base.releaseYear }), {
        sync: true,
      }),
    [mode, base.releaseYear],
  )
  const resolverRef = useRef(resolver)
  // La validation lit la base et les règles à jour au moment de l'envoi, pas au premier rendu.
  useEffect(() => {
    baseRef.current = base
    resolverRef.current = resolver
  }, [base, resolver])

  const form = useForm<SeriesFormValues>({
    mode: 'uncontrolled',
    initialValues: base,
    // En modification, seuls les champs changés sont validés : une valeur ancienne hors règles
    // ne bloque jamais l'enregistrement d'un autre champ (AC-7).
    validate: (current) => {
      const errors = resolverRef.current(current)
      return mode === 'edit'
        ? errorsForChangedFields(errors, changedFields(baseRef.current, current))
        : errors
    },
    onValuesChange: (current) => {
      setValues(current)
    },
  })

  // « Modifié » suit les champs changés, même ceux qui ne partent pas (une année vidée),
  // pour que leur message d'erreur puisse s'afficher à l'envoi.
  const dirty = mode === 'edit' ? changedFields(base, values).size > 0 : form.isDirty()
  useEffect(() => {
    onGuardChange(dirty && !pending)
  }, [dirty, pending, onGuardChange])

  const handleError = (error: unknown) => {
    if (isConflictWithoutCode(error)) {
      form.setFieldError('title', TITLE_TAKEN_MESSAGE)
      focusField('title')
      return
    }
    if (mode === 'edit' && isNotFound(error)) {
      setGone(true)
      return
    }
    if (mentionsUnknownCategory(error)) {
      void queryClient.invalidateQueries({ queryKey: categoriesKeys.all })
    }
    applyFieldErrors(form, error, FIELD_MAP)
  }

  const handleValid = async (submitted: SeriesFormValues) => {
    if (submitting.current) return
    submitting.current = true
    setPending(true)
    try {
      const nextBase = await onSubmit(submitted)
      if (nextBase !== undefined) {
        form.setInitialValues(nextBase)
        form.reset()
        setValues(nextBase)
      }
    } catch (error) {
      handleError(error)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }
  const handleInvalid = (errors: FormErrors) => {
    const field = firstInvalidField(errors)
    if (field !== undefined) focusField(field)
  }

  const categoryData = (categories.data ?? []).map((category) => ({
    value: category._id,
    label: category.isVisible ? category.name : `${category.name} (masquée)`,
  }))

  const countryInputProps = form.getInputProps('country')

  return (
    <form
      noValidate
      onSubmit={(event) => {
        form.onSubmit(handleValid, handleInvalid)(event)
      }}
    >
      <Stack gap="lg">
        {gone ? (
          <Alert color="noliRed" role="alert">
            <Text size="sm">
              {SERIES_GONE_MESSAGE}{' '}
              <Anchor component={Link} to={listPath} onClick={onLeaveGone} size="sm">
                Retour aux séries
              </Anchor>
            </Text>
          </Alert>
        ) : null}

        <Paper withBorder p="lg">
          <Stack gap="md">
            <Title order={2} size="h4">
              Informations
            </Title>
            <TextInput
              id={fieldId('title')}
              label="Titre"
              withAsterisk
              key={form.key('title')}
              {...form.getInputProps('title')}
            />
            <Textarea
              id={fieldId('description')}
              label="Description"
              autosize
              minRows={4}
              maxRows={12}
              description={`${String(values.description.trim().length)} / 2 000`}
              maxLength={DESCRIPTION_MAX + 200}
              key={form.key('description')}
              {...form.getInputProps('description')}
            />
            {categories.isError ? (
              <Alert color="noliRed" title="Catégories">
                <Group justify="space-between" gap="sm">
                  <Text size="sm">Impossible de charger les catégories.</Text>
                  <Button
                    size="xs"
                    variant="light"
                    color="noliRed"
                    onClick={() => {
                      void categories.refetch()
                    }}
                  >
                    Réessayer
                  </Button>
                </Group>
              </Alert>
            ) : (
              <MultiSelect
                id={fieldId('categoryIds')}
                label="Catégories"
                withAsterisk
                searchable
                data={categoryData}
                disabled={categories.isPending}
                placeholder={categories.isPending ? 'Chargement des catégories…' : undefined}
                nothingFoundMessage="Aucune catégorie trouvée"
                key={form.key('categoryIds')}
                {...form.getInputProps('categoryIds')}
              />
            )}
            <Box>
              <Input.Label id="serie-status-label" component="div">
                Statut
              </Input.Label>
              <Box role="radiogroup" aria-labelledby="serie-status-label">
                <SegmentedControl
                  id={fieldId('status')}
                  data={STATUS_OPTIONS}
                  key={form.key('status')}
                  {...form.getInputProps('status')}
                />
              </Box>
            </Box>
            <LanguagesInput
              id={fieldId('languages')}
              label="Langues"
              key={form.key('languages')}
              {...form.getInputProps('languages')}
            />
            <Select
              id={fieldId('country')}
              label="Pays"
              searchable
              clearable
              data={countryGroups(base.country)}
              nothingFoundMessage="Aucun pays trouvé"
              key={form.key('country')}
              {...countryInputProps}
              onChange={(value: string | null) => {
                form.setFieldValue('country', value ?? '', { forceUpdate: false })
              }}
            />
            <NumberInput
              id={fieldId('releaseYear')}
              label="Année de sortie"
              allowDecimal={false}
              allowNegative={false}
              clampBehavior="none"
              min={1888}
              max={2100}
              key={form.key('releaseYear')}
              {...form.getInputProps('releaseYear')}
            />
          </Stack>
        </Paper>

        <Paper withBorder p="lg">
          <Stack gap="md">
            <Title order={2} size="h4">
              Accès
            </Title>
            <Switch
              id={fieldId('isPremium')}
              label="Série premium"
              key={form.key('isPremium')}
              {...form.getInputProps('isPremium', { type: 'checkbox' })}
            />
            {values.isPremium ? (
              <NumberInput
                id={fieldId('freeEpisodeCount')}
                label="Épisodes gratuits"
                description={`La série a actuellement ${String(totalEpisodes)} épisode${totalEpisodes > 1 ? 's' : ''}.`}
                allowDecimal={false}
                allowNegative={false}
                clampBehavior="none"
                min={0}
                max={10_000}
                key={form.key('freeEpisodeCount')}
                {...form.getInputProps('freeEpisodeCount')}
              />
            ) : null}
          </Stack>
        </Paper>

        <Group justify="flex-end">
          <Button
            type="submit"
            loading={pending}
            disabled={mode === 'edit' && !dirty}
            aria-label={pending ? pendingLabel : undefined}
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  )
}
