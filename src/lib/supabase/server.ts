/**
 * Supabase server-side client
 *
 * IMPORTANTE: Este cliente usa la SERVICE ROLE KEY — nunca exponer al cliente.
 * Solo usar en API routes de Next.js (server-side).
 *
 * Patrón de uso:
 *   const sb = getSupabase()
 *   const { data, error } = await sb.from("expenses").select("*").eq("uid", uid)
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js"

let _client: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (_client) return _client

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error(
      "[Supabase] Variables de entorno no configuradas. " +
      "Agrega SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env.local y en Vercel."
    )
  }

  _client = createClient(url, key, {
    auth: { persistSession: false },
  })

  return _client
}

/**
 * Helper: lanza un error estándar de Supabase como NextResponse-friendly.
 * Usar cuando el error de Supabase no sea crítico pero quieras loguearlo.
 */
export function supabaseError(error: { message: string; code?: string }): string {
  return `[Supabase] ${error.code ?? "error"}: ${error.message}`
}
