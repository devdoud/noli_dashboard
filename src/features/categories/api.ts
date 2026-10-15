// Écritures des catégories (spec 0008, « API surface »), par le client API partagé.
// Chaque écriture met à jour la liste partagée ; certaines relisent aussi la liste des séries.
import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { z } from 'zod'
import type { CategoryCreatePayload, CategoryPatch } from '@/features/categories/categoryRules'
import {
  categoriesKeys,
  categoryListSchema,
  categoryResponseSchema,
  type Category,
} from '@/shared/api/categories'
import { apiRequest } from '@/shared/api/client'
import { isApiError } from '@/shared/api/errors'
import { seriesListsKey } from '@/shared/api/seriesKeys'

const messageSchema = z.object({ message: z.string().optional() })

export async function createCategory(payload: CategoryCreatePayload): Promise<Category> {
  const response = await apiRequest({
    method: 'POST',
    path: '/categories',
    body: payload,
    schema: categoryResponseSchema,
  })
  return response.category
}

export async function updateCategory(id: string, patch: CategoryPatch): Promise<Category> {
  const response = await apiRequest({
    method: 'PATCH',
    path: `/categories/${id}`,
    body: patch,
    schema: categoryResponseSchema,
  })
  return response.category
}

export async function reorderCategories(ids: readonly string[]): Promise<readonly Category[]> {
  const response = await apiRequest({
    method: 'PUT',
    path: '/categories/order',
    body: { ids },
    schema: categoryListSchema,
  })
  return response.categories
}

export async function deleteCategory(id: string): Promise<void> {
  await apiRequest({ method: 'DELETE', path: `/categories/${id}`, schema: messageSchema })
}

export async function uploadCategoryImage(id: string, file: File): Promise<Category> {
  const body = new FormData()
  body.append('file', file)
  const response = await apiRequest({
    method: 'PUT',
    path: `/categories/${id}/image`,
    body,
    schema: categoryResponseSchema,
  })
  return response.category
}

export async function removeCategoryImage(id: string): Promise<Category> {
  const response = await apiRequest({
    method: 'DELETE',
    path: `/categories/${id}/image`,
    schema: categoryResponseSchema,
  })
  return response.category
}

/** Remplace une catégorie dans la liste en cache, sans changer l'ordre. */
export function putCategory(queryClient: QueryClient, category: Category): void {
  queryClient.setQueryData<readonly Category[]>(categoriesKeys.all, (list) =>
    list?.map((item) => (item._id === category._id ? category : item)),
  )
}

/** Ajoute une catégorie en fin de liste en cache. */
export function appendCategory(queryClient: QueryClient, category: Category): void {
  queryClient.setQueryData<readonly Category[]>(categoriesKeys.all, (list) =>
    list === undefined
      ? [category]
      : [...list.filter((item) => item._id !== category._id), category],
  )
}

/** Retire une catégorie de la liste en cache. */
export function dropCategory(queryClient: QueryClient, id: string): void {
  queryClient.setQueryData<readonly Category[]>(categoriesKeys.all, (list) =>
    list?.filter((item) => item._id !== id),
  )
}

export function reloadCategories(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: categoriesKeys.all })
}

/** Les étiquettes de catégorie des séries changent : la liste des séries est relue. */
export function reloadSeriesLists(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: seriesListsKey })
}

/**
 * Image d'une catégorie (spec 0008, AC-9) : la catégorie renvoyée remplace celle du cache ;
 * un 404 ou un 409 fait relire la liste.
 */
export function useCategoryImageMutations(id: string) {
  const queryClient = useQueryClient()
  const onSuccess = (category: Category) => {
    putCategory(queryClient, category)
    reloadSeriesLists(queryClient)
  }
  const onError = (error: unknown) => {
    if (
      isApiError(error) &&
      error.kind === 'http' &&
      (error.status === 404 || error.status === 409)
    ) {
      reloadCategories(queryClient)
    }
  }
  const upload = useMutation({
    mutationFn: (file: File) => uploadCategoryImage(id, file),
    onSuccess,
    onError,
  })
  const remove = useMutation({ mutationFn: () => removeCategoryImage(id), onSuccess, onError })
  return { upload, remove }
}
