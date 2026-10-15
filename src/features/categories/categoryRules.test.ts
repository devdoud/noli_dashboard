import {
  badRequestField,
  CATEGORY_MESSAGES,
  conflictField,
  countText,
  descriptionError,
  inUseText,
  isEmptyPatch,
  nameError,
  parseInUse,
  slugError,
  slugify,
  toCategoryCreatePayload,
  toCategoryFormValues,
  toCategoryPatch,
  type CategoryFormValues,
} from '@/features/categories/categoryRules'
import { ApiError } from '@/shared/api/errors'

const others = [
  { _id: 'c1', name: 'Comédie', slug: 'comedie' },
  { _id: 'c2', name: 'Drame', slug: 'drame-intense' },
]

describe('slugify : même règle que le backend (spec 0008)', () => {
  it.each([
    ['Comédie romantique', 'comedie-romantique'],
    ['  Action & Aventure !! ', 'action-aventure'],
    ['Ça va', 'ca-va'],
    ['Œuvre', 'uvre'],
    ['日本', ''],
    ['---', ''],
    ['Science-Fiction 2', 'science-fiction-2'],
  ])('%s → %s', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })
})

describe('nameError (AC-3)', () => {
  it.each([
    ['   ', CATEGORY_MESSAGES.nameRequired],
    ['a'.repeat(51), CATEGORY_MESSAGES.nameTooLong],
    ['!!!', CATEGORY_MESSAGES.nameNoAlnum],
    ['日本', CATEGORY_MESSAGES.nameNoAlnum],
    ['All', CATEGORY_MESSAGES.nameReserved],
    ['ALL!', CATEGORY_MESSAGES.nameReserved],
    ['Order', CATEGORY_MESSAGES.nameReserved],
    ['comedie', 'Trop proche de la catégorie « Comédie ».'],
    [' COMÉDIE ', 'Trop proche de la catégorie « Comédie ».'],
  ])('« %s » → %s', (name, message) => {
    expect(nameError(name, others)).toBe(message)
  })

  it('accepte un nom de 50 caractères après nettoyage', () => {
    expect(nameError(` ${'a'.repeat(50)} `, others)).toBeUndefined()
  })

  it('ignore la catégorie modifiée elle même', () => {
    expect(nameError('comédie', others, 'c1')).toBeUndefined()
  })

  it('compare à la forme du nom des autres, pas à leur adresse', () => {
    expect(nameError('Drame', others)).toBe('Trop proche de la catégorie « Drame ».')
    expect(nameError('drame intense', others)).toBeUndefined()
  })
})

describe('descriptionError (AC-3)', () => {
  it('refuse plus de 300 caractères après nettoyage', () => {
    expect(descriptionError(` ${'a'.repeat(300)} `)).toBeUndefined()
    expect(descriptionError('a'.repeat(301))).toBe(CATEGORY_MESSAGES.descriptionTooLong)
  })
})

describe('slugError (AC-5)', () => {
  it.each([
    ['Comedie', CATEGORY_MESSAGES.slugPattern],
    ['comedie romantique', CATEGORY_MESSAGES.slugPattern],
    ['comedie--romantique', CATEGORY_MESSAGES.slugPattern],
    ['-comedie', CATEGORY_MESSAGES.slugPattern],
    ['', CATEGORY_MESSAGES.slugPattern],
    ['order', CATEGORY_MESSAGES.slugReserved],
    ['drame-intense', 'Adresse déjà utilisée par « Drame ».'],
  ])('%s → %s', (slug, message) => {
    expect(slugError(slug, others, 'c1')).toBe(message)
  })

  it('accepte une adresse libre, ou la sienne', () => {
    expect(slugError('comedie-2', others, 'c1')).toBeUndefined()
    expect(slugError('comedie', others, 'c1')).toBeUndefined()
  })
})

