/**
 * Place les erreurs 400 et 409 sous les champs d'un formulaire Mantine (spec 0002, AC-13,
 * « Règles d'affichage des erreurs »). Le reste part dans notifyError, texte du backend en détail.
 */
import type { ReactNode } from 'react'
import { isApiError } from '@/shared/api/errors'
import { notifyError } from '@/shared/ui/notifyError'

export const INVALID_FIELD_MESSAGE = 'Valeur invalide.'
export const DUPLICATE_FIELD_MESSAGE = 'Déjà utilisé.'

/** Forme minimale d'un formulaire `@mantine/form` (méthode : compatible avec les chemins typés). */
export interface FieldErrorTarget {
  setFieldError(path: string, error: ReactNode): void
}

/** Nom du champ du formulaire → mot clé du backend, par exemple `{ title: 'title' }`. */
export type FieldMap = Readonly<Record<string, string>>

function fieldFor(sentence: string, fieldMap: FieldMap): string | undefined {
  const lower = sentence.toLowerCase()
  return Object.entries(fieldMap).find(([, keyword]) => lower.includes(keyword.toLowerCase()))?.[0]
}

function sentencesOf(backendMessage: string | readonly string[] | undefined): readonly string[] {
  if (backendMessage === undefined) return []
  return typeof backendMessage === 'string' ? [backendMessage] : backendMessage
}

/** Renvoie `true` si au moins un champ a reçu une erreur. */
export function applyFieldErrors(
  form: FieldErrorTarget,
  error: unknown,
  fieldMap: FieldMap,
): boolean {
  if (!isApiError(error) || error.kind !== 'http') {
    notifyError(error)
    return false
  }

  if (error.status === 400) {
    const sentences = sentencesOf(error.backendMessage)
    const matched = sentences
      .map((sentence) => fieldFor(sentence, fieldMap))
      .filter((field) => field !== undefined)
    new Set(matched).forEach((field) => {
      form.setFieldError(field, INVALID_FIELD_MESSAGE)
    })
    if (matched.length < sentences.length || sentences.length === 0) notifyError(error)
    return matched.length > 0
  }

  if (error.status === 409 && error.code === undefined) {
    const sentence = sentencesOf(error.backendMessage).join(' ')
    const field = fieldFor(sentence, fieldMap) ?? Object.keys(fieldMap)[0]
    if (field !== undefined) {
      form.setFieldError(field, DUPLICATE_FIELD_MESSAGE)
      return true
    }
  }

  notifyError(error)
  return false
}
