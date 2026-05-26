/**
 * GET /api/plaid/items
 *
 * Lista todos los bancos conectados del usuario con sus accounts.
 * Devuelve el item-shape que la UI consume directamente.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  const sb = getSupabase()

  const { data: items, error: itemsErr } = await sb
    .from("plaid_items")
    .select("id, institution_id, institution_name, status, error_code, error_message, last_synced_at, created_at")
    .eq("uid", auth.uid)
    .order("created_at", { ascending: false })

  if (itemsErr) return NextResponse.json({ error: itemsErr.message }, { status: 500 })

  if (!items || items.length === 0) {
    return NextResponse.json([])
  }

  const { data: accounts, error: accErr } = await sb
    .from("plaid_accounts")
    .select("id, item_id, plaid_account_id, name, mask, type, subtype, current_balance, available_balance, currency, hidden")
    .eq("uid", auth.uid)

  if (accErr) return NextResponse.json({ error: accErr.message }, { status: 500 })

  const accountsByItem = new Map<string, typeof accounts>()
  for (const a of accounts ?? []) {
    const list = accountsByItem.get(a.item_id) ?? []
    list.push(a)
    accountsByItem.set(a.item_id, list)
  }

  return NextResponse.json(
    items.map((it) => ({ ...it, accounts: accountsByItem.get(it.id) ?? [] }))
  )
}
