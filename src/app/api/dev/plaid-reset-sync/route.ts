/**
 * POST /api/dev/plaid-reset-sync
 *
 * Resetea el cursor de TODOS los plaid_items del usuario a NULL y corre
 * syncTransactions(). Cuando se llama a /transactions/sync con cursor=null,
 * Plaid devuelve TODO el historial desde cero — útil cuando el cursor
 * quedó "stuck" porque el sync inicial corrió antes de que Plaid tuviera
 * los datos listos (bug clásico de Plaid Sandbox).
 *
 * Mismo gate UID que /api/dev/grant-pro.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { syncTransactions } from "@/lib/plaid-sync"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  const allowedUid = process.env.NEXT_PUBLIC_DEV_PRO_GRANT_UID
  if (!allowedUid || allowedUid !== auth.uid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const sb = getSupabase()

  const { data: items, error } = await sb
    .from("plaid_items")
    .select("id, institution_name")
    .eq("uid", auth.uid)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Sin bancos conectados" }, { status: 400 })
  }

  // Nullear el cursor de todos los items del usuario
  const { error: clearErr } = await sb
    .from("plaid_items")
    .update({ cursor: null })
    .eq("uid", auth.uid)

  if (clearErr) return NextResponse.json({ error: clearErr.message }, { status: 500 })

  // Re-sync cada item — ahora arranca desde cursor=null y trae todo
  const results = await Promise.all(items.map(async (it) => {
    try {
      const r = await syncTransactions(it.id)
      return { item_id: it.id, institution: it.institution_name, ...r }
    } catch (err) {
      return { item_id: it.id, institution: it.institution_name, error: (err as Error).message }
    }
  }))

  return NextResponse.json({
    ok:      true,
    cleared: items.length,
    results,
  })
}
