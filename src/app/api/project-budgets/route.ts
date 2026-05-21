/**
 * GET   /api/project-budgets  — Devuelve el mapa project → límite del usuario
 * PATCH /api/project-budgets  — Actualiza o elimina el presupuesto de un proyecto
 *
 * Body del PATCH: { projectName: string, budget: number | null }
 *   budget = null → elimina la entrada del proyecto
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data, error } = await getSupabase()
    .from("project_budgets")
    .select("budgets")
    .eq("uid", uid)
    .single()

  if (error?.code === "PGRST116") return NextResponse.json({})
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data as Record<string, unknown>)?.budgets ?? {})
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { projectName: string; budget: number | null }
  try { body = (await req.json()) as typeof body }
  catch { return NextResponse.json({ error: "Body inválido" }, { status: 400 }) }

  const sb = getSupabase()

  // Leer presupuestos actuales
  const { data: existing } = await sb
    .from("project_budgets")
    .select("budgets")
    .eq("uid", uid)
    .single()

  const current = ((existing as Record<string, unknown> | null)?.budgets ?? {}) as Record<string, number>

  if (body.budget === null) {
    delete current[body.projectName]
  } else {
    current[body.projectName] = body.budget
  }

  const { error } = await sb
    .from("project_budgets")
    .upsert({ uid, budgets: current }, { onConflict: "uid" })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
