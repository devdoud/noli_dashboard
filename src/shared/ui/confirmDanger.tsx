/**
 * Confirmation d'une action destructrice (spec 0003, AC-9, section « confirmDanger »).
 * Renvoie true sur « Supprimer », false sur Annuler, Échap ou clic extérieur ; ne se résout qu'une fois.
 */
import { Text } from '@mantine/core'
import { modals } from '@mantine/modals'
import type { ReactNode } from 'react'

export interface ConfirmDangerOptions {
  readonly title: string
  readonly message: ReactNode
  readonly confirmLabel?: string
}

export function confirmDanger({
  title,
  message,
  confirmLabel = 'Supprimer',
}: ConfirmDangerOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const state = { settled: false }
    const settle = (value: boolean) => {
      if (state.settled) return
      state.settled = true
      resolve(value)
    }

    modals.openConfirmModal({
      title,
      centered: true,
      closeOnClickOutside: true,
      children: typeof message === 'string' ? <Text size="sm">{message}</Text> : message,
      labels: { confirm: confirmLabel, cancel: 'Annuler' },
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
