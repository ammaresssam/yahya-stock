// Turns the rows of an uploaded sheet into products ready for admin_save_product.
// One row = one size. Rows with the same product name become one product.
// A row with an empty name belongs to the product above it.
// Every problem is reported with its row number, in plain Arabic.

// Column titles in the template, and other spellings people may type
export const COLUMNS = [
  { key: 'name_ar', title: 'اسم المنتج', alt: ['الاسم', 'اسم المنتج بالعربي', 'المنتج', 'name', 'product', 'product name'] },
  { key: 'category', title: 'القسم', alt: ['الفئة', 'النوع', 'section', 'category'] },
  { key: 'size', title: 'المقاس', alt: ['مقاس', 'size'] },
  { key: 'price', title: 'السعر', alt: ['سعر', 'price'] },
  { key: 'stock_qty', title: 'الكمية', alt: ['كمية', 'العدد', 'المخزون', 'qty', 'quantity', 'stock'] },
  { key: 'color_ar', title: 'اللون (اختياري)', alt: ['اللون', 'لون', 'color', 'colour'] },
  { key: 'compare_at_price', title: 'السعر قبل الخصم (اختياري)', alt: ['السعر قبل الخصم', 'قبل الخصم', 'السعر القديم', 'compare at price', 'old price'] },
  { key: 'name_en', title: 'الاسم بالإنجليزي (اختياري)', alt: ['الاسم بالانجليزي', 'الاسم بالإنجليزي', 'بالإنجليزي', 'name en', 'english name'] },
]
const REQUIRED = ['name_ar', 'category', 'size', 'price', 'stock_qty']

export const EXAMPLE_MARK = 'مثال'
export const MAX_ROWS = 2000

const norm = (s) =>
  String(s ?? '')
    .replace(/[ً-ْـ]/g, '') // tashkeel and tatweel
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[*:()_\-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()

// Common colour names → a swatch, so the shop shows the right colour without picking one
const COLOR_HEX = {
  اسود: '#1f1f1f', black: '#1f1f1f', ابيض: '#f5f5f2', white: '#f5f5f2', احمر: '#c0392b', red: '#c0392b',
  ازرق: '#2c5aa0', blue: '#2c5aa0', كحلي: '#1f2a44', navy: '#1f2a44', لبني: '#9cc3e6', 'light blue': '#9cc3e6',
  اخضر: '#3c7a4a', green: '#3c7a4a', زيتي: '#5b5f2e', olive: '#5b5f2e', اصفر: '#e6c229', yellow: '#e6c229',
  برتقالي: '#e07b2a', orange: '#e07b2a', بني: '#6b4a2f', brown: '#6b4a2f', بيج: '#d9c7a7', beige: '#d9c7a7',
  رمادي: '#8a8a8a', رصاصي: '#8a8a8a', grey: '#8a8a8a', gray: '#8a8a8a', وردي: '#e8a0b4', بمبي: '#e8a0b4', pink: '#e8a0b4',
  بنفسجي: '#6c4a9e', موف: '#9b7bb8', purple: '#6c4a9e', نبيتي: '#6d1f2c', burgundy: '#6d1f2c', كريمي: '#f1e6cf', cream: '#f1e6cf',
  جملي: '#b08850', camel: '#b08850', فضي: '#c0c0c0', silver: '#c0c0c0', ذهبي: '#c9a43b', gold: '#c9a43b',
}
export const colorHex = (name) => COLOR_HEX[norm(name)] ?? '#888888'

// "250", "٢٥٠", "250 ج.م", "1,200", "250.00" → whole number; anything else → NaN; empty → null
export function parseAmount(v) {
  let s = String(v ?? '')
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٫]/g, '.')
    .replace(/(ج\.?\s*م\.?|جنيه|egp|le)/gi, '')
    .replace(/[\s,٬]/g, '')
  if (s === '') return null
  if (!/^\d+(\.0+)?$/.test(s)) return NaN
  return Number(s.split('.')[0])
}

// Finds the header row and which column holds what
export function readHeader(row) {
  const map = {}
  row.forEach((cell, i) => {
    const n = norm(cell)
    if (!n) return
    const col = COLUMNS.find((c) => norm(c.title) === n || c.alt.some((a) => norm(a) === n))
    if (col && map[col.key] === undefined) map[col.key] = i
  })
  return map
}

