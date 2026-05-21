/**
 * GET  /api/automations  — Lista automatizaciones del usuario
 * POST /api/automations  — Crea una automatización
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToAutomation(row: Record<string, unknown>) {
  return {
    id:              row.id,
    uid:             row.uid,
    name:            row.name,
    enabled:         row.enabled ?? true,
    trigger:         row.trigger,
    triggerValue:    Number(row.trigger_value ?? 0),
    triggerCategory: row.trigger_category ?? undefined,
    action:          row.action,
    actionValue:     row.action_value ?? "",
    lastFiredAt:     row.last_fired_at ?? null,
    createdAt:       row.created_at,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("automations")
    .select("*")
    .eq("uid", uid)
    .order("created_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json((rows ?? []).map(rowToAutomation))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try { body = (await req.json()) as Record<string, unknown> }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const { data, error } = await getSupabase()
    .from("automations")
    .insert({
      uid,
      name:             body.name,
      enabled:          body.enabled ?? true,
      trigger:          body.trigger,
      trigger_value:    body.triggerValue ?? null,
      trigger_category: body.triggerCategory ?? null,
      action:           body.action,
      action_value:     body.actionValue ?? null,
      created_at:       new Date().toISOString(),
    })
    .select("id").single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data?.id }, { status: 201 })
}
