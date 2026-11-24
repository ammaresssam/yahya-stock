// Bulk product upload from Excel / CSV: reading the file, checking every row,
// and saving the result through the real admin_save_product on Postgres.
import { after, before, describe, test } from 'node:test'
import assert from 'node:assert/strict'
import { as, freshDb, sql } from './helpers/db.js'
import { owner, seedShop } from './helpers/shop.js'
import { parseCsv, parseXlsx, writeXlsx, zip, decodeText } from '../src/admin/sheet.js'
import { COLUMNS, parseAmount, rowsToProducts, templateSheets } from '../src/admin/bulk.js'

const CATS = [
  { id: 'men', name_ar: 'رجالي', name_en: 'Men', art_type: 'shirt', art_color: '#2b2a2f', art_bg: '#e9e7e3' },
  { id: 'women', name_ar: 'حريمي', name_en: 'Women', art_type: 'dress', art_color: '#e3262d', art_bg: '#f6e4e2' },
  { id: 'kids', name_ar: 'أطفال', name_en: 'Kids', art_type: 'tee', art_color: '#f2b705', art_bg: '#fbf1cf' },
]
const HEAD = COLUMNS.map((c) => c.title)
const sheet = (...rows) => [HEAD, ...rows]

describe('reading files', () => {
  test('CSV with quotes, commas inside cells, BOM and Windows line endings', () => {
    const rows = parseCsv('﻿a,b,c\r\n"x, y","he said ""hi""",3\r\n')
    assert.deepEqual(rows, [['a', 'b', 'c'], ['x, y', 'he said "hi"', '3']])
  })

  test('CSV with ";" or tabs (Excel in some languages)', () => {
    assert.deepEqual(parseCsv('a;b\n1;2'), [['a', 'b'], ['1', '2']])
    assert.deepEqual(parseCsv('a\tb\n1\t2'), [['a', 'b'], ['1', '2']])
  })

  test('CSV saved by Excel in the old Arabic Windows encoding still reads as Arabic', () => {
    // "قميص" in windows-1256
    assert.equal(decodeText(new Uint8Array([0xde, 0xe3, 0xed, 0xd5])), 'قميص')
    assert.equal(decodeText(new TextEncoder().encode('قميص')), 'قميص')
  })

  test('the template .xlsx reads back exactly', async () => {
    const sheets = templateSheets(CATS)
    const buf = await writeXlsx(sheets).arrayBuffer()
    const rows = await parseXlsx(buf)
    const trim = (r) => { const x = r.map(String); while (x.length && x[x.length - 1] === '') x.pop(); return x }
    assert.deepEqual(rows.map(trim), sheets[0].rows.map(trim))
  })

  test('a real Excel-style file: compressed, titles under a note, columns in another order', async () => {
    const { readFileSync } = await import('node:fs')
    const buf = readFileSync(new URL('./fixtures/excel-made.xlsx', import.meta.url))
    const rows = await parseXlsx(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))
    const { products, errors } = rowsToProducts(rows, CATS)
    assert.deepEqual(errors, [])
    assert.deepEqual(products.map((p) => [p.payload.name_ar, p.payload.category, p.payload.variants.map((v) => `${v.size}/${v.price}/${v.stock_qty}`)]), [
      ['جاكيت جلد', 'men', ['L/1200/4', 'XL/1200/0']],
      ['بيجامة & شورت', 'kids', ['6 سنين/180/2']],
    ])
  })

  test('xlsx with shared strings, rich text, gaps between cells and number noise', async () => {
    const entries = [
      ['xl/workbook.xml', '<workbook xmlns:r="r"><sheets><sheet name="S" sheetId="1" r:id="rId7"/></sheets></workbook>'],
      ['xl/_rels/workbook.xml.rels', '<Relationships><Relationship Id="rId7" Type="ws" Target="worksheets/data.xml"/></Relationships>'],
      ['xl/sharedStrings.xml', '<sst><si><t>اسم &amp; منتج</t></si><si><r><t>قم</t></r><r><t>يص</t></r><rPh><t>x</t></rPh></si></sst>'],
      ['xl/worksheets/data.xml', '<worksheet><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row><row r="3"><c r="B3"><v>249.99999999999997</v></c></row></sheetData></worksheet>'],
    ]
    const rows = await parseXlsx(zip(entries).buffer)
    assert.deepEqual(rows, [['اسم & منتج', '', 'قميص'], [], ['', '250']])
  })
})

