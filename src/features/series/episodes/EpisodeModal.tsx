// Fenêtre d'ajout et de modification d'un épisode (spec 0006, AC-2 à AC-6, AC-13, AC-15, AC-16).
import {
  Alert,
  Button,
  Divider,
  Group,
  Input,
  Modal,
  NumberInput,
  Stack,
  Text,
  Textarea,
  TextInput,
  Title,
} from '@mantine/core'
import { schemaResolver, useForm, type FormErrors } from '@mantine/form'
import { notifications } from '@mantine/notifications'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { addEpisode, importVideo, seriesKeys, updateEpisode } from '@/features/series/api'
import { confirmDiscard, confirmPublish } from '@/features/series/episodes/episodeConfirms'
import {
  changedEpisodeFields,
  EPISODE_DESCRIPTION_MAX,
  EPISODE_FORM_FIELDS,
  emptyEpisodeForm,
  episodeFieldId,
  fieldOfEditable,
  makeEpisodeSchema,
  splitDuration,
  toEpisodeCreatePayload,
  toEpisodeFormValues,
  toEpisodePatch,
  type EpisodeFormField,
  type EpisodeFormValues,
} from '@/features/series/episodes/episodeForm'
import {
  findEpisode,
  nextEpisodeNumber,
  suggestedSeason,
} from '@/features/series/episodes/episodeModel'
import { EpisodeVideoActions } from '@/features/series/episodes/EpisodeVideoActions'
import { useVideoUploads } from '@/features/series/episodes/uploads/uploadsContext'
import { useVideoDraft } from '@/features/series/episodes/useVideoDraft'
import {
  EPISODE_GONE_MESSAGE,
  importRefusal,
  isHttpStatus,
  VIDEO_MESSAGE_OVERRIDES,
  VIDEO_NOT_STARTED_MESSAGE,
} from '@/features/series/episodes/videoMessages'
import { hasDraftErrors, hasVideo, type VideoDraft } from '@/features/series/episodes/videoSource'
import { VideoSourceInput } from '@/features/series/episodes/VideoSourceInput'
import { SERIES_LIST_PATH } from '@/features/series/navigation'
import type { AdminSeries } from '@/features/series/schemas'
import { SERIES_GONE_MESSAGE } from '@/features/series/SeriesForm'
import { isApiError } from '@/shared/api/errors'
import { toUserMessage } from '@/shared/api/messages'
import { applyFieldErrors } from '@/shared/ui/applyFieldErrors'
import { notifyError } from '@/shared/ui/notifyError'
import { notifySuccess } from '@/shared/ui/notifySuccess'

export type EpisodeModalTarget =
  | { readonly mode: 'create' }
  | { readonly mode: 'edit'; readonly seasonNumber: number; readonly episodeNumber: number }

export const EPISODE_EXISTS_MESSAGE = 'Cet épisode existe déjà dans cette saison.'

// Mot clé du backend → champ du formulaire, pour les autres 400 (spec 0002, applyFieldErrors).
const FIELD_MAP = {
  seasonNumber: 'season',
  episodeNumber: 'episodeNumber',
  title: 'title',
  description: 'description',
  durationMinutes: 'duration',
  releaseDate: 'releaseDate',
} as const

const DURATION_ERROR_ID = 'episode-duration-error'
const VIDEO_FILE_ID = 'episode-video-file'
const VIDEO_LINK_ID = 'episode-video-link'

/** Transmet une saisie au `onChange` de `getInputProps` (typé `any` par Mantine). */
function forward(props: { readonly onChange: (value: unknown) => void }, value: unknown): void {
  props.onChange(value)
}

function focusById(id: string): void {
  document.getElementById(id)?.focus()
}

function firstInvalidField(errors: FormErrors): EpisodeFormField | undefined {
  return EPISODE_FORM_FIELDS.find((field) => errors[field] !== undefined)
}

function isEpisodeExists(error: unknown): boolean {
  if (!isApiError(error) || error.kind !== 'http' || error.status !== 400) return false
  const message = error.backendMessage
  const text = typeof message === 'string' ? message : (message ?? []).join(' ')
  return text.toLowerCase().includes('already exists')
}

