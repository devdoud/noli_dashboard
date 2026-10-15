// Zone Vidéo de la fenêtre d'épisode (spec 0006, AC-2, « Partie Vidéo ») : fichier ou lien https.
import { FileInput, Stack, Tabs, TextInput } from '@mantine/core'
import { IconLink, IconUpload } from '@tabler/icons-react'
import type { ReactNode } from 'react'
import type { VideoDraft, VideoDraftErrors, VideoTab } from '@/features/series/episodes/videoSource'

interface VideoSourceInputProps {
  /** Préfixe des identifiants (plusieurs zones ne coexistent jamais, mais restent distinctes). */
  readonly idPrefix: string
  readonly draft: VideoDraft
  readonly errors: VideoDraftErrors
  readonly disabled?: boolean
  readonly onTabChange: (tab: VideoTab) => void
  readonly onFileChange: (file: File | null) => void
  readonly onLinkChange: (link: string) => void
  /** Bouton de lancement sous chaque onglet (modification), absent à l'ajout. */
  readonly action?: (tab: VideoTab) => ReactNode
}

export function VideoSourceInput({
  idPrefix,
  draft,
  errors,
  disabled = false,
  onTabChange,
  onFileChange,
  onLinkChange,
  action,
}: VideoSourceInputProps) {
  return (
    <Tabs
      value={draft.tab}
      onChange={(value) => {
        if (value === 'file' || value === 'link') onTabChange(value)
      }}
      keepMounted={false}
    >
      <Tabs.List>
        <Tabs.Tab value="file" leftSection={<IconUpload size={16} aria-hidden="true" />}>
          Envoyer un fichier
        </Tabs.Tab>
        <Tabs.Tab value="link" leftSection={<IconLink size={16} aria-hidden="true" />}>
          Depuis un lien
        </Tabs.Tab>
      </Tabs.List>
      <Tabs.Panel value="file" pt="sm">
        <Stack gap="sm">
          <FileInput
            id={`${idPrefix}-file`}
            label="Fichier vidéo"
            description="30 Go et 3 heures au plus."
            placeholder="Choisir un fichier"
            accept="video/*"
            clearable
            disabled={disabled}
            value={draft.file ?? null}
            onChange={onFileChange}
            error={errors.file}
          />
          {action?.('file')}
        </Stack>
      </Tabs.Panel>
      <Tabs.Panel value="link" pt="sm">
        <Stack gap="sm">
          <TextInput
            id={`${idPrefix}-link`}
            type="url"
            label="Lien de la vidéo"
            description="Cloudflare récupère la vidéo à cette adresse."
            placeholder="https://…"
            disabled={disabled}
            value={draft.link}
            onChange={(event) => {
              onLinkChange(event.currentTarget.value)
            }}
            error={errors.link}
          />
          {action?.('link')}
        </Stack>
      </Tabs.Panel>
    </Tabs>
  )
}
