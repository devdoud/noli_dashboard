// Page « Catégories » (spec 0008, AC-1, AC-6 à AC-8, AC-10 à AC-13) : liste dans l'ordre d'affichage,
// ordre modifié par boutons et enregistré en un envoi, visibilité, suppression.
import {
  ActionIcon,
  Alert,
  Badge,
  Button,
  Group,
  Modal,
  Stack,
  Switch,
  Table,
  Text,
  Tooltip,
  VisuallyHidden,
} from '@mantine/core'
import { notifications } from '@mantine/notifications'
import {
  IconArrowDown,
  IconArrowUp,
  IconPencil,
  IconPhoto,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  deleteCategory,
  dropCategory,
  putCategory,
  reloadCategories,
  reloadSeriesLists,
  reorderCategories,
  updateCategory,
} from '@/features/categories/api'
import {
  moveCategory,
  orderedCategories,
  positionText,
  sameIdSet,
  sameSequence,
  type MoveDirection,
} from '@/features/categories/categoryOrder'
import {
  CATEGORY_MESSAGES,
  countText,
  inUseText,
  isNotFound,
  parseInUse,
} from '@/features/categories/categoryRules'
import { CategoryModal, type CategoryModalTarget } from '@/features/categories/CategoryModal'
import { categoriesKeys, useAllCategories, type Category } from '@/shared/api/categories'
import { isApiError } from '@/shared/api/errors'
import { confirmDanger } from '@/shared/ui/confirmDanger'
import { EmptyState } from '@/shared/ui/EmptyState'
import { ErrorState } from '@/shared/ui/ErrorState'
import { notifyError } from '@/shared/ui/notifyError'
import { notifySuccess } from '@/shared/ui/notifySuccess'
import { PageHeader } from '@/shared/ui/PageHeader'
import { TableSkeleton } from '@/shared/ui/TableSkeleton'
import { useUnsavedChangesGuard } from '@/shared/ui/useUnsavedChangesGuard'

const BLOCKED_ID = 'categories-blocked-by-order'
const SKELETON_COLUMNS = [
  { key: 'order', header: 'Ordre', width: 140 },
  { key: 'image', header: 'Image', width: 72 },
  { key: 'name', header: 'Nom' },
  { key: 'slug', header: 'Adresse' },
  { key: 'visible', header: 'Visible', width: 100 },
  { key: 'actions', header: 'Actions', width: 96 },
]

function Thumbnail({ url }: { readonly url: string | undefined }) {
  const [failed, setFailed] = useState(false)
  if (url === undefined || failed) {
    return <IconPhoto size={24} aria-hidden="true" color="var(--mantine-color-dimmed)" />
  }
  return (
    <img
      src={url}
      alt=""
      width={40}
      height={40}
      style={{ objectFit: 'cover', borderRadius: 4, display: 'block' }}
      onError={() => {
        setFailed(true)
      }}
    />
  )
}

interface InUse {
  readonly category: Category
  readonly seriesCount?: number
}

interface FocusTarget {
  readonly id: string
  readonly direction: MoveDirection
}

