// Emplacement d'une image (spec 0007, AC-2 à AC-10 ; partagé par les catégories, spec 0008) :
// choix ou dépôt, contrôles, aperçu, envoi, retrait. Autonome : il n'enregistre rien par le
// formulaire qui l'entoure. Les mutations viennent de l'appelant (séries, épisodes, catégories).
import {
  AspectRatio,
  Badge,
  Box,
  Button,
  Center,
  FileButton,
  Group,
  Skeleton,
  Stack,
  Text,
} from '@mantine/core'
import { IconPhoto, IconTrash, IconUpload } from '@tabler/icons-react'
import { useEffect, useId, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { readImageDimensions } from '@/shared/images/imageDimensions'
import {
  ACCEPTED_IMAGE_TYPES,
  checkDimensions,
  checkFileBasics,
  IMAGE_MESSAGES,
  imageErrorMessage,
  isHostedImage,
  type ImageSlotRules,
} from '@/shared/images/imageRules'
import { isApiError } from '@/shared/api/errors'
import { confirmDanger } from '@/shared/ui/confirmDanger'
import { notifySuccess } from '@/shared/ui/notifySuccess'

const FILL: CSSProperties = { width: '100%', height: '100%', objectFit: 'cover', display: 'block' }

interface Preview {
  readonly file: File
  readonly url: string
}

/** Une écriture d'image (forme compatible avec une mutation TanStack Query). */
export interface ImageMutation<TVariables> {
  readonly isPending: boolean
  mutate(
    variables: TVariables,
    options?: { onSuccess?: () => void; onError?: (error: unknown) => void },
  ): void
}

export interface ImageMutations {
  readonly upload: ImageMutation<File>
  readonly remove: ImageMutation<void>
}

export interface ImageSlotProps {
  readonly slot: ImageSlotRules
  readonly currentUrl: string | undefined
  /** Texte alternatif de l'image affichée (« Couverture de <titre> »). */
  readonly alt: string
  /** Complète les noms des boutons, par exemple « de l'épisode 3 de la saison 1 ». */
  readonly nameSuffix?: string
  readonly mutations: ImageMutations
  /** Un aperçu attend ou un envoi est en cours (protection de la page, AC-9). */
  readonly onPendingChange: (pending: boolean) => void
  /** L'épisode a disparu (404) : la fenêtre se ferme sans question. */
  readonly onGone?: () => void
  readonly maxWidth?: number
}

function CurrentImage({ url, alt }: { readonly url: string; readonly alt: string }) {
  const [state, setState] = useState<'loading' | 'loaded' | 'failed'>('loading')
  if (state === 'failed') {
    return (
      <Center h="100%" bg="var(--noli-color-surface-raised)">
        <Stack gap={4} align="center">
          <IconPhoto size={28} aria-hidden="true" />
          <Text size="sm" c="dimmed">
            Image indisponible
          </Text>
        </Stack>
      </Center>
    )
  }
  return (
    <Box pos="relative" h="100%">
      {state === 'loading' ? <Skeleton pos="absolute" inset={0} radius={0} /> : null}
      <img
        src={url}
        alt={alt}
        style={FILL}
        onLoad={() => {
          setState('loaded')
        }}
        onError={() => {
          setState('failed')
        }}
      />
    </Box>
  )
}

export function ImageSlot({
  slot,
  currentUrl,
  alt,
  nameSuffix = '',
  mutations,
  onPendingChange,
  onGone,
  maxWidth,
}: ImageSlotProps) {
  const { upload, remove } = mutations
  const titleId = useId()
  const errorId = useId()
  const [preview, setPreview] = useState<Preview>()
  const [error, setError] = useState<string>()
  const [dragOver, setDragOver] = useState(false)
  const choosing = useRef(0)
  const previewUrl = useRef<string>(undefined)
  const chooseButton = useRef<HTMLButtonElement>(null)
  const resetInput = useRef<() => void>(null)
  const busy = upload.isPending || remove.isPending
  const pending = preview !== undefined || upload.isPending
  const name = `${slot.noun}${nameSuffix === '' ? '' : ` ${nameSuffix}`}`

  useEffect(() => {
    onPendingChange(pending)
  }, [pending, onPendingChange])

  // L'adresse blob: de l'aperçu est libérée au démontage.
  useEffect(
    () => () => {
      if (previewUrl.current !== undefined) URL.revokeObjectURL(previewUrl.current)
    },
    [],
  )

  const replacePreview = (next: Preview | undefined) => {
    if (previewUrl.current !== undefined && previewUrl.current !== next?.url) {
      URL.revokeObjectURL(previewUrl.current)
    }
    previewUrl.current = next?.url
    setPreview(next)
  }

  const focusChoose = () => {
    // Après le rendu : le bouton « Choisir » ou « Changer » remplace « Envoyer ».
    window.setTimeout(() => chooseButton.current?.focus(), 0)
  }

  const choose = async (file: File) => {
    resetInput.current?.()
    if (busy) return
    setError(undefined)
    const basics = checkFileBasics(file)
    if (basics !== undefined) {
      setError(basics)
      return
    }
    choosing.current += 1
    const attempt = choosing.current
    const url = URL.createObjectURL(file)
    const dimensions = await readImageDimensions(url)
    // Un autre fichier a été choisi entre temps : ce résultat ne compte plus.
    if (attempt !== choosing.current) {
      URL.revokeObjectURL(url)
      return
    }
    const refused = checkDimensions(dimensions, slot)
    if (refused !== undefined) {
      URL.revokeObjectURL(url)
      setError(refused)
      return
    }
    replacePreview({ file, url })
  }

  const fail = (failure: unknown) => {
    setError(imageErrorMessage(failure, slot))
    if (isApiError(failure) && failure.kind === 'http' && failure.status === 404) onGone?.()
  }

  const send = () => {
    if (preview === undefined || busy) return
    setError(undefined)
    upload.mutate(preview.file, {
      onSuccess: () => {
        replacePreview(undefined)
        notifySuccess(slot.saved)
        focusChoose()
      },
      onError: fail,
    })
  }

  const cancel = () => {
    choosing.current += 1
    replacePreview(undefined)
    setError(undefined)
    focusChoose()
  }

  const askRemove = async () => {
    if (busy || currentUrl === undefined) return
    const confirmed = await confirmDanger({
      title: `Retirer ${name} ?`,
      message: isHostedImage(currentUrl)
        ? "L'image sera effacée de l'hébergement. Cette action est définitive."
        : slot.externalRemoval,
      confirmLabel: 'Retirer',
    })
    if (!confirmed) return
    setError(undefined)
    remove.mutate(undefined, {
      onSuccess: () => {
        notifySuccess(slot.removed)
        focusChoose()
      },
      onError: fail,
    })
  }

  const onDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    if (!busy) setDragOver(true)
  }
  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragOver(false)
    if (busy) return
    const { files } = event.dataTransfer
    if (files.length > 1) {
      setError(IMAGE_MESSAGES.oneFile)
      return
    }
    const [file] = files
    if (file !== undefined) void choose(file)
  }

  const external = currentUrl !== undefined && !isHostedImage(currentUrl)

  return (
    <Stack
      gap="xs"
      role="group"
      aria-labelledby={titleId}
      aria-describedby={error === undefined ? undefined : errorId}
      maw={maxWidth}
      w="100%"
    >
      <Group gap="xs">
        <Text id={titleId} fw={600} size="sm">
          {slot.title}
        </Text>
        {external && preview === undefined ? (
          <Badge variant="light" color="noliAmber" size="sm">
            Lien externe
          </Badge>
        ) : null}
      </Group>
      <Box
        onDragOver={onDragOver}
        onDragLeave={() => {
          setDragOver(false)
        }}
        onDrop={onDrop}
        style={{
          borderRadius: 'var(--mantine-radius-md)',
          overflow: 'hidden',
          border: `2px ${dragOver ? 'solid var(--noli-color-focus)' : 'dashed var(--noli-color-field-border)'}`,
        }}
      >
        <AspectRatio ratio={slot.aspectRatio}>
          {preview !== undefined ? (
            <img src={preview.url} alt={`Aperçu : ${alt}`} style={FILL} />
          ) : currentUrl !== undefined ? (
            <CurrentImage key={currentUrl} url={currentUrl} alt={alt} />
          ) : (
            <Center bg="var(--noli-color-surface-raised)">
              <Stack gap={4} align="center" p="sm">
                <IconPhoto size={28} aria-hidden="true" />
                <Text size="sm" c="dimmed" ta="center">
                  {slot.empty}
                </Text>
                <Text size="xs" c="dimmed" ta="center">
                  Déposez une image ici
                </Text>
              </Stack>
            </Center>
          )}
        </AspectRatio>
      </Box>

      {preview !== undefined ? (
        <>
          <Text size="xs" c="dimmed">
            Cloudinary peut décaler le cadre vers le sujet principal.
          </Text>
          <Group gap="xs">
            <Button
              size="sm"
              leftSection={<IconUpload size={16} aria-hidden="true" />}
              loading={upload.isPending}
              aria-label={`Envoyer ${name}`}
              onClick={send}
            >
              Envoyer
            </Button>
            <Button
              size="sm"
              variant="default"
              disabled={upload.isPending}
              aria-label={`Annuler l'image choisie pour ${name}`}
              onClick={cancel}
            >
              Annuler
            </Button>
          </Group>
        </>
      ) : (
        <Group gap="xs">
          <FileButton
            accept={ACCEPTED_IMAGE_TYPES}
            resetRef={resetInput}
            onChange={(file) => {
              if (file !== null) void choose(file)
            }}
          >
            {(props) => (
              <Button
                {...props}
                ref={chooseButton}
                size="sm"
                variant="light"
                disabled={busy}
                aria-label={currentUrl === undefined ? `Choisir ${name}` : `Changer ${name}`}
              >
                {currentUrl === undefined ? 'Choisir une image' : `Changer ${slot.noun}`}
              </Button>
            )}
          </FileButton>
          {currentUrl === undefined ? null : (
            <Button
              size="sm"
              variant="subtle"
              color="noliRed.8"
              leftSection={<IconTrash size={16} aria-hidden="true" />}
              loading={remove.isPending}
              disabled={upload.isPending}
              aria-label={`Retirer ${name}`}
              onClick={() => {
                void askRemove()
              }}
            >
              {`Retirer ${slot.noun}`}
            </Button>
          )}
        </Group>
      )}

      {error === undefined ? null : (
        <Text id={errorId} role="alert" size="sm" c="noliRed">
          {error}
        </Text>
      )}
    </Stack>
  )
}
