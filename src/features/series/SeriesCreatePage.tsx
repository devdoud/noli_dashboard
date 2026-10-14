// Création d'une série (spec 0005, AC-2 à AC-5).
import { Anchor, Group } from '@mantine/core'
import { IconArrowLeft } from '@tabler/icons-react'
import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { createSeries, seriesKeys } from '@/features/series/api'
import { backToListPath, seriesPath } from '@/features/series/navigation'
import { SeriesForm } from '@/features/series/SeriesForm'
import { EMPTY_SERIES_FORM, type SeriesFormValues } from '@/features/series/seriesFormSchema'
import { toCreatePayload } from '@/features/series/seriesPayload'
import { useUnsavedChangesGuard } from '@/features/series/useUnsavedChangesGuard'
import { notifySuccess } from '@/shared/ui/notifySuccess'
import { PageHeader } from '@/shared/ui/PageHeader'

export function SeriesCreatePage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const listPath = backToListPath(location.state)
  const [guardActive, setGuardActive] = useState(false)
  const guard = useUnsavedChangesGuard(guardActive)

  const submit = useCallback(
    async (values: SeriesFormValues) => {
      const created = await createSeries(toCreatePayload(values))
      queryClient.setQueryData(seriesKeys.detail(created._id), created)
      void queryClient.invalidateQueries({ queryKey: seriesKeys.lists })
      guard.allowLeave()
      void navigate(seriesPath(created._id), { state: { from: listPath } })
      notifySuccess('Série créée.')
      return undefined
    },
    [guard, listPath, navigate, queryClient],
  )

  return (
    <>
      <Anchor component={Link} to={listPath} size="sm" mb="xs">
        <Group gap={4} component="span">
          <IconArrowLeft size={16} aria-hidden="true" />
          Retour aux séries
        </Group>
      </Anchor>
      <PageHeader title="Nouvelle série" />
      <SeriesForm
        mode="create"
        base={EMPTY_SERIES_FORM}
        totalEpisodes={0}
        submitLabel="Créer la série"
        pendingLabel="Création en cours"
        onSubmit={submit}
        onGuardChange={setGuardActive}
        listPath={listPath}
      />
      {guard.modal}
    </>
  )
}
