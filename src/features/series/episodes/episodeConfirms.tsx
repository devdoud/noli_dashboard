// Questions de la fenêtre d'épisode (spec 0006, « Confirmations », AC-13, AC-15).
// Chacune renvoie true sur l'action, false sur Annuler, Échap ou clic extérieur.
import { Text } from '@mantine/core'
import { modals } from '@mantine/modals'

interface AskOptions {
  readonly title: string
  readonly message: string
  readonly confirmLabel: string
  readonly cancelLabel: string
  readonly confirmColor?: string
}

function ask({ title, message, confirmLabel, cancelLabel, confirmColor }: AskOptions) {
  return new Promise<boolean>((resolve) => {
    const state = { settled: false }
    const settle = (value: boolean) => {
      if (state.settled) return
      state.settled = true
      resolve(value)
    }
    modals.openConfirmModal({
      title,
      centered: true,
      children: <Text size="sm">{message}</Text>,
      labels: { confirm: confirmLabel, cancel: cancelLabel },
      ...(confirmColor === undefined ? {} : { confirmProps: { color: confirmColor } }),
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

export const PUBLISH_MESSAGE =
  "L'épisode deviendra visible des spectateurs dès que sa vidéo sera prête, et les abonnés de ses catégories peuvent être prévenus. Cette annonce ne peut pas être annulée."

/** Avant la première vidéo d'un épisode pas encore visible (AC-13). */
export function confirmPublish(): Promise<boolean> {
  return ask({
    title: "Publier l'épisode ?",
    message: PUBLISH_MESSAGE,
    confirmLabel: 'Publier',
    cancelLabel: 'Annuler',
  })
}

/** Fermer la fenêtre avec des changements non enregistrés (AC-15). */
export function confirmDiscard(): Promise<boolean> {
  return ask({
    title: 'Abandonner les changements ?',
    message: 'Vos changements seront perdus.',
    confirmLabel: 'Abandonner',
    cancelLabel: 'Continuer la saisie',
    confirmColor: 'noliRed.8',
  })
}