/**
 * rows: arrays of cell strings, first non-empty row is the header.
 * categories: rows of public.categories. existing: products already in the shop.
 * Returns { products, errors, skipped, headerError }
 *   products: [{ rows: [n…], payload }]   errors: [{ row, msg, product? }]   skipped: [{ name, rows }]
 */
export function rowsToProducts(rows, categories, existing = [], { active = true } = {}) {
  const errors = []
  const skipped = []
  const firstFilled = rows.findIndex((r) => r.some((c) => String(c ?? '').trim()))
  if (firstFilled < 0) return { products: [], errors, skipped, headerError: 'الملف فاضي' }
  // the titles row may sit under a note or two
  const found = rows.slice(0, 15).findIndex((r) => REQUIRED.filter((k) => readHeader(r)[k] !== undefined).length >= 3)
  const headerAt = found < 0 ? firstFilled : found
  const map = readHeader(rows[headerAt])
  const missing = REQUIRED.filter((k) => map[k] === undefined).map((k) => `«${COLUMNS.find((c) => c.key === k).title}»`)
  if (missing.length) {
    return {
      products: [], errors, skipped,
      headerError: `أول سطر في الملف لازم يكون عناوين الأعمدة زي النموذج. ناقص: ${missing.join('، ')}. نزّل النموذج واكتب فيه.`,
    }
  }
  const body = rows.slice(headerAt + 1)
  if (body.length > MAX_ROWS) {
    return { products: [], errors, skipped, headerError: `الملف فيه ${body.length} سطر. أقصى عدد ${MAX_ROWS} سطر في المرة، قسّمه على أكتر من ملف.` }
  }

  const catIndex = new Map()
  for (const c of categories) for (const k of [c.id, c.name_ar, c.name_en]) if (k) catIndex.set(norm(k), c)
  const catList = categories.map((c) => c.name_ar).join('، ')
  const existingNames = new Set(existing.map((p) => norm(p.name_ar)))

  const groups = new Map() // norm(name) → group
  let current = null
  body.forEach((r, i) => {
    const rowNum = headerAt + i + 2 // as shown in Excel
    const get = (k) => (map[k] === undefined ? '' : String(r[map[k]] ?? '').trim())
    if (!COLUMNS.some((c) => get(c.key))) return // empty row

    const err = (msg, g) => {
      errors.push({ row: rowNum, msg, product: g?.name })
      if (g) g.bad = true
    }
    const name = get('name_ar')
    const exampleMsg = 'ده سطر مثال من النموذج. امسحه واكتب منتجاتك'
    if (name.startsWith(EXAMPLE_MARK)) {
      current = EXAMPLE_MARK
      return err(exampleMsg)
    }
    if (!name && current === EXAMPLE_MARK) return err(exampleMsg)

    let g
    if (name) {
      g = groups.get(norm(name))
      if (!g) {
        g = { name, name_en: '', category: null, rows: [], variants: [], bad: false }
        groups.set(norm(name), g)
      }
      current = g
    } else if (current) g = current
    else return err('اكتب اسم المنتج')
    g.rows.push(rowNum)

    const en = get('name_en')
    if (en && !g.name_en) g.name_en = en

    const catText = get('category')
    if (catText) {
      const c = catIndex.get(norm(catText))
      if (!c) err(`القسم «${catText}» مش موجود. الأقسام المتاحة: ${catList}`, g)
      else if (g.category && g.category.id !== c.id) err(`المنتج «${g.name}» مكتوب في قسمين مختلفين (${g.category.name_ar} و ${c.name_ar})`, g)
      else g.category = c
    }

    const size = get('size')
    const colorName = get('color_ar')
    const price = parseAmount(get('price'))
    const old = parseAmount(get('compare_at_price'))
    const qty = parseAmount(get('stock_qty'))
    let ok = true
    const bad = (msg) => { ok = false; err(msg, g) }

    if (!size) bad('اكتب المقاس (مثلاً M أو 42 أو Free Size)')
    if (price === null) bad('اكتب السعر')
    else if (Number.isNaN(price) || price <= 0) bad(`السعر «${get('price')}» لازم يكون رقم صحيح أكبر من صفر`)
    if (qty === null) bad('اكتب الكمية (اكتب 0 لو خلصان)')
    else if (Number.isNaN(qty)) bad(`الكمية «${get('stock_qty')}» لازم تكون رقم صحيح`)
    if (old !== null) {
      if (Number.isNaN(old)) bad(`السعر قبل الخصم «${get('compare_at_price')}» لازم يكون رقم صحيح`)
      else if (ok && old <= price) bad('السعر قبل الخصم لازم يكون أكبر من السعر (أو سيبه فاضي)')
    }
    if (size) {
      const dup = g.variants.find((v) => norm(v.size) === norm(size) && norm(v.color_ar) === norm(colorName))
      if (dup) bad(`المقاس ${size}${colorName ? ` باللون ${colorName}` : ''} متكرر في «${g.name}» (موجود في السطر ${dup.row})`)
    }
    if (ok) {
      g.variants.push({
        row: rowNum, size, color_ar: colorName, color_en: '', color_hex: colorName ? colorHex(colorName) : null,
        price, compare_at_price: old, stock_qty: qty,
      })
    }
  })

  const products = []
  for (const g of groups.values()) {
    if (!g.category && !g.bad) {
      errors.push({ row: g.rows[0], msg: `اكتب القسم للمنتج «${g.name}» (${catList})`, product: g.name })
      g.bad = true
    }
    // a product with some coloured sizes and some without would confuse the shop
    if (!g.bad && g.variants.some((v) => v.color_ar) && g.variants.some((v) => !v.color_ar)) {
      errors.push({ row: g.variants.find((v) => !v.color_ar).row, msg: `في «${g.name}» بعض السطور ليها لون وبعضها لأ. اكتب اللون في كل السطور أو سيبه فاضي في كلها`, product: g.name })
      g.bad = true
    }
    if (g.bad) continue
    if (existingNames.has(norm(g.name))) {
      skipped.push({ name: g.name, rows: g.rows })
      continue
    }
    const c = g.category
    products.push({
      rows: g.rows,
      payload: {
        name_ar: g.name,
        name_en: g.name_en,
        category: c.id,
        is_new: true,
        featured: false,
        active,
        art_type: c.art_type ?? 'tee',
        art_color: c.art_color ?? '#2b2a2f',
        art_bg: c.art_bg ?? '#e9e7e3',
        variants: g.variants.map(({ row, ...v }) => v),
        images: [],
      },
    })
  }
  errors.sort((a, b) => a.row - b.row)
  return { products, errors, skipped, headerError: '' }
}

