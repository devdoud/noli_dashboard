import { http, HttpResponse } from 'msw'
import { API } from '@/test/apiBase'

// Liste des catégories simulée pour les tests (specs 0005 et 0008).

export const ALL_CATEGORIES = [
  { _id: 'c1', name: 'Drame', slug: 'drame', isVisible: true },
  { _id: 'c2', name: 'Thriller', slug: 'thriller', isVisible: true },
  { _id: 'c9', name: 'Bientôt', slug: 'bientot', isVisible: false },
]

export function categoriesHandler() {
  return http.get(`${API}/categories/all`, () =>
    HttpResponse.json({ message: 'ok', categories: ALL_CATEGORIES }),
  )
}
