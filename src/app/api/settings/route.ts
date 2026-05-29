/**
 * GET   /api/settings  — Obtiene la configuración del usuario
 * PATCH /api/settings  — Actualiza la configuración del usuario (merge)
 */

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

// Solo los campos que el usuario puede modificar — campos sensibles (plan, uid, etc.) no están aquí
const SettingsPatchSchema = z.object({
  defaultCurrency:         z.string().length(3).optional(),
  defaultPaymentMethod:    z.string().nullable().optional(),
  defaultCategory:         z.string().optional(),
  reminderDaysBefore:      z.number().int().min(0).max(30).optional(),
  compactView:             z.boolean().optional(),
  weekStartsOn:            z.number().int().min(0).max(6).optional(),
  onboardingCompleted:     z.boolean().optional(),
  accentColor:             z.string().optional(),
  deductibleCategories:    z.array(z.string()).optional(),
  autoTheme:               z.boolean().optional(),
  categoryLimits:          z.record(z.string(), z.number()).optional(),
  monthlyBudget:           z.number().nullable().optional(),
  monthStartDay:           z.number().int().min(1).max(28).optional(),
  notificationsEnabled:    z.boolean().optional(),
  notifyRecurring:         z.boolean().optional(),
  notifyWeeklySummary:     z.boolean().optional(),
  hiddenDefaultCategories: z.array(z.string()).optional(),
  sheetsLastUrl:           z.string().url().nullable().optional(),
  sheetsLastSyncedAt:      z.string().nullable().optional(),
  handle:                  z.string().nullable().optional(),
  hasExportedPDF:          z.boolean().optional(),
}).strict()

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

  let raw: unknown
  try { raw = await req.json() }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const parsed = SettingsPatchSchema.safeParse(raw)
  if (!parsed.success) {
    return NextResponse.json({ error: "Campos inválidos", details: parsed.error.flatten() }, { status: 400 })
  }
  const body = parsed.data

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
