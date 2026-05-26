/**
 * POST /api/plaid/items/[id]/sync
 *
 * Trigger manual de sync de transacciones para un item. Útil mientras
 * no tenemos el webhook (Fase 2) y para refresh on-demand desde la UI.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"
import { syncTransactions } from "@/lib/plaid-sync"

type Params = { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: Params) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { id } = await params

  // Verificar pertenencia
  const { data: item } = await getSupabase()
    .from("plaid_items")
    .select("id")
    .eq("id", id)
    .eq("uid", auth.uid)
    .single()

  if (!item) return NextResponse.json({ error: "Banco no encontrado" }, { status: 404 })

  try {
    const result = await syncTransactions(id)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[plaid/items/sync]", err)
    return NextResponse.json({ error: "Error al sincronizar" }, { status: 500 })
  }
}
