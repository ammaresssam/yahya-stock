// Storefront search, filters and sorting (pure logic from src/lib/catalog.js).
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_FILTERS, activeFilterCount, allSizes, applyCatalog, isOnSale, maxDiscount } from '../src/lib/catalog.js'
import { fromDemo } from '../src/lib/product.js'

const P = (id, name, category, variants, extra = {}) =>
  fromDemo({ id, name: { ar: name[0], en: name[1] }, category, variants, art: {}, ...extra })

const products = [
  P('a', ['قميص قطن كلاسيك', 'Classic Cotton Shirt'], 'men', [{ size: 'M', price: 350, compareAt: 550, stock: 3 }, { size: 'L', price: 350, compareAt: 550, stock: 0 }], { featured: true }),
  P('b', ['تيشيرت بيسك', 'Basic Tee'], 'men', [{ size: 'S', price: 180, stock: 5 }, { size: 'M', price: 180, stock: 5 }]),
  P('c', ['فستان صيفي', 'Summer Dress'], 'women', [{ size: 'S', price: 420, compareAt: 650, stock: 0 }, { size: 'M', price: 420, stock: 2 }]),
  P('d', ['بنطلون جينز', 'Denim Jeans'], 'men', [{ size: '30', price: 380, stock: 0 }, { size: '32', price: 400, stock: 2 }, { size: '36', price: 420, compareAt: 550, stock: 6 }]),
  P('e', ['هودي أطفال', 'Kids Hoodie'], 'kids', [{ size: '6', price: 260, compareAt: 340, stock: 0 }]),
  P('f', ['جاكيت جينز', 'Denim Jacket'], 'women', [{ size: 'M', price: 650, stock: 4 }], { featured: true }),
]
const ids = (list) => list.map((p) => p.id)
const run = (over) => ids(applyCatalog(products, { ...DEFAULT_FILTERS, ...over }))

describe('search', () => {
  test('finds Arabic and English names', () => {
    assert.deepEqual(run({ q: 'جينز' }), ['f', 'd'])
    assert.deepEqual(run({ q: 'denim' }), ['f', 'd'])
  })
  test('ignores letter variants and extra spaces (هودى / هودي, أ / ا)', () => {
    assert.deepEqual(run({ q: '  هودى   اطفال ' }), ['e'])
    assert.deepEqual(run({ q: 'قميص' }), ['a'])
  })
  test('all words must match', () => {
    assert.deepEqual(run({ q: 'بنطلون فستان' }), [])
  })
  test('empty search shows everything (sold-out items last)', () => {
    assert.deepEqual(run({}), ['a', 'f', 'b', 'c', 'd', 'e'])
  })
})

describe('filters', () => {
  test('category', () => assert.deepEqual(run({ category: 'women' }), ['f', 'c']))
  test('size matches any chosen size', () => assert.deepEqual(run({ sizes: ['S'] }), ['b', 'c']))
  test('size + in stock: only products where THAT size is available', () => {
    assert.deepEqual(run({ sizes: ['S'], inStock: true }), ['b'])
    assert.deepEqual(run({ sizes: ['l'], inStock: true }), [], 'L shirt is sold out; size match is case-insensitive')
  })
  test('price range uses the size prices', () => {
    assert.deepEqual(run({ price: 'u200' }), ['b'])
    assert.deepEqual(run({ price: '400-599' }), ['c', 'd'])
    assert.deepEqual(run({ price: '600+' }), ['f'])
  })
  test('on sale: only sizes that are in stock AND really discounted', () => {
    // a: M discounted and in stock ✓; c: discounted size S is sold out ✗; d: 36 discounted ✓; e: sold out ✗
    assert.deepEqual(run({ onSale: true }), ['a', 'd'])
  })
  test('filters combine', () => assert.deepEqual(run({ category: 'men', onSale: true, price: '400-599' }), ['d']))
  test('no results is an empty list, not an error', () => assert.deepEqual(run({ category: 'kids', inStock: true }), []))
  test('counts active filters', () => {
    assert.equal(activeFilterCount(DEFAULT_FILTERS), 0)
    assert.equal(activeFilterCount({ ...DEFAULT_FILTERS, q: 'x', sizes: ['M', 'L'], onSale: true }), 4)
  })
})

describe('sorting', () => {
  test('price low → high and high → low use the lowest available price; sold-out always last', () => {
    assert.deepEqual(run({ sort: 'price-asc' }), ['b', 'a', 'd', 'c', 'f', 'e'])
    assert.deepEqual(run({ sort: 'price-desc' }), ['f', 'c', 'd', 'a', 'b', 'e'])
  })
  test('biggest real discount first', () => {
    assert.deepEqual(run({ sort: 'discount' }), ['a', 'd', 'b', 'c', 'f', 'e'])
  })
  test('newest keeps the store order, sold-out last', () => assert.deepEqual(run({ sort: 'newest' }), ['a', 'b', 'c', 'd', 'f', 'e']))
})

describe('discount helpers', () => {
  test('maxDiscount only counts in-stock sizes when any are in stock', () => {
    assert.equal(maxDiscount(products[0]), 36)
    assert.equal(maxDiscount(products[2]), 0, 'the discounted size is sold out')
    assert.equal(maxDiscount(products[4]), 24, 'all sold out → still shows the real discount')
  })
  test('isOnSale', () => assert.deepEqual(products.map(isOnSale), [true, false, false, true, false, false]))
  test('allSizes orders letters then numbers', () => assert.deepEqual(allSizes(products), ['S', 'M', 'L', '6', '30', '32', '36']))
})
