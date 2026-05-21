/**
 * GET  /api/trusted-circle  — Lista miembros del Trusted Circle del usuario
 * POST /api/trusted-circle  — Añade un miembro
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

function rowToMember(row: Record<string, unknown>) {
  return {
    id:               row.id,
    userId:           row.member_uid ?? null,
    displayName:      row.display_name ?? "",
    email:            row.email,
    addedAt:          row.added_at,
    canSeeFullBudget: row.can_see_full_budget ?? false,
    linked:           row.linked ?? false,
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const { data: rows, error } = await getSupabase()
    .from("trusted_circle")
    .select("*")
    .eq("owner_uid", uid)
    .order("added_at", { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((rows ?? []).map(rowToMember))
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const { data, error } = await getSupabase()
    .from("trusted_circle")
    .insert({
      owner_uid:          uid,
      member_uid:         body.userId ?? null,
      email:              body.email,
      display_name:       body.displayName ?? null,
      can_see_full_budget: body.canSeeFullBudget ?? false,
      linked:             body.linked ?? false,
      added_at:           new Date().toISOString(),
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
