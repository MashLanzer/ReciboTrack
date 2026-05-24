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

export const maxDuration = 60 // segundos — esta ruta necesita tiempo para conectar al DB
import pg from "pg"
import { readFileSync } from "fs"
import { join } from "path"

const SECRET = "run-migrations-now"
const PROJECT_REF = "jfzvkzhimrehowwntnhm"
const DB_NAME = "postgres"

// Intentamos múltiples hosts en orden hasta que uno resuelva
const DB_CONFIGS = [
  // Session pooler us-east-1 (Vercel IAD1 está en us-east-1)
  { host: `aws-0-us-east-1.pooler.supabase.com`, port: 5432, user: `postgres.${PROJECT_REF}` },
  // Session pooler us-west-1
  { host: `aws-0-us-west-1.pooler.supabase.com`,  port: 5432, user: `postgres.${PROJECT_REF}` },
  // Session pooler eu-west-1
  { host: `aws-0-eu-west-1.pooler.supabase.com`,  port: 5432, user: `postgres.${PROJECT_REF}` },
  // Directo (por si acaso)
  { host: `db.${PROJECT_REF}.supabase.co`,          port: 5432, user: "postgres" },
]

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

  // Prueba configs en orden hasta conectar
  let client: pg.Client | null = null
  let connectedConfig: string | null = null
  const connErrors: string[] = []
  for (const cfg of DB_CONFIGS) {
    const c = new pg.Client({ host: cfg.host, port: cfg.port, user: cfg.user, password: body.dbPassword, database: DB_NAME, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 })
    try {
      await c.connect()
      client = c
      connectedConfig = `${cfg.user}@${cfg.host}:${cfg.port}`
      break
    } catch (e) {
      connErrors.push(`${cfg.host}: ${(e as Error).message}`)
      await c.end().catch(() => {})
    }
  }
  if (!client) {
    return NextResponse.json({ error: "No se pudo conectar a ningún host", details: connErrors }, { status: 500 })
  }

  const results: { migration: string; status: string; error?: string }[] = []

  try {
    // client ya conectado

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
  return NextResponse.json({ connectedVia: connectedConfig, results }, { status: allOk ? 200 : 207 })
}