describe('checking rows', () => {
  test('amounts: Arabic digits, currency, thousands; reject decimals and words', () => {
    assert.equal(parseAmount('٢٥٠'), 250)
    assert.equal(parseAmount('250 ج.م'), 250)
    assert.equal(parseAmount('1,200'), 1200)
    assert.equal(parseAmount('250.00'), 250)
    assert.equal(parseAmount(''), null)
    assert.ok(Number.isNaN(parseAmount('249.5')))
    assert.ok(Number.isNaN(parseAmount('ميتين')))
    assert.ok(Number.isNaN(parseAmount('-5')))
  })

  test('rows with the same name, or an empty name, become one product', () => {
    const { products, errors } = rowsToProducts(sheet(
      ['تيشيرت قطن', 'رجالي', 'M', '250', '5', '', '', 'Cotton Tee'],
      ['', '', 'L', '250', '0'],
      ['فستان', 'Women', 'Free Size', '450', '2'],
      ['تيشيرت قطن', '', 'XL', '270', '1'],
    ), CATS)
    assert.deepEqual(errors, [])
    assert.equal(products.length, 2)
    const tee = products[0].payload
    assert.equal(tee.name_en, 'Cotton Tee')
    assert.equal(tee.category, 'men')
    assert.equal(tee.art_type, 'shirt')
    assert.deepEqual(tee.variants.map((v) => `${v.size}/${v.price}/${v.stock_qty}`), ['M/250/5', 'L/250/0', 'XL/270/1'])
    assert.deepEqual(products[0].rows, [2, 3, 5])
    assert.equal(products[1].payload.category, 'women')
  })

  test('columns can be in any order, with English titles', () => {
    const { products, errors } = rowsToProducts([
      ['Price', 'Size', 'Name', 'Category', 'Qty', 'Color'],
      ['300', 'M', 'Hoodie', 'kids', '4', 'أحمر'],
    ], CATS)
    assert.deepEqual(errors, [])
    assert.deepEqual(products[0].payload.variants[0], { size: 'M', color_ar: 'أحمر', color_en: '', color_hex: '#c0392b', price: 300, compare_at_price: null, stock_qty: 4 })
  })

  test('a file without the right titles gets one clear message', () => {
    const r = rowsToProducts([['a', 'b'], ['1', '2']], CATS)
    assert.match(r.headerError, /عناوين الأعمدة/)
    assert.match(r.headerError, /«اسم المنتج»/)
    assert.equal(rowsToProducts([], CATS).headerError, 'الملف فاضي')
  })

  test('every bad row is reported with its row number, and only that product is held back', () => {
    const { products, errors } = rowsToProducts(sheet(
      ['قميص', 'رجالي', 'M', '300', '2'],
      ['بنطلون', 'شتوي', 'M', '300', '2'], // unknown section
      ['جاكيت', 'رجالي', '', '300', '2'], // no size
      ['شورت', 'رجالي', 'M', 'ميتين', '2'], // price not a number
      ['شورت2', 'رجالي', 'M', '300', ''], // no quantity
      ['شورت3', 'رجالي', 'M', '300', '1', '', '200'], // old price lower
      ['شورت4', 'رجالي', 'M', '300', '1'],
      ['', '', 'M', '300', '1'], // repeated size
      ['', '', '', '', ''], // empty rows are ignored
    ), CATS)
    assert.deepEqual(products.map((p) => p.payload.name_ar), ['قميص'])
    assert.deepEqual(errors.map((e) => e.row), [3, 4, 5, 6, 7, 9])
    assert.match(errors[0].msg, /القسم «شتوي» مش موجود.*رجالي، حريمي، أطفال/)
    assert.match(errors[1].msg, /اكتب المقاس/)
    assert.match(errors[2].msg, /السعر «ميتين»/)
    assert.match(errors[3].msg, /اكتب الكمية/)
    assert.match(errors[4].msg, /قبل الخصم لازم يكون أكبر/)
    assert.match(errors[5].msg, /متكرر.*السطر 8/)
  })

  test('the template example rows are refused until deleted', () => {
    const [first] = templateSheets(CATS)
    const { products, errors } = rowsToProducts(first.rows.map((r) => r.map(String)), CATS)
    assert.equal(products.length, 0)
    assert.deepEqual(errors.map((e) => e.row), [2, 3, 4])
    assert.ok(errors.every((e) => /سطر مثال/.test(e.msg)))
  })

  test('missing section, two sections, and mixed colour/no colour are caught', () => {
    const { errors } = rowsToProducts(sheet(
      ['أ', '', 'M', '100', '1'],
      ['ب', 'رجالي', 'M', '100', '1'],
      ['ب', 'حريمي', 'L', '100', '1'],
      ['ج', 'رجالي', 'M', '100', '1', 'أسود'],
      ['', '', 'L', '100', '1'],
    ), CATS)
    assert.match(errors.find((e) => e.row === 2).msg, /اكتب القسم/)
    assert.match(errors.find((e) => e.row === 4).msg, /قسمين مختلفين/)
    assert.match(errors.find((e) => e.row === 6).msg, /بعض السطور ليها لون/)
  })

  test('products already in the shop are skipped, not duplicated', () => {
    const { products, skipped } = rowsToProducts(sheet(['قميص أبيض', 'رجالي', 'M', '300', '2']), CATS, [{ name_ar: 'قميص ابيض' }])
    assert.equal(products.length, 0)
    assert.deepEqual(skipped, [{ name: 'قميص أبيض', rows: [2] }])
  })

  test('"hide until photos" makes the products hidden', () => {
    const { products } = rowsToProducts(sheet(['قميص', 'رجالي', 'M', '300', '2']), CATS, [], { active: false })
    assert.equal(products[0].payload.active, false)
  })
})