// The download template: the columns, three example rows, and a "how to" sheet
export function templateSheets(categories) {
  const cat = (i) => categories[i % Math.max(1, categories.length)]?.name_ar ?? 'رجالي'
  return [
    {
      name: 'المنتجات',
      rtl: true,
      boldFirstRow: true,
      widths: [28, 12, 11, 10, 10, 15, 22, 26],
      rows: [
        COLUMNS.map((c) => c.title),
        [`${EXAMPLE_MARK} - تيشيرت قطن`, cat(0), 'M', 250, 5, 'أسود', 300, 'Cotton T-shirt'],
        ['', '', 'L', 250, 3, 'أسود', 300, ''],
        [`${EXAMPLE_MARK} - فستان صيفي`, cat(1), 'Free Size', 450, 2, '', '', ''],
      ],
    },
    {
      name: 'طريقة الاستخدام',
      rtl: true,
      widths: [100],
      rows: [
        ['طريقة ملء الملف'],
        ['1) كل سطر = مقاس واحد. لو المنتج له 3 مقاسات اكتبه في 3 سطور.'],
        ['2) سيب «اسم المنتج» فاضي في السطر اللي تحته عشان يتحسب نفس المنتج (أو اكتب نفس الاسم).'],
        [`3) القسم لازم يكون واحد من: ${categories.map((c) => c.name_ar).join('، ') || 'رجالي، حريمي، أطفال'}`],
        ['4) السعر والكمية أرقام بس (مثلاً 250). اكتب 0 في الكمية لو المقاس خلصان.'],
        ['5) اللون والسعر قبل الخصم والاسم بالإنجليزي اختياريين.'],
        [`6) امسح سطور «${EXAMPLE_MARK}» قبل الرفع.`],
        ['7) الصور بتتضاف بعد الرفع: افتح المنتج من لوحة التحكم ودوس «تعديل».'],
        ['8) احفظ الملف Excel (.xlsx) أو CSV، وارفعه من «رفع من Excel».'],
      ],
    },
  ]
}
