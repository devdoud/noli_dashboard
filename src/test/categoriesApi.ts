import { http, HttpResponse } from 'msw'
import { API } from '@/test/apiBase'

// Liste des catégories simulée pour les tests (specs 0005 et 0008), et faux backend des catégories.

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

export interface RawCategory {
  readonly _id: string
  readonly name: string
  readonly slug: string
  readonly description?: string | null
  readonly imageUrl?: string | null
  readonly displayOrder: number
  readonly isVisible: boolean
}

export function makeCategory(
  index: number,
  name: string,
  overrides: Partial<RawCategory> = {},
): RawCategory {
  return {
    _id: `cat${String(index)}`,
    name,
    slug: name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, ''),
    description: null,
    imageUrl: null,
    displayOrder: index,
    isVisible: true,
    ...overrides,
  }
}

export interface CategoryCall {
  readonly method: string
  readonly path: string
  readonly body: unknown
}

async function bodyOf(request: Request): Promise<unknown> {
  if (request.headers.get('content-type')?.startsWith('multipart/form-data') === true) {
    const file = (await request.formData()).get('file')
    return { file: typeof file === 'object' && file !== null ? file.size : file }
  }
  const text = await request.text()
  return text === '' ? undefined : (JSON.parse(text) as unknown)
}

/**
 * Faux backend des catégories : garde la liste, répond comme l'API (spec backend 0003) et note
 * chaque écriture. `inUse` donne le nombre de séries qui utilisent une catégorie.
 */
export function categoriesBackend(
  initial: readonly RawCategory[],
  inUse: Readonly<Record<string, number>> = {},
) {
  const state = { categories: [...initial] }
  const calls: CategoryCall[] = []
  const sorted = () => [...state.categories].sort((a, b) => a.displayOrder - b.displayOrder)
  const record = async (request: Request) => {
    const body = await bodyOf(request.clone())
    calls.push({ method: request.method, path: new URL(request.url).pathname, body })
    return body
  }
  const find = (id: unknown) => state.categories.find((category) => category._id === id)
  const replace = (next: RawCategory) => {
    state.categories = state.categories.map((category) =>
      category._id === next._id ? next : category,
    )
    return next
  }
  const gone = () => HttpResponse.json({ message: 'Category not found' }, { status: 404 })

  const handlers = [
    http.get(`${API}/categories/all`, () =>
      HttpResponse.json({ message: 'ok', categories: sorted() }),
    ),
    http.put(`${API}/categories/order`, async ({ request }) => {
      const body = (await record(request)) as { ids: string[] }
      const known = new Set(state.categories.map((category) => category._id))
      if (body.ids.length !== known.size || !body.ids.every((id) => known.has(id))) {
        return HttpResponse.json(
          { message: 'ids must list every category exactly once (hidden ones included)' },
          { status: 400 },
        )
      }
      state.categories = state.categories.map((category) => ({
        ...category,
        displayOrder: body.ids.indexOf(category._id),
      }))
      return HttpResponse.json({ message: 'ok', categories: sorted() })
    }),
    http.post(`${API}/categories`, async ({ request }) => {
      const body = (await record(request)) as Partial<RawCategory> & { name: string }
      const created = makeCategory(state.categories.length + 100, body.name, {
        description: body.description ?? null,
        isVisible: body.isVisible ?? true,
        displayOrder: Math.max(-1, ...state.categories.map((c) => c.displayOrder)) + 1,
      })
      if (state.categories.some((category) => category.slug === created.slug)) {
        return HttpResponse.json(
          { message: 'A category with this name already exists' },
          { status: 409 },
        )
      }
      state.categories = [...state.categories, created]
      return HttpResponse.json({ message: 'ok', category: created })
    }),
    http.patch(`${API}/categories/:id`, async ({ request, params }) => {
      const body = (await record(request)) as Partial<RawCategory>
      const current = find(params.id)
      if (current === undefined) return gone()
      if (
        body.slug !== undefined &&
        state.categories.some((c) => c._id !== current._id && c.slug === body.slug)
      ) {
        return HttpResponse.json(
          { message: 'A category with this slug already exists' },
          { status: 409 },
        )
      }
      return HttpResponse.json({ message: 'ok', category: replace({ ...current, ...body }) })
    }),
    http.delete(`${API}/categories/:id`, async ({ request, params }) => {
      await record(request)
      const current = find(params.id)
      if (current === undefined) return gone()
      const count = inUse[current._id]
      if (count !== undefined && count > 0) {
        return HttpResponse.json(
          {
            statusCode: 409,
            code: 'CATEGORY_IN_USE',
            message: 'Category is used by series',
            seriesCount: count,
          },
          { status: 409 },
        )
      }
      state.categories = state.categories.filter((category) => category._id !== current._id)
      return HttpResponse.json({ message: 'ok' })
    }),
    http.put(`${API}/categories/:id/image`, async ({ request, params }) => {
      await record(request)
      const current = find(params.id)
      if (current === undefined) return gone()
      return HttpResponse.json({
        message: 'ok',
        category: replace({
          ...current,
          imageUrl: 'https://res.cloudinary.com/noli/image/upload/v1/noli/test/category.jpg',
        }),
      })
    }),
    http.delete(`${API}/categories/:id/image`, async ({ request, params }) => {
      await record(request)
      const current = find(params.id)
      if (current === undefined) return gone()
      return HttpResponse.json({ message: 'ok', category: replace({ ...current, imageUrl: null }) })
    }),
  ]

  return {
    handlers,
    calls,
    callsTo: (method: string, path: string | RegExp) =>
      calls.filter(
        (call) =>
          call.method === method &&
          (typeof path === 'string' ? call.path.endsWith(path) : path.test(call.path)),
      ),
  }
}