describe('corps envoyés (AC-2, AC-4, AC-5)', () => {
  const base: CategoryFormValues = toCategoryFormValues({
    _id: 'c2',
    name: 'Drame',
    slug: 'drame',
    description: 'Des larmes.',
    displayOrder: 0,
    isVisible: true,
    imageUrl: undefined,
    createdAt: undefined,
    updatedAt: undefined,
  })

  it('crée avec le nom nettoyé et sans description vide', () => {
    expect(
      toCategoryCreatePayload({ name: '  Polar ', description: '   ', isVisible: false, slug: '' }),
    ).toEqual({ name: 'Polar', isVisible: false })
  })

  it('n’envoie que le nom changé', () => {
    expect(toCategoryPatch(base, { ...base, name: 'Drames' }, false)).toEqual({ name: 'Drames' })
  })

  it('n’envoie rien pour des espaces ajoutés', () => {
    expect(isEmptyPatch(toCategoryPatch(base, { ...base, name: ' Drame ' }, false))).toBe(true)
  })

  it('envoie null pour une description vidée', () => {
    expect(toCategoryPatch(base, { ...base, description: ' ' }, false)).toEqual({
      description: null,
    })
  })

  it('envoie l’adresse seulement si son champ est ouvert et modifié', () => {
    expect(toCategoryPatch(base, { ...base, slug: 'drame-2' }, false)).toEqual({})
    expect(toCategoryPatch(base, { ...base, slug: 'drame' }, true)).toEqual({})
    expect(toCategoryPatch(base, { ...base, slug: 'drame-2' }, true)).toEqual({ slug: 'drame-2' })
  })

  it('envoie la visibilité changée', () => {
    expect(toCategoryPatch(base, { ...base, isVisible: false }, false)).toEqual({
      isVisible: false,
    })
  })
})

describe('refus du backend (AC-3, AC-5, AC-8)', () => {
  const http = (
    status: number,
    message?: string,
    extra: Partial<{ code: string; body: unknown }> = {},
  ) =>
    new ApiError({
      kind: 'http',
      status,
      ...(message === undefined ? {} : { backendMessage: message }),
      ...extra,
    })

  it('distingue un 409 sur le nom d’un 409 sur l’adresse', () => {
    expect(conflictField(http(409, 'A category with this name already exists'))).toBe('name')
    expect(conflictField(http(409, 'A category with this slug already exists'))).toBe('slug')
    expect(conflictField(http(400, 'x'))).toBeUndefined()
  })

  it('reconnaît les 400 du nom et de l’adresse', () => {
    expect(
      badRequestField(http(400, 'The name must contain at least one letter or digit (a-z, 0-9)')),
    ).toBe('name')
    expect(badRequestField(http(400, '"order" is reserved, pick another name or slug'))).toBe(
      'slug',
    )
    expect(badRequestField(http(400, 'Provide at least one field to update'))).toBeUndefined()
  })

  it('lit le nombre de séries d’un refus de suppression', () => {
    const inUse = http(409, 'Category is used by series', {
      code: 'CATEGORY_IN_USE',
      body: { statusCode: 409, code: 'CATEGORY_IN_USE', message: 'x', seriesCount: 3 },
    })
    expect(parseInUse(inUse)).toEqual({ seriesCount: 3 })
    expect(conflictField(inUse)).toBeUndefined()
    expect(parseInUse(http(409, 'x', { code: 'CATEGORY_IN_USE', body: {} }))).toEqual({})
    expect(parseInUse(http(409, 'A category with this name already exists'))).toBeUndefined()
  })

  it('accorde le nombre de séries', () => {
    expect(inUseText('Drame', 3)).toBe('« Drame » est encore utilisée par 3 séries.')
    expect(inUseText('Drame', 1)).toBe('« Drame » est encore utilisée par 1 série.')
    expect(inUseText('Drame', undefined)).toBe('« Drame » est encore utilisée par des séries.')
  })

  it('accorde le nombre de catégories', () => {
    expect(countText(0)).toBe('0 catégorie')
    expect(countText(1)).toBe('1 catégorie')
    expect(countText(8)).toBe('8 catégories')
  })
})
