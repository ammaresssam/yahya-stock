import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { PGlite } from '@electric-sql/pglite'

const root = fileURLToPath(new URL('../..', import.meta.url))
const migrationsDir = join(root, 'supabase', 'migrations')

export const migrationFiles = () => readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()

/**
 * Fresh in-memory Postgres with the Supabase shim and the migrations applied.
 * `upTo` (a filename) stops after that migration — used to test the state before a fix.
 */
export async function freshDb({ upTo } = {}) {
  const db = await PGlite.create()
  await db.exec(readFileSync(join(root, 'tests', 'supabase-shim.sql'), 'utf8'))
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(join(migrationsDir, file), 'utf8'))
    if (upTo && file === upTo) break
  }
  return db
}

/**
 * Run `fn` exactly as Supabase would for an API request:
 * the JWT claims are set and the role is switched, inside a transaction.
 *   role: 'anon' | 'authenticated' | 'service_role'
 * If `fn` throws, the transaction is rolled back (nothing persists).
 */
export function as(db, { role, uid = null }, fn) {
  return db.transaction(async (tx) => {
    const claims = JSON.stringify(uid ? { sub: uid, role } : { role })
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [claims])
    await tx.exec(`set local role ${role}`)
    return fn(tx)
  })
}

/** Like `as`, but never throws: returns { ok, rows, affected, error }. */
export async function attempt(db, who, sql, params = []) {
  try {
    const res = await as(db, who, (tx) => tx.query(sql, params))
    return { ok: true, rows: res.rows, affected: res.affectedRows ?? 0, error: null }
  } catch (error) {
    return { ok: false, rows: [], affected: 0, error: String(error.message || error) }
  }
}

/** Superuser query (= the SQL editor / migrations), bypasses RLS. */
export const sql = (db, text, params = []) => db.query(text, params).then((r) => r.rows)
