/** Titre de l'onglet « <page> · Noli Admin » (spec 0003, AC-7). */
import { useEffect } from 'react'

export const APP_NAME = 'Noli Admin'

export function usePageTitle(title: string): void {
  useEffect(() => {
    document.title = `${title} · ${APP_NAME}`
  }, [title])
}
