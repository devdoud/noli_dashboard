/**
 * Liste complète des catégories, masquées comprises (spec backend 0003, `GET /categories/all`),
 * partagée par le formulaire de série (spec 0005) et la page des catégories (spec 0008).
 */
import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { apiRequest } from '@/shared/api/client'

export const categoriesKeys = {
  all: ['categories', 'all'] as const,
}

const CATEGORIES_STALE_TIME_MS = 5 * 60_000

const nullishText = z
  .string()
  .nullish()
  .transform((value) => value ?? undefined)

export const categorySchema = z.object({
  _id: z.string(),
  name: z.string(),
  slug: z.string().default(''),
  description: nullishText,
  imageUrl: nullishText,
  displayOrder: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  isVisible: z
    .boolean()
    .nullish()
    .transform((value) => value ?? true),
  createdAt: nullishText,
  updatedAt: nullishText,
})

export const categoryListSchema = z.object({ categories: z.array(categorySchema) })
export const categoryResponseSchema = z.object({ category: categorySchema })

export type Category = z.infer<typeof categorySchema>

export interface UseAllCategoriesOptions {
  /** La page des catégories relit toujours à l'ouverture (spec 0008). */
  readonly refetchOnMount?: boolean | 'always'
  /** Pas de relecture au retour sur l'onglet pendant un ordre en cours (spec 0008). */
  readonly refetchOnWindowFocus?: boolean
}

export function useAllCategories(options: UseAllCategoriesOptions = {}) {
  return useQuery({
    queryKey: categoriesKeys.all,
    queryFn: async ({ signal }) => {
      const response = await apiRequest({
        method: 'GET',
        path: '/categories/all',
        schema: categoryListSchema,
        signal,
      })
      return response.categories
    },
    staleTime: CATEGORIES_STALE_TIME_MS,
    ...options,
  })
}
