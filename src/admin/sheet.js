// Read and write simple spreadsheets in the browser, with no library:
//  - readSheet(file)  → rows (array of arrays of strings) from .xlsx or .csv
//  - writeXlsx(sheets) → a small .xlsx Blob (used for the download template)
// Only what the bulk product upload needs: the first sheet, text and numbers.

// ---------- CSV ----------
export function parseCsv(text) {
  text = text.replace(/^﻿/, '')
  const firstLine = text.slice(0, text.search(/\r?\n|$/))
  // Excel uses ";" instead of "," in some languages, and some apps save tabs
  const delim = [',', ';', '\t'].reduce((best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best), ',')
  const rows = []
  let row = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell === '') quoted = true
    else if (ch === delim) { row.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell); rows.push(row); row = []; cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row) }
  return rows
}

// Excel's "CSV" (not "CSV UTF-8") saves Arabic in the old Windows encoding
export function decodeText(bytes) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return new TextDecoder('windows-1256').decode(bytes)
  }
}

// ---------- ZIP (the container inside every .xlsx) ----------
const u16 = (b, o) => b[o] | (b[o + 1] << 8)
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

async function inflateRaw(data) {
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

export async function unzip(buf) {
  const b = new Uint8Array(buf)
  let eocd = -1
  for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) {
    if (u32(b, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('not_zip')
  const count = u16(b, eocd + 10)
  let p = u32(b, eocd + 16)
  const files = {}
  const utf8 = new TextDecoder()
  for (let n = 0; n < count; n++) {
    if (u32(b, p) !== 0x02014b50) throw new Error('not_zip')
    const method = u16(b, p + 10)
    const size = u32(b, p + 20)
    const nameLen = u16(b, p + 28)
    const local = u32(b, p + 42)
    const name = utf8.decode(b.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + u16(b, p + 30) + u16(b, p + 32)
    const start = local + 30 + u16(b, local + 26) + u16(b, local + 28)
    const raw = b.subarray(start, start + size)
    files[name] = { method, raw }
  }
  return {
    names: Object.keys(files),
    async text(name) {
      const f = files[name]
      if (!f) return null
      const data = f.method === 0 ? f.raw : f.method === 8 ? await inflateRaw(f.raw) : null
      if (!data) throw new Error('unsupported_zip')
      return utf8.decode(data)
    },
  }
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
const crc32 = (d) => {
  let c = 0xffffffff
  for (let i = 0; i < d.length; i++) c = CRC_TABLE[(c ^ d[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

// Stored (uncompressed) zip — tiny files, so no compression needed
export function zip(entries) {
  const enc = new TextEncoder()
  const parts = []
  const central = []
  let offset = 0
  for (const [name, content] of entries) {
    const nameB = enc.encode(name)
    const data = typeof content === 'string' ? enc.encode(content) : content
    const crc = crc32(data)
    const head = new DataView(new ArrayBuffer(30))
    head.setUint32(0, 0x04034b50, true); head.setUint16(4, 20, true); head.setUint16(6, 0x0800, true)
    head.setUint32(14, crc, true); head.setUint32(18, data.length, true); head.setUint32(22, data.length, true)
    head.setUint16(26, nameB.length, true)
    const cd = new DataView(new ArrayBuffer(46))
    cd.setUint32(0, 0x02014b50, true); cd.setUint16(4, 20, true); cd.setUint16(6, 20, true); cd.setUint16(8, 0x0800, true)
    cd.setUint32(16, crc, true); cd.setUint32(20, data.length, true); cd.setUint32(24, data.length, true)
    cd.setUint16(28, nameB.length, true); cd.setUint32(42, offset, true)
    parts.push(new Uint8Array(head.buffer), nameB, data)
    central.push(new Uint8Array(cd.buffer), nameB)
    offset += 30 + nameB.length + data.length
  }
  const cdSize = central.reduce((s, x) => s + x.length, 0)
  const end = new DataView(new ArrayBuffer(22))
  end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true)
  end.setUint32(12, cdSize, true); end.setUint32(16, offset, true)
  const all = [...parts, ...central, new Uint8Array(end.buffer)]
  const out = new Uint8Array(all.reduce((s, x) => s + x.length, 0))
  let o = 0
  for (const x of all) { out.set(x, o); o += x.length }
  return out
}

// ---------- XLSX ----------
const unescapeXml = (s) =>
  s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()]
  })
const escapeXml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const attr = (attrs, name) => attrs.match(new RegExp(`(?:^|\\s)${name}="([^"]*)"`))?.[1]
// all <t> text inside an element, skipping phonetic hints (<rPh>)
const textOf = (xml) => unescapeXml([...xml.replace(/<rPh[\s\S]*?<\/rPh>/g, '').matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((m) => m[1]).join(''))
const colIndex = (ref) => [...ref.replace(/\d+/g, '')].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1

export async function parseXlsx(buf) {
  const z = await unzip(buf)
  // first sheet, as listed in the workbook
  let sheetPath = 'xl/worksheets/sheet1.xml'
  const wb = await z.text('xl/workbook.xml')
  const rels = await z.text('xl/_rels/workbook.xml.rels')
  const rid = wb && attr(wb.match(/<sheet\s[^>]*>/)?.[0] ?? '', 'r:id')
  if (rid && rels) {
    const rel = [...rels.matchAll(/<Relationship\s[^>]*>/g)].map((m) => m[0]).find((r) => attr(r, 'Id') === rid)
    const target = rel && attr(rel, 'Target')
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
  }
  const sheet = await z.text(sheetPath)
  if (!sheet) throw new Error('no_sheet')
  const ssXml = await z.text('xl/sharedStrings.xml')
  const shared = ssXml ? [...ssXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textOf(m[1])) : []

  const rows = []
  for (const r of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const rowNum = Number(attr(r[1], 'r')) || rows.length + 1
    const row = []
    let next = 0
    for (const c of (r[2] ?? '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = attr(c[1], 'r')
      const i = ref ? colIndex(ref) : next
      next = i + 1
      const type = attr(c[1], 't')
      const body = c[2] ?? ''
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
      let val = ''
      if (type === 's') val = shared[Number(v)] ?? ''
      else if (type === 'inlineStr') val = textOf(body)
      else if (v != null) val = unescapeXml(v)
      if (type === 'n' || (!type && v != null)) {
        // Excel stores 250 as "250" but sometimes 0.1+0.2 noise like "249.99999999999997"
        const n = Number(val)
        if (Number.isFinite(n)) val = String(Math.round(n * 1e6) / 1e6)
      }
      row[i] = val
    }
    rows[rowNum - 1] = Array.from(row, (x) => x ?? '')
  }
  return Array.from(rows, (x) => x ?? [])
}

// sheets: [{ name, rows: [[cell, …], …], widths?: [n, …], rtl?: true, boldFirstRow?: true }]
export function writeXlsx(sheets) {
  const colName = (i) => (i >= 26 ? colName(Math.floor(i / 26) - 1) : '') + String.fromCharCode(65 + (i % 26))
  const sheetXml = (s) => {
    const cols = s.widths ? `<cols>${s.widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('')}</cols>` : ''
    const rows = s.rows.map((row, r) =>
      `<row r="${r + 1}">${row.map((v, c) => {
        const ref = `${colName(c)}${r + 1}`
        const style = s.boldFirstRow && r === 0 ? ' s="1"' : ''
        if (v === '' || v == null) return ''
        if (typeof v === 'number') return `<c r="${ref}"${style}><v>${v}</v></c>`
        return `<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${escapeXml(v ?? '')}</t></is></c>`
      }).join('')}</row>`).join('')
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"${s.rtl ? ' rightToLeft="1"' : ''}/></sheetViews>${cols}<sheetData>${rows}</sheetData></worksheet>`
  }
  const files = [
    ['[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
    ['_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ['xl/workbook.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`],
    ['xl/_rels/workbook.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
    ['xl/styles.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="12"/><name val="Arial"/></font><font><b/><sz val="12"/><name val="Arial"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
    ...sheets.map((s, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s)]),
  ]
  return new Blob([zip(files)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}

// A picked file → rows. Throws Error('bad_file') for anything else.
export async function readSheet(file) {
  const buf = await file.arrayBuffer()
  const b = new Uint8Array(buf)
  if (b[0] === 0x50 && b[1] === 0x4b) return parseXlsx(buf) // "PK" = zip = .xlsx
  if (/\.(xls|numbers|ods)$/i.test(file.name) || b.includes(0)) throw new Error('bad_file')
  return parseCsv(decodeText(b))
}
