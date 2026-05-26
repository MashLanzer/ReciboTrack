/**
 * GET  /api/profile  — Devuelve el perfil del usuario autenticado
 * POST /api/profile  — Crea o actualiza el perfil (upsert)
 * PATCH /api/profile — Actualiza campos específicos del perfil
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

// ── GET — leer perfil ─────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("profiles")
    .select("*")
    .eq("uid", uid)
    .single()

  if (error?.code === "PGRST116") {
    // No encontrado — perfil aún no creado
    return NextResponse.json(null, { status: 404 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

// ── POST — crear/actualizar perfil (upsert) ───────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: {
    displayName?: string
    email?: string
    photoURL?: string | null
    defaultCurrency?: string
  }
  try {
    body = (await req.json()) as typeof body
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const sb = getSupabase()

  const { error } = await sb
    .from("profiles")
    .upsert({
      uid,
      display_name:     body.displayName ?? null,
      email:            body.email ?? null,
      photo_url:        body.photoURL ?? null,
      default_currency: body.defaultCurrency ?? "USD",
      updated_at:       new Date().toISOString(),
    }, { onConflict: "uid" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // También actualizar el directorio público para lookup de Trusted Circle
  if (body.email) {
    await sb
      .from("user_directory")
      .upsert({
        email:        body.email.toLowerCase(),
        uid,
        display_name: body.displayName ?? null,
        photo_url:    body.photoURL ?? null,
        updated_at:   new Date().toISOString(),
      }, { onConflict: "email" })
  }

  return NextResponse.json({ ok: true })
}

// ── PATCH — actualizar campos específicos ─────────────────────────────────────

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  // Mapear camelCase → snake_case para los campos permitidos
  const allowed: Record<string, string> = {
    displayName:     "display_name",
    email:           "email",
    photoURL:        "photo_url",
    defaultCurrency: "default_currency",
    uiPrefs:         "ui_prefs",
    webhookUrl:      "webhook_url",
    webhookEvents:   "webhook_events",
    handle:          "handle",
    paypalHandle:    "paypal_handle",
    venmoHandle:     "venmo_handle",
    cashappCashtag:  "cashapp_cashtag",
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }

  const { error } = await getSupabase()
    .from("profiles")
    .update(patch)
    .eq("uid", uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