describe('saving uploaded products in the real database', () => {
  let db
  before(async () => {
    db = await freshDb()
    await seedShop(db)
  })
  after(() => db.close())

  test('every product the checker accepts is saved by admin_save_product', async () => {
    const cats = await sql(db, `select * from public.categories`)
    const { products, errors } = rowsToProducts(sheet(
      ['بلوزة', 'حريمي', 'S', '٣٥٠', '3', 'أبيض', '٤٠٠'],
      ['', '', 'M', '350', '0', 'أبيض', '400'],
      ['', '', 'S', '350', '2', 'أسود'],
      ['طقم أطفال', 'أطفال', '4 سنين', '200', '5'],
    ), cats)
    assert.deepEqual(errors, [])
    for (const p of products) {
      await as(db, owner, (tx) => tx.query(`select public.admin_save_product($1::jsonb)`, [JSON.stringify(p.payload)]))
    }
    const rows = await sql(db, `select p.name_ar, v.size, v.color_ar, v.price, v.compare_at_price, v.stock_qty
      from public.product_variants v join public.products p on p.id = v.product_id
      where p.name_ar in ('بلوزة', 'طقم أطفال') order by p.name_ar, v.position`)
    assert.deepEqual(rows.map((r) => `${r.name_ar}/${r.color_ar}/${r.size}/${r.price}/${r.compare_at_price}/${r.stock_qty}`), [
      'بلوزة/أبيض/S/350/400/3',
      'بلوزة/أبيض/M/350/400/0',
      'بلوزة/أسود/S/350/null/2',
      'طقم أطفال//4 سنين/200/null/5',
    ])
  })
})
