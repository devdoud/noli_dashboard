import {
  moveCategory,
  orderedCategories,
  positionText,
  sameIdSet,
  sameSequence,
} from '@/features/categories/categoryOrder'
import type { Category } from '@/shared/api/categories'

const category = (id: string): Category => ({
  _id: id,
  name: id.toUpperCase(),
  slug: id,
  description: undefined,
  imageUrl: undefined,
  displayOrder: 0,
  isVisible: true,
  createdAt: undefined,
  updatedAt: undefined,
})

describe('moveCategory (AC-7)', () => {
  const ids = ['a', 'b', 'c']

  it('monte et descend d’un rang', () => {
    expect(moveCategory(ids, 'b', 'up')).toEqual(['b', 'a', 'c'])
    expect(moveCategory(ids, 'b', 'down')).toEqual(['a', 'c', 'b'])
  })

  it('ne bouge pas la première vers le haut ni la dernière vers le bas', () => {
    expect(moveCategory(ids, 'a', 'up')).toBe(ids)
    expect(moveCategory(ids, 'c', 'down')).toBe(ids)
    expect(moveCategory(ids, 'z', 'down')).toBe(ids)
  })

  it('ne modifie pas la liste reçue', () => {
    moveCategory(ids, 'a', 'down')
    expect(ids).toEqual(['a', 'b', 'c'])
  })
})

describe('comparaisons (AC-7)', () => {
  it('compare la suite des identifiants, ordre compris', () => {
    expect(sameSequence(['a', 'b'], ['a', 'b'])).toBe(true)
    expect(sameSequence(['a', 'b'], ['b', 'a'])).toBe(false)
  })

  it('compare l’ensemble des identifiants, sans l’ordre', () => {
    expect(sameIdSet(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameIdSet(['a', 'b'], ['a', 'c'])).toBe(false)
    expect(sameIdSet(['a'], ['a', 'b'])).toBe(false)
  })
})

describe('orderedCategories et annonce (AC-7, AC-12)', () => {
  const list = [category('a'), category('b'), category('c')]

  it('suit l’ordre en cours, sinon l’ordre du serveur', () => {
    expect(orderedCategories(list, undefined).map((item) => item._id)).toEqual(['a', 'b', 'c'])
    expect(orderedCategories(list, ['c', 'a', 'b']).map((item) => item._id)).toEqual([
      'c',
      'a',
      'b',
    ])
  })

  it('annonce la nouvelle position', () => {
    expect(positionText('Drame', 2, 8)).toBe('« Drame » est maintenant en position 2 sur 8.')
  })
})
