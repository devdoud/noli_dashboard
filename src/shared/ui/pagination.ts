/** Calculs de pagination de DataTable (spec 0003, AC-8). */

export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/** « 1 à 20 sur 134 » ; chaîne vide quand il n'y a rien. */
export function rangeSummary(page: number, pageSize: number, total: number): string {
  if (total <= 0) return ''
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return `${String(from)} à ${String(to)} sur ${String(total)}`
}
