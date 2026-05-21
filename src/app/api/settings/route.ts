/**
 * GET   /api/settings  — Obtiene la configuración del usuario
 * PATCH /api/settings  — Actualiza la configuración del usuario (merge)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

const DEFAULTS = {
  defaultCurrency:         "USD",
  defaultPaymentMethod:    null,
  defaultCategory:         "otros",
  reminderDaysBefore:      3,
  compactView:             false,
  weekStartsOn:            1,
  onboardingCompleted:     false,
  accentColor:             "262",
  deductibleCategories:    [],
  autoTheme:               false,
  categoryLimits:          {},
  monthlyBudget:           null,
  monthStartDay:           1,
  notificationsEnabled:    false,
  notifyRecurring:         true,
  notifyWeeklySummary:     false,
  hiddenDefaultCategories: [],
  sheetsLastUrl:           null,
  sheetsLastSyncedAt:      null,
  handle:                  null,
  hasExportedPDF:          false,
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("user_settings")
    .select("data")
    .eq("uid", uid)
    .single()

  if (error?.code === "PGRST116") {
    return NextResponse.json(DEFAULTS)
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...DEFAULTS, ...(data?.data ?? {}) })
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const sb = getSupabase()

  // Leer settings actuales para hacer merge
  const { data: existing } = await sb
    .from("user_settings")
    .select("data")
    .eq("uid", uid)
    .single()

  const current = existing?.data ?? {}
  const merged  = { ...current, ...body }

  const { error } = await sb
    .from("user_settings")
    .upsert({ uid, data: merged }, { onConflict: "uid" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
