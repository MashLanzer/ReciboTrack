/**
 * DELETE /api/plaid/items/[id]
 *
 * Desconecta un banco: revoca el access_token en Plaid (para dejar de
 * consumir cuota) y luego borra el item de Supabase. ON CASCADE elimina
 * los accounts; las expenses ya importadas se mantienen (el usuario las
 * tiene en su historial).
 *
 * POST /api/plaid/items/[id]/sync
 *  → ver route.ts hermano si se decide implementar; por ahora dejamos
 *    el sync manual fuera de scope de Fase 1.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getPlaid } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase/server"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  const sb = getSupabase()

  // Cargar el item (verificar pertenencia + obtener access_token)
  const { data: item, error: getErr } = await sb
    .from("plaid_items")
    .select("access_token")
    .eq("id", id)
    .eq("uid", auth.uid)
    .single()

  if (getErr || !item) {
    return NextResponse.json({ error: "Banco no encontrado" }, { status: 404 })
  }

  // Revocar el item en Plaid (mejor esfuerzo — si falla, igual borramos local)
  try {
    await getPlaid().itemRemove({ access_token: item.access_token })
  } catch (err) {
    console.error("[plaid/items DELETE] itemRemove failed", err)
  }

  const { error: delErr } = await sb
    .from("plaid_items")
    .delete()
    .eq("id", id)
    .eq("uid", auth.uid)

  if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
