// Fenêtre de création et de modification d'une catégorie (spec 0008, AC-2 à AC-5, AC-9, AC-11).
import {
  Button,
  Divider,
  Group,
  Modal,
  Stack,
  Switch,
  Text,
  Textarea,
  TextInput,
} from '@mantine/core'
import { useForm, type FormErrors } from '@mantine/form'
import { modals } from '@mantine/modals'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import {
  appendCategory,
  createCategory,
  putCategory,
  reloadCategories,
  reloadSeriesLists,
  updateCategory,
  useCategoryImageMutations,
} from '@/features/categories/api'
import {
  badRequestField,
  CATEGORY_MESSAGES,
  conflictField,
  DESCRIPTION_MAX,
  descriptionError,
  isEmptyPatch,
  isNotFound,
  nameError,
  slugError,
  slugify,
  toCategoryCreatePayload,
  toCategoryFormValues,
  toCategoryPatch,
  type CategoryFormValues,
} from '@/features/categories/categoryRules'
import type { Category } from '@/shared/api/categories'
import { IMAGE_SLOTS } from '@/shared/images/imageRules'
import { ImageSlot } from '@/shared/images/ImageSlot'
import { applyFieldErrors } from '@/shared/ui/applyFieldErrors'
import { notifySuccess } from '@/shared/ui/notifySuccess'

export type CategoryModalTarget =
  { readonly mode: 'create' } | { readonly mode: 'edit'; readonly category: Category }

const FIELD_ORDER = ['name', 'description', 'slug'] as const
const FIELD_IDS = {
  name: 'category-name',
  description: 'category-description',
  slug: 'category-slug',
} as const

// Mot clé du backend → champ, pour les autres 400 (spec 0002, applyFieldErrors).
const FIELD_MAP = { name: 'name', description: 'description', slug: 'slug' } as const

function focusFirstError(errors: FormErrors): void {
  const field = FIELD_ORDER.find((name) => errors[name] !== undefined)
  if (field !== undefined) document.getElementById(FIELD_IDS[field])?.focus()
}

function confirmDiscard(): Promise<boolean> {
  return new Promise((resolve) => {
    const state = { settled: false }
    const settle = (value: boolean) => {
      if (state.settled) return
      state.settled = true
      resolve(value)
    }
    modals.openConfirmModal({
      title: 'Abandonner les changements ?',
      centered: true,
      children: <Text size="sm">Vos changements seront perdus.</Text>,
      labels: { confirm: 'Abandonner', cancel: 'Continuer la saisie' },
      confirmProps: { color: 'noliRed.8' },
      cancelProps: { 'data-autofocus': true, variant: 'default' },
      onConfirm: () => {
        settle(true)
      },
      onCancel: () => {
        settle(false)
      },
      onClose: () => {
        settle(false)
      },
    })
  })
}

function CategoryImage({
  category,
  onPendingChange,
  onGone,
}: {
  readonly category: Category
  readonly onPendingChange: (pending: boolean) => void
  readonly onGone: () => void
}) {
  const mutations = useCategoryImageMutations(category._id)
  return (
    <Stack gap="xs">
      <ImageSlot
        slot={IMAGE_SLOTS.category}
        currentUrl={category.imageUrl}
        alt={`Image de la catégorie ${category.name}`}
        nameSuffix={`de « ${category.name} »`}
        mutations={mutations}
        onPendingChange={onPendingChange}
        onGone={onGone}
        maxWidth={200}
      />
      <Text size="xs" c="dimmed">
        JPEG, PNG ou WebP, 5 Mo au plus, 400 × 400 px au moins. L&apos;image est recadrée au carré.
      </Text>
    </Stack>
  )
}

interface CategoryModalProps {
  readonly target: CategoryModalTarget
  /** Dernière liste du serveur (jamais l'ordre en cours) : contrôles et image en direct. */
  readonly categories: readonly Category[]
  readonly onClose: () => void
  readonly onDirtyChange: (dirty: boolean) => void
}

