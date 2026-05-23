/**
 * PATCH  /api/expenses/[id]  — Actualiza campos de un gasto
 * DELETE /api/expenses/[id]  — Elimina un gasto
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  // Mapear camelCase → snake_case para los campos permitidos
  const allowed: Record<string, string> = {
    merchant:        "merchant",
    date:            "date",
    items:           "items",
    subtotal:        "subtotal",
    tax:             "tax",
    total:           "total",
    paymentMethod:   "payment_method",
    reference:       "reference",
    category:        "category",
    currency:        "currency",
    notes:           "notes",
    tags:            "tags",
    receiptImageUrl: "receipt_image_url",
    account:         "account",
    project:         "project",
    privacy:         "privacy",
    archived:        "archived",
    flagged:         "flagged",
    flaggedAt:       "flagged_at",
    recurringId:     "recurring_id",
    cityName:        "geo_city",
    countryCode:     "geo_country_code",
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const [camel, snake] of Object.entries(allowed)) {
    if (camel in body) patch[snake] = body[camel]
  }
  // Geolocalización — objeto anidado → columnas planas
  if ("geo" in body) {
    const geo = body.geo as { lat?: number; lng?: number; accuracy?: number } | null
    patch.geo_lat      = geo?.lat ?? null
    patch.geo_lng      = geo?.lng ?? null
    patch.geo_accuracy = geo?.accuracy ?? null
  }

  const { error } = await getSupabase()
    .from("expenses")
    .update(patch)
    .eq("id", id)
    .eq("uid", uid)  // seguridad: solo el dueño puede editar

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth
  const { id } = await params

  const { error } = await getSupabase()
    .from("expenses")
    .delete()
    .eq("id", id)
    .eq("uid", uid)  // seguridad: solo el dueño puede borrar

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
