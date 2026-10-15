// Ordre d'affichage des catégories (spec 0008, AC-7, AC-12). Fonctions pures.
import type { Category } from '@/shared/api/categories'

export type MoveDirection = 'up' | 'down'

/** Déplace un identifiant d'un rang ; renvoie la même liste si le déplacement est impossible. */
export function moveCategory(
  ids: readonly string[],
  id: string,
  direction: MoveDirection,
): readonly string[] {
  const index = ids.indexOf(id)
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || target < 0 || target >= ids.length) return ids
  const next = [...ids]
  const [moved] = next.splice(index, 1)
  if (moved === undefined) return ids
  next.splice(target, 0, moved)
  return next
}

/** Même suite d'identifiants (l'ordre compte). */
export function sameSequence(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((id, index) => id === b[index])
}

/** Mêmes identifiants, quel que soit l'ordre. */
export function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  const set = new Set(a)
  return b.every((id) => set.has(id))
}

/** Les catégories dans l'ordre en cours s'il existe, sinon dans l'ordre du serveur. */
export function orderedCategories(
  categories: readonly Category[],
  draftIds: readonly string[] | undefined,
): readonly Category[] {
  if (draftIds === undefined) return categories
  const byId = new Map(categories.map((category) => [category._id, category]))
  return draftIds.map((id) => byId.get(id)).filter((category) => category !== undefined)
}

/** « « Drame » est maintenant en position 2 sur 8. » (AC-12). */
export function positionText(name: string, position: number, total: number): string {
  return `« ${name} » est maintenant en position ${String(position)} sur ${String(total)}.`
}