function initialValues(target: EpisodeModalTarget, series: AdminSeries): EpisodeFormValues {
  if (target.mode === 'edit') {
    const episode = findEpisode(series.episodes, target.seasonNumber, target.episodeNumber)
    return episode === undefined
      ? emptyEpisodeForm(target.seasonNumber, target.episodeNumber)
      : toEpisodeFormValues(episode)
  }
  const season = suggestedSeason(series.episodes)
  return emptyEpisodeForm(season, nextEpisodeNumber(series.episodes, season))
}

interface EpisodeModalProps {
  readonly target: EpisodeModalTarget
  readonly series: AdminSeries
  readonly onClose: () => void
  readonly onDirtyChange: (dirty: boolean) => void
  /** Avant une navigation voulue (série disparue) : la protection de la page est levée. */
  readonly onLeave: () => void
}

export function EpisodeModal({
  target,
  series,
  onClose,
  onDirtyChange,
  onLeave,
}: EpisodeModalProps) {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const uploads = useVideoUploads()
  const video = useVideoDraft()
  const creating = target.mode === 'create'
  // Copie figée à l'ouverture : « modifié » et le corps du PATCH s'y comparent (AC-6).
  const [base] = useState(() => initialValues(target, series))
  const [resolver] = useState(() =>
    schemaResolver(makeEpisodeSchema({ mode: target.mode, initialReleaseDate: base.releaseDate }), {
      sync: true,
    }),
  )
  const [values, setValues] = useState(base)
  const [pending, setPending] = useState(false)
  const submitting = useRef(false)
  const asking = useRef(false)
  const numberEdited = useRef(false)
  const durationEdited = useRef(false)
  const live =
    target.mode === 'edit'
      ? findEpisode(series.episodes, target.seasonNumber, target.episodeNumber)
      : undefined

  const form = useForm<EpisodeFormValues>({
    mode: 'uncontrolled',
    initialValues: base,
    // En modification, seuls les champs changés sont validés (comme la fiche, spec 0005).
    validate: (current) => {
      const errors = resolver(current)
      if (creating) return errors
      const allowed = new Set(
        [...changedEpisodeFields(base, current)].flatMap((field) => fieldOfEditable(field)),
      )
      return Object.fromEntries(
        Object.entries(errors).filter(([path]) => allowed.has(path as EpisodeFormField)),
      )
    },
    onValuesChange: (current) => {
      setValues(current)
    },
  })

  const infoChanged = creating ? form.isDirty() : changedEpisodeFields(base, values).size > 0
  const dirty = infoChanged || (creating && (hasVideo(video.draft) || video.draft.link !== ''))
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

  const putSeries = (saved: AdminSeries) => {
    queryClient.setQueryData(seriesKeys.detail(series._id), saved)
    void queryClient.invalidateQueries({ queryKey: seriesKeys.lists })
  }

  // La vidéo d'un nouvel épisode part après sa création ; un échec laisse l'épisode créé (AC-4).
  const startVideo = (seasonNumber: number, episodeNumber: number, draft: VideoDraft) => {
    if (draft.tab === 'file') {
      if (draft.file !== undefined) {
        uploads.enqueue({ seasonNumber, episodeNumber, file: draft.file, fromCreation: true })
      }
      return
    }
    importVideo(series._id, seasonNumber, episodeNumber, draft.link)
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: seriesKeys.detail(series._id) })
      })
      .catch((error: unknown) => {
        if (isApiError(error) && error.kind === 'session-ended') return
        const reason = importRefusal(error) ?? toUserMessage(error, VIDEO_MESSAGE_OVERRIDES).message
        notifications.show({
          color: 'red',
          title: 'Erreur',
          autoClose: 8_000,
          message: `${VIDEO_NOT_STARTED_MESSAGE} ${reason}`,
        })
      })
  }

  const handleError = (error: unknown) => {
    if (creating && isEpisodeExists(error)) {
      form.setFieldError('episodeNumber', EPISODE_EXISTS_MESSAGE)
      focusById(episodeFieldId('episodeNumber'))
      return
    }
    if (creating && isHttpStatus(error, 404)) {
      notifyError(error, { '404': SERIES_GONE_MESSAGE })
      onLeave()
      void navigate(SERIES_LIST_PATH, { replace: true })
      return
    }
    if (isHttpStatus(error, 404)) {
      notifyError(error, { '404': EPISODE_GONE_MESSAGE })
      void queryClient.invalidateQueries({ queryKey: seriesKeys.detail(series._id) })
      onClose()
      return
    }
    if (isHttpStatus(error, 409)) {
      notifyError(error)
      return
    }
    if (applyFieldErrors(form, error, FIELD_MAP)) {
      const field = firstInvalidField(form.errors)
      if (field !== undefined) focusById(episodeFieldId(field))
    }
  }

  const handleValid = async (submitted: EpisodeFormValues) => {
    if (submitting.current || asking.current) return
    const withVideo = creating && hasVideo(video.draft)
    if (creating && hasDraftErrors(video.validate(false))) {
      focusById(video.draft.tab === 'file' ? VIDEO_FILE_ID : VIDEO_LINK_ID)
      return
    }
    submitting.current = true
    if (withVideo) {
      asking.current = true
      const publish = await confirmPublish()
      asking.current = false
      if (!publish) {
        submitting.current = false
        return
      }
    }
    setPending(true)
    try {
      if (target.mode === 'create') {
        const payload = toEpisodeCreatePayload(submitted)
        const draft = video.draft
        putSeries(await addEpisode(series._id, payload))
        notifySuccess('Épisode ajouté.')
        onClose()
        if (withVideo) startVideo(payload.seasonNumber, payload.episodeNumber, draft)
      } else {
        const patch = toEpisodePatch(base, submitted)
        putSeries(await updateEpisode(series._id, target.seasonNumber, target.episodeNumber, patch))
        notifySuccess('Épisode modifié.')
        onClose()
      }
    } catch (error) {
      handleError(error)
    } finally {
      submitting.current = false
      setPending(false)
    }
  }

  const handleInvalid = (errors: FormErrors) => {
    if (creating) video.validate(false)
    const field = firstInvalidField(errors)
    if (field !== undefined) focusById(episodeFieldId(field))
  }

  const seasonProps = form.getInputProps('seasonNumber')
  const numberProps = form.getInputProps('episodeNumber')
  const minutesProps = form.getInputProps('durationMinutes')
  const secondsProps = form.getInputProps('durationSeconds')
  const durationError = form.errors.durationMinutes ?? form.errors.durationSeconds
  const title =
    target.mode === 'create'
      ? 'Ajouter un épisode'
      : `Modifier l'épisode ${String(target.episodeNumber)} de la saison ${String(target.seasonNumber)}`
  const submitLabel = creating ? "Ajouter l'épisode" : 'Enregistrer'
  const pendingLabel = creating ? 'Ajout en cours' : 'Enregistrement en cours'

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
            form.onSubmit(handleValid, handleInvalid)(event)
          }}
        >
          <Stack gap="md">
            {target.mode === 'edit' && live === undefined ? (
              <Alert color="noliRed" role="alert">
                <Text size="sm">{EPISODE_GONE_MESSAGE}</Text>
              </Alert>
            ) : null}
            {target.mode === 'create' ? (
              <Group grow align="flex-start">
                <NumberInput
                  id={episodeFieldId('seasonNumber')}
                  label="Saison"
                  withAsterisk
                  data-autofocus
                  min={1}
                  max={100}
                  allowDecimal={false}
                  allowNegative={false}
                  clampBehavior="none"
                  key={form.key('seasonNumber')}
                  {...seasonProps}
                  onChange={(value) => {
                    forward(seasonProps, value)
                    // Le numéro suit la saison tant que l'admin ne l'a pas modifié (AC-2).
                    if (!numberEdited.current && typeof value === 'number' && value >= 1) {
                      form.setFieldValue('episodeNumber', nextEpisodeNumber(series.episodes, value))
                    }
                  }}
                />
                <NumberInput
                  id={episodeFieldId('episodeNumber')}
                  label="Numéro"
                  withAsterisk
                  min={1}
                  max={1000}
                  allowDecimal={false}
                  allowNegative={false}
                  clampBehavior="none"
                  key={form.key('episodeNumber')}
                  {...numberProps}
                  onChange={(value) => {
                    numberEdited.current = true
                    forward(numberProps, value)
                  }}
                />
              </Group>
            ) : (
              <Text size="sm" fw={600}>
                {`Saison ${String(target.seasonNumber)} · Épisode ${String(target.episodeNumber)}`}
              </Text>
            )}
            <TextInput
              id={episodeFieldId('title')}
              label="Titre"
              withAsterisk
              {...(creating ? {} : { 'data-autofocus': true })}
              key={form.key('title')}
              {...form.getInputProps('title')}
            />
            <Input.Wrapper
              label="Durée"
              labelElement="div"
              error={durationError}
              errorProps={{ id: DURATION_ERROR_ID }}
            >
              <Group grow align="flex-start" mt={4}>
                <NumberInput
                  id={episodeFieldId('durationMinutes')}
                  label="Minutes"
                  aria-label="Durée, minutes"
                  min={0}
                  max={600}
                  allowDecimal={false}
                  allowNegative={false}
                  clampBehavior="none"
                  key={form.key('durationMinutes')}
                  {...minutesProps}
                  error={durationError !== undefined}
                  aria-describedby={durationError === undefined ? undefined : DURATION_ERROR_ID}
                  onChange={(value) => {
                    durationEdited.current = true
                    forward(minutesProps, value)
                  }}
                />
                <NumberInput
                  id={episodeFieldId('durationSeconds')}
                  label="Secondes"
                  aria-label="Durée, secondes"
                  min={0}
                  max={59}
                  allowDecimal={false}
                  allowNegative={false}
                  clampBehavior="none"
                  key={form.key('durationSeconds')}
                  {...secondsProps}
                  error={durationError !== undefined}
                  aria-describedby={durationError === undefined ? undefined : DURATION_ERROR_ID}
                  onChange={(value) => {
                    durationEdited.current = true
                    forward(secondsProps, value)
                  }}
                />
              </Group>
            </Input.Wrapper>
            <Textarea
              id={episodeFieldId('description')}
              label="Description"
              description={`${String(values.description.trim().length)} / 1 000`}
              maxLength={EPISODE_DESCRIPTION_MAX + 200}
              autosize
              minRows={3}
              maxRows={8}
              key={form.key('description')}
              {...form.getInputProps('description')}
            />
            <TextInput
              id={episodeFieldId('releaseDate')}
              type="date"
              label="Date de sortie"
              key={form.key('releaseDate')}
              {...form.getInputProps('releaseDate')}
            />

            {target.mode === 'create' ? (
              <Stack gap="sm">
                <Divider />
                <Title order={3} size="h5">
                  Vidéo (facultative)
                </Title>
                <Text size="sm" c="dimmed">
                  Sans vidéo, l&apos;épisode n&apos;est pas visible des spectateurs.
                </Text>
                <VideoSourceInput
                  idPrefix="episode-video"
                  draft={video.draft}
                  errors={video.errors}
                  disabled={pending}
                  onTabChange={video.setTab}
                  onFileChange={(file) => {
                    video.chooseFile(file, (seconds) => {
                      // La durée du fichier préremplit le champ tant que l'admin ne l'a pas saisi.
                      if (!durationEdited.current) form.setValues(splitDuration(seconds))
                    })
                  }}
                  onLinkChange={video.setLink}
                />
              </Stack>
            ) : null}

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
                disabled={!creating && (!infoChanged || live === undefined)}
              >
                {pending ? pendingLabel : submitLabel}
              </Button>
            </Group>
          </Stack>
        </form>

        {/* Hors du formulaire : Entrée dans le lien n'enregistre pas les informations. */}
        {live === undefined ? null : (
          <>
            <Divider />
            <EpisodeVideoActions
              series={series}
              episode={live}
              onLaunched={() => {
                void requestClose()
              }}
              onGone={onClose}
            />
          </>
        )}
      </Stack>
    </Modal>
  )
}