function focusHeading(): void {
  const heading = document.querySelector<HTMLElement>('main h1')
  if (heading === null) return
  heading.setAttribute('tabindex', '-1')
  heading.focus()
}

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const [draftIds, setDraftIds] = useState<readonly string[]>()
  const query = useAllCategories({
    refetchOnMount: 'always',
    refetchOnWindowFocus: draftIds === undefined,
  })
  const categories = query.data
  const [savingOrder, setSavingOrder] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const [target, setTarget] = useState<CategoryModalTarget>()
  const [modalDirty, setModalDirty] = useState(false)
  const [toggling, setToggling] = useState<string>()
  const [deleting, setDeleting] = useState<string>()
  const [inUse, setInUse] = useState<InUse>()
  const [focusTarget, setFocusTarget] = useState<FocusTarget>()
  const saving = useRef(false)
  const moveButtons = useRef(new Map<string, HTMLButtonElement>())

  const serverIds = (categories ?? []).map((category) => category._id)
  // Un ordre en cours ne vaut que pour la liste sur laquelle il a commencé.
  const draftValid = draftIds !== undefined && sameIdSet(draftIds, serverIds)
  const draft = draftValid ? draftIds : undefined
  const blocked = draft !== undefined || savingOrder
  const shown = orderedCategories(categories ?? [], draft)

  const guard = useUnsavedChangesGuard(draft !== undefined || modalDirty)

  // La liste a changé (autre admin) pendant un ordre en cours : il est abandonné (spec 0008).
  // L'ordre abandonné est déjà ignoré (`draft` dérivé) ; l'effet prévient une seule fois.
  const notifiedStale = useRef<readonly string[]>(undefined)
  useEffect(() => {
    if (draftIds === undefined || categories === undefined || draftValid) return
    if (notifiedStale.current === draftIds) return
    notifiedStale.current = draftIds
    notifications.show({ color: 'red', title: 'Erreur', message: CATEGORY_MESSAGES.orderChanged })
  }, [draftIds, categories, draftValid])

  // Après un déplacement, le focus reste sur le bouton de la ligne déplacée (AC-12).
  useLayoutEffect(() => {
    if (focusTarget === undefined) return
    const own = moveButtons.current.get(`${focusTarget.id}:${focusTarget.direction}`)
    const other = moveButtons.current.get(
      `${focusTarget.id}:${focusTarget.direction === 'up' ? 'down' : 'up'}`,
    )
    const button = own !== undefined && !own.disabled ? own : other
    button?.focus()
  }, [focusTarget, draftIds])

  const onModalDirty = useCallback((dirty: boolean) => {
    setModalDirty(dirty)
  }, [])

  const move = (category: Category, direction: MoveDirection) => {
    if (savingOrder || categories === undefined) return
    const current = draft ?? serverIds
    const next = moveCategory(current, category._id, direction)
    if (next === current) return
    const position = next.indexOf(category._id) + 1
    setDraftIds(sameSequence(next, serverIds) ? undefined : next)
    setAnnouncement(positionText(category.name, position, next.length))
    setFocusTarget({ id: category._id, direction })
  }

  const saveOrder = async () => {
    if (draft === undefined || saving.current) return
    saving.current = true
    setSavingOrder(true)
    try {
      const saved = await reorderCategories(draft)
      queryClient.setQueryData(categoriesKeys.all, saved)
      setDraftIds(undefined)
      setAnnouncement('')
      notifySuccess('Ordre enregistré.')
      focusHeading()
    } catch (error) {
      if (isApiError(error) && error.kind === 'http' && error.status === 400) {
        setDraftIds(undefined)
        setAnnouncement('')
        reloadCategories(queryClient)
        notifications.show({
          color: 'red',
          title: 'Erreur',
          message: CATEGORY_MESSAGES.orderChanged,
        })
      } else {
        notifyError(error)
      }
    } finally {
      saving.current = false
      setSavingOrder(false)
    }
  }

  const cancelOrder = () => {
    setDraftIds(undefined)
    setAnnouncement('')
    focusHeading()
  }

  const gone = () => {
    notifications.show({ color: 'red', title: 'Erreur', message: CATEGORY_MESSAGES.gone })
    reloadCategories(queryClient)
  }

  const setVisibility = async (category: Category, isVisible: boolean) => {
    setToggling(category._id)
    try {
      putCategory(queryClient, await updateCategory(category._id, { isVisible }))
      reloadSeriesLists(queryClient)
      notifySuccess(isVisible ? 'Catégorie affichée.' : 'Catégorie masquée.')
      return true
    } catch (error) {
      if (isNotFound(error)) gone()
      else notifyError(error)
      return false
    } finally {
      setToggling(undefined)
    }
  }

  const toggle = async (category: Category) => {
    if (blocked || toggling !== undefined) return
    if (category.isVisible) {
      const confirmed = await confirmDanger({
        title: `Masquer « ${category.name} » ?`,
        message:
          "La catégorie disparaîtra de l'app et de l'étiquette de ses séries. Ses séries restent visibles.",
        confirmLabel: 'Masquer',
      })
      if (!confirmed) return
    }
    await setVisibility(category, !category.isVisible)
  }

  const remove = async (category: Category) => {
    if (blocked || deleting !== undefined) return
    const confirmed = await confirmDanger({
      title: `Supprimer « ${category.name} » ?`,
      message: 'La catégorie et son image seront supprimées définitivement.',
    })
    if (!confirmed) return
    setDeleting(category._id)
    try {
      await deleteCategory(category._id)
      dropCategory(queryClient, category._id)
      reloadCategories(queryClient)
      reloadSeriesLists(queryClient)
      notifySuccess('Catégorie supprimée.')
    } catch (error) {
      const refused = parseInUse(error)
      if (refused !== undefined) {
        setInUse({ category, ...refused })
      } else if (isNotFound(error)) {
        notifySuccess('Cette catégorie avait déjà été supprimée.')
        reloadCategories(queryClient)
      } else {
        notifyError(error)
      }
    } finally {
      setDeleting(undefined)
    }
  }

  const hideInstead = async () => {
    if (inUse === undefined) return
    const done = await setVisibility(inUse.category, false)
    if (done) setInUse(undefined)
  }

  const blockedProps = blocked
    ? { 'aria-disabled': true, 'data-disabled': true, 'aria-describedby': BLOCKED_ID }
    : {}
  const loaded = categories !== undefined

  return (
    <>
      <PageHeader
        title="Catégories"
        description={loaded && !query.isError ? countText(categories.length) : undefined}
        actions={
          <Button
            leftSection={<IconPlus size={16} aria-hidden="true" />}
            disabled={!loaded}
            {...blockedProps}
            onClick={() => {
              if (!blocked) setTarget({ mode: 'create' })
            }}
          >
            Nouvelle catégorie
          </Button>
        }
      />
      <VisuallyHidden role="status" aria-live="polite">
        {announcement}
      </VisuallyHidden>

      {draft !== undefined || savingOrder ? (
        <Alert color="noliAmber" variant="light" mb="md" role="status" title="Ordre modifié">
          <Stack gap="sm">
            <Text size="sm" id={BLOCKED_ID}>
              {CATEGORY_MESSAGES.blockedByOrder}
            </Text>
            <Group gap="sm">
              <Button
                loading={savingOrder}
                onClick={() => {
                  void saveOrder()
                }}
              >
                {savingOrder ? 'Enregistrement en cours' : "Enregistrer l'ordre"}
              </Button>
              <Button variant="default" disabled={savingOrder} onClick={cancelOrder}>
                Annuler
              </Button>
            </Group>
          </Stack>
        </Alert>
      ) : null}

      {query.isError && !loaded ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} />
      ) : !loaded ? (
        <TableSkeleton columns={SKELETON_COLUMNS} caption="Catégories dans l'ordre d'affichage" />
      ) : categories.length === 0 ? (
        <EmptyState
          title="Aucune catégorie pour le moment"
          description="Créez la première catégorie du catalogue."
          action={
            <Button
              leftSection={<IconPlus size={16} aria-hidden="true" />}
              onClick={() => {
                setTarget({ mode: 'create' })
              }}
            >
              Nouvelle catégorie
            </Button>
          }
        />
      ) : (
        <Table.ScrollContainer minWidth={760}>
          <Table highlightOnHover>
            <Table.Caption>
              <VisuallyHidden>Catégories dans l&apos;ordre d&apos;affichage</VisuallyHidden>
            </Table.Caption>
            <Table.Thead>
              <Table.Tr>
                {SKELETON_COLUMNS.map((column) => (
                  <Table.Th key={column.key} scope="col" w={column.width}>
                    {column.header}
                  </Table.Th>
                ))}
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {shown.map((category, index) => {
                const busy = toggling === category._id || deleting === category._id
                return (
                  <Table.Tr key={category._id}>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Text size="sm" w={24} ta="right">
                          {index + 1}
                        </Text>
                        <Tooltip label="Monter">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Monter « ${category.name} »`}
                            disabled={index === 0 || savingOrder}
                            ref={(node) => {
                              if (node === null) moveButtons.current.delete(`${category._id}:up`)
                              else moveButtons.current.set(`${category._id}:up`, node)
                            }}
                            onClick={() => {
                              move(category, 'up')
                            }}
                          >
                            <IconArrowUp size={16} aria-hidden="true" />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Descendre">
                          <ActionIcon
                            variant="subtle"
                            color="gray"
                            aria-label={`Descendre « ${category.name} »`}
                            disabled={index === shown.length - 1 || savingOrder}
                            ref={(node) => {
                              if (node === null) moveButtons.current.delete(`${category._id}:down`)
                              else moveButtons.current.set(`${category._id}:down`, node)
                            }}
                            onClick={() => {
                              move(category, 'down')
                            }}
                          >
                            <IconArrowDown size={16} aria-hidden="true" />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Thumbnail key={category.imageUrl} url={category.imageUrl} />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs" wrap="nowrap">
                        <Text size="sm" fw={600}>
                          {category.name}
                        </Text>
                        {category.isVisible ? null : (
                          <Badge variant="light" color="gray" style={{ flexShrink: 0 }}>
                            Masquée
                          </Badge>
                        )}
                      </Group>
                      {category.description === undefined ? null : (
                        <Text size="xs" c="dimmed" lineClamp={1} maw={360}>
                          {category.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Text size="sm" ff="monospace">{`/${category.slug}`}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Switch
                        aria-label={`Visible : ${category.name}`}
                        checked={category.isVisible}
                        disabled={busy || savingOrder}
                        {...blockedProps}
                        onChange={() => {
                          void toggle(category)
                        }}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} wrap="nowrap">
                        <Tooltip label="Modifier">
                          <ActionIcon
                            variant="subtle"
                            aria-label={`Modifier « ${category.name} »`}
                            disabled={busy || savingOrder}
                            {...blockedProps}
                            onClick={() => {
                              if (!blocked) setTarget({ mode: 'edit', category })
                            }}
                          >
                            <IconPencil size={16} aria-hidden="true" />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Supprimer">
                          <ActionIcon
                            variant="subtle"
                            color="noliRed"
                            aria-label={`Supprimer « ${category.name} »`}
                            loading={deleting === category._id}
                            disabled={busy || savingOrder}
                            {...blockedProps}
                            onClick={() => {
                              void remove(category)
                            }}
                          >
                            <IconTrash size={16} aria-hidden="true" />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                )
              })}
            </Table.Tbody>
          </Table>
        </Table.ScrollContainer>
      )}

      {target === undefined || categories === undefined ? null : (
        <CategoryModal
          key={target.mode === 'create' ? 'create' : target.category._id}
          target={target}
          categories={categories}
          onClose={() => {
            setTarget(undefined)
            setModalDirty(false)
          }}
          onDirtyChange={onModalDirty}
        />
      )}

      <Modal
        opened={inUse !== undefined}
        onClose={() => {
          setInUse(undefined)
        }}
        title="Suppression impossible"
        centered
      >
        {inUse === undefined ? null : (
          <Stack gap="md">
            <Text size="sm">
              {`${inUseText(inUse.category.name, inUse.seriesCount)} Retirez la de ces séries, ou masquez la.`}
            </Text>
            <Group justify="flex-end">
              {inUse.category.isVisible ? (
                <Button
                  variant="light"
                  loading={toggling === inUse.category._id}
                  onClick={() => {
                    void hideInstead()
                  }}
                >
                  Masquer plutôt
                </Button>
              ) : null}
              <Button
                variant="default"
                data-autofocus
                onClick={() => {
                  setInUse(undefined)
                }}
              >
                Fermer
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
      {guard.modal}
    </>
  )
}
