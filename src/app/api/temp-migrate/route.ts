/**
 * RUTA TEMPORAL — ejecuta las migraciones 004 y 005 en Supabase.
 * Protegida con secret. Se elimina después de usarla una vez.
 *
 * POST /api/temp-migrate
 * Body: { secret: "run-migrations-now", dbPassword: "<pg-password>" }
 *
 * El password se pasa en el body (nunca en código/env).
 */

import { NextRequest, NextResponse } from "next/server"
import pg from "pg"
import { readFileSync } from "fs"
import { join } from "path"

const SECRET = "run-migrations-now"
const DB_HOST = "db.jfzvkzhimrehowwntnhm.supabase.co"
const DB_USER = "postgres"
const DB_NAME = "postgres"
const DB_PORT = 5432

const migrations = [
  "004_extend_groups_schema.sql",
  "005_add_geo_income_currency.sql",
]

export async function POST(req: NextRequest) {
  let body: { secret?: string; dbPassword?: string }
  try { body = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  if (body.secret !== SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }
  if (!body.dbPassword) {
    return NextResponse.json({ error: "dbPassword requerido" }, { status: 400 })
  }

  const client = new pg.Client({
    host: DB_HOST,
    port: DB_PORT,
    user: DB_USER,
    password: body.dbPassword,
    database: DB_NAME,
    ssl: { rejectUnauthorized: false },
  })
  const results: { migration: string; status: string; error?: string }[] = []

  try {
    await client.connect()

    for (const filename of migrations) {
      const sqlPath = join(process.cwd(), "supabase", "migrations", filename)
      let sql: string
      try {
        sql = readFileSync(sqlPath, "utf8")
      } catch {
        results.push({ migration: filename, status: "error", error: "File not found" })
        continue
      }
      try {
        await client.query(sql)
        results.push({ migration: filename, status: "ok" })
      } catch (err) {
        results.push({ migration: filename, status: "error", error: (err as Error).message })
        // continue with next migration (best-effort)
      }
    }
  } catch (err) {
    return NextResponse.json({ error: "DB connection failed: " + (err as Error).message }, { status: 500 })
  } finally {
    await client.end().catch(() => {})
  }

  const allOk = results.every((r) => r.status === "ok")
  return NextResponse.json({ results }, { status: allOk ? 200 : 207 })
}