export function CategoryModal({ target, categories, onClose, onDirtyChange }: CategoryModalProps) {
  const queryClient = useQueryClient()
  const editing = target.mode === 'edit' ? target.category : undefined
  const selfId = editing?._id
  // Copie figée à l'ouverture : une mise à jour du cache ne réinitialise pas le formulaire.
  const [base] = useState<CategoryFormValues>(() => toCategoryFormValues(editing))
  const [values, setValues] = useState(base)
  const [slugOpen, setSlugOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [imagePending, setImagePending] = useState(false)
  const submitting = useRef(false)
  const asking = useRef(false)
  // La liste la plus récente, lue au moment de l'envoi.
  const latest = useRef(categories)
  useEffect(() => {
    latest.current = categories
  }, [categories])
  const live = selfId === undefined ? undefined : categories.find((item) => item._id === selfId)

  const form = useForm<CategoryFormValues>({
    mode: 'uncontrolled',
    initialValues: base,
    validate: (current) => {
      const errors: Record<string, string> = {}
      const nameChanged = editing === undefined || current.name.trim() !== base.name.trim()
      const name = nameChanged ? nameError(current.name, latest.current, selfId) : undefined
      if (name !== undefined) errors.name = name
      const description = descriptionError(current.description)
      if (description !== undefined) errors.description = description
      if (slugOpen && selfId !== undefined && current.slug.trim() !== base.slug) {
        const slug = slugError(current.slug.trim(), latest.current, selfId)
        if (slug !== undefined) errors.slug = slug
      }
      return errors
    },
    onValuesChange: (current) => {
      setValues(current)
    },
  })

  const patch = toCategoryPatch(base, values, slugOpen)
  const changed = editing === undefined ? form.isDirty() : !isEmptyPatch(patch)
  const dirty = changed || imagePending
  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])

  const requestClose = async () => {
    if (submitting.current || asking.current) return
    if (dirty) {
      asking.current = true
      const discard = await confirmDiscard()
      asking.current = false
      if (!discard) return
    }
    onClose()
  }

  const gone = () => {
    notifications.show({ color: 'red', title: 'Erreur', message: CATEGORY_MESSAGES.gone })
    reloadCategories(queryClient)
    onClose()
  }

  const handleError = (error: unknown) => {
    const conflict = conflictField(error)
    if (conflict !== undefined) {
      form.setFieldError(
        conflict,
        conflict === 'name' ? CATEGORY_MESSAGES.nameTaken : CATEGORY_MESSAGES.slugTaken,
      )
      document.getElementById(FIELD_IDS[conflict])?.focus()
      return
    }
    const refused = badRequestField(error)
    if (refused !== undefined) {
      form.setFieldError(
        refused,
        refused === 'name' ? CATEGORY_MESSAGES.nameNoAlnum : CATEGORY_MESSAGES.slugReserved,
      )
      document.getElementById(FIELD_IDS[refused])?.focus()
      return
    }
    if (editing !== undefined && isNotFound(error)) {
      gone()
      return
    }
    applyFieldErrors(form, error, FIELD_MAP)
  }

  const handleValid = async (submitted: CategoryFormValues) => {
    if (submitting.current || asking.current) return
    const body = editing === undefined ? undefined : toCategoryPatch(base, submitted, slugOpen)
    // Entrée sans changement n'envoie rien.
    if (body !== undefined && isEmptyPatch(body)) return
    submitting.current = true
    setPending(true)
    try {
      if (editing === undefined || body === undefined) {
        appendCategory(queryClient, await createCategory(toCategoryCreatePayload(submitted)))
        reloadCategories(queryClient)
        notifySuccess('Catégorie créée.')
      } else {
        putCategory(queryClient, await updateCategory(editing._id, body))
        if (body.name !== undefined || body.slug !== undefined || body.isVisible !== undefined) {
          reloadSeriesLists(queryClient)
        }
        notifySuccess('Catégorie modifiée.')
      }
      onClose()
    } catch (error) {
      handleError(error)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const closeSlug = () => {
    form.setFieldValue('slug', base.slug)
    form.clearFieldError('slug')
    setSlugOpen(false)
  }

  const preview = slugify(values.name)
  const title = editing === undefined ? 'Nouvelle catégorie' : `Modifier « ${editing.name} »`

  return (
    <Modal
      opened
      onClose={() => {
        void requestClose()
      }}
      title={title}
      size="lg"
      closeOnClickOutside={!pending}
      closeOnEscape={!pending}
      withCloseButton={!pending}
    >
      <Stack gap="lg">
        <form
          noValidate
          onSubmit={(event) => {
            form.onSubmit(handleValid, focusFirstError)(event)
          }}
        >
          <Stack gap="md">
            <TextInput
              id={FIELD_IDS.name}
              label="Nom"
              withAsterisk
              data-autofocus
              key={form.key('name')}
              {...form.getInputProps('name')}
            />
            <Textarea
              id={FIELD_IDS.description}
              label="Description"
              description={`${String(values.description.trim().length)} / ${String(DESCRIPTION_MAX)}`}
              autosize
              minRows={2}
              maxRows={6}
              maxLength={DESCRIPTION_MAX + 100}
              key={form.key('description')}
              {...form.getInputProps('description')}
            />
            <Switch
              label="Visible dans l'app"
              key={form.key('isVisible')}
              {...form.getInputProps('isVisible', { type: 'checkbox' })}
            />

            {editing === undefined ? (
              <Text size="sm" c="dimmed">
                {`Adresse : /${preview === '' ? '…' : preview}`}
              </Text>
            ) : slugOpen ? (
              <Stack gap="xs">
                <TextInput
                  id={FIELD_IDS.slug}
                  label="Adresse"
                  description="Les liens déjà partagés vers cette catégorie ne marcheront plus."
                  leftSection={<Text size="sm">/</Text>}
                  key={form.key('slug')}
                  {...form.getInputProps('slug')}
                />
                <Group>
                  <Button
                    variant="subtle"
                    size="xs"
                    aria-label="Annuler la modification de l'adresse"
                    onClick={closeSlug}
                  >
                    Annuler
                  </Button>
                </Group>
              </Stack>
            ) : (
              <Group gap="sm" align="center">
                <Text size="sm">{`Adresse : /${base.slug}`}</Text>
                <Button
                  variant="subtle"
                  size="xs"
                  onClick={() => {
                    setSlugOpen(true)
                  }}
                >
                  Modifier l&apos;adresse
                </Button>
              </Group>
            )}
            {editing === undefined ? null : (
              <Text size="xs" c="dimmed">
                Renommer ne change pas l&apos;adresse.
              </Text>
            )}

            <Group justify="flex-end" mt="sm">
              <Button
                variant="default"
                disabled={pending}
                onClick={() => {
                  void requestClose()
                }}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                loading={pending}
                disabled={editing !== undefined && isEmptyPatch(patch)}
              >
                {editing === undefined
                  ? pending
                    ? 'Création en cours'
                    : 'Créer la catégorie'
                  : pending
                    ? 'Enregistrement en cours'
                    : 'Enregistrer'}
              </Button>
            </Group>
          </Stack>
        </form>

        {live === undefined ? null : (
          <>
            <Divider />
            <CategoryImage category={live} onPendingChange={setImagePending} onGone={gone} />
          </>
        )}
      </Stack>
    </Modal>
  )
}
