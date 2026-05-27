/**
 * PATCH /api/categories/reorder — Reordena las categorías del usuario
 * Body: { order: string[] } — array de IDs en el nuevo orden
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: { order?: unknown }
  try {
    body = (await req.json()) as { order?: unknown }
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  if (!Array.isArray(body.order)) {
    return NextResponse.json({ error: "Se requiere un array 'order'" }, { status: 400 })
  }

  const order = body.order as string[]
  const sb = getSupabase()

  // Update each category's sort_order to its index in the array
  for (let i = 0; i < order.length; i++) {
    const id = order[i]
    const { error } = await sb
      .from("categories")
      .update({ sort_order: i })
      .eq("id", id)
      .eq("uid", uid)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
