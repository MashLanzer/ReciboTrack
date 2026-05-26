/**
 * POST /api/dev/plaid-pull-get
 *
 * Workaround: usa /transactions/get (endpoint legacy) en vez de
 * /transactions/sync para importar TODAS las transacciones del item.
 *
 * Justificación: /transactions/sync tiene un known issue en Plaid Sandbox
 * donde puede quedarse atascado devolviendo added=0 aunque el item tenga
 * tx disponibles (verificable con /transactions/get). Cuando pasa, ni
 * resetear el cursor a null lo arregla.
 *
 * /transactions/get es la API de pull tradicional — no usa cursor, te
 * devuelve un slice por rango de fechas con paginación offset/count.
 * Para Producción /transactions/sync es lo recomendado, pero /get sigue
 * funcionando bien y es lo que usa la mayoría del código existente de
 * Plaid en producción real.
 *
 * Mismo UID-gate dev. Importa con UPSERT por plaid_transaction_id, así
 * llamarlo varias veces no duplica.
 */
import { NextRequest, NextResponse } from "next/server"
import type { Transaction } from "plaid"
import { requireAuth } from "@/lib/api-auth"
import { getPlaid } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  const allowedUid = process.env.NEXT_PUBLIC_DEV_PRO_GRANT_UID
  if (!allowedUid || allowedUid !== auth.uid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const sb    = getSupabase()
  const plaid = getPlaid()

  const { data: items } = await sb
    .from("plaid_items")
    .select("id, access_token, institution_name")
    .eq("uid", auth.uid)

  if (!items || items.length === 0) {
    return NextResponse.json({ error: "Sin bancos conectados" }, { status: 400 })
  }

  const startDate = "2024-01-01"
  const endDate   = new Date().toISOString().slice(0, 10)

  const results: Array<{ institution: string | null; total_from_plaid: number; imported: number; filtered: number; error?: string }> = []

  for (const item of items) {
    try {
      // Paginate /transactions/get
      const allTxs: Transaction[] = []
      const count = 500
      let offset = 0
      while (true) {
        const res = await plaid.transactionsGet({
          access_token: item.access_token,
          start_date:   startDate,
          end_date:     endDate,
          options:      { offset, count },
        })
        allTxs.push(...res.data.transactions)
        if (allTxs.length >= res.data.total_transactions) break
        offset += res.data.transactions.length
        if (res.data.transactions.length === 0) break  // safety
      }

      // Convertir a filas de expenses (filtrar pending + income)
      const rows = allTxs
        .filter(tx => !tx.pending && tx.amount > 0)
        .map(tx => ({
          uid:                  auth.uid,
          account:              "personal",
          merchant:             tx.merchant_name?.trim() || tx.name?.trim() || "Sin descripción",
          date:                 new Date(tx.date).toISOString(),
          total:                tx.amount,
          subtotal:             tx.amount,
          currency:             tx.iso_currency_code ?? tx.unofficial_currency_code ?? "USD",
          category:             tx.personal_finance_category?.primary?.toLowerCase().replace(/_/g, " ")
                                || tx.category?.[0]?.toLowerCase()
                                || "otros",
          payment_method:       tx.payment_channel ?? null,
          plaid_transaction_id: tx.transaction_id,
          plaid_account_id:     tx.account_id,
          source:               "plaid",
          notes:                "",
          items:                [],
          privacy:              "private",
        }))

      let inserted = 0
      if (rows.length > 0) {
        const { error } = await sb
          .from("expenses")
          .upsert(rows, { onConflict: "uid,plaid_transaction_id", ignoreDuplicates: true })
        if (error) throw error
        inserted = rows.length
      }

      // Marcar el item como sincronizado
      await sb
        .from("plaid_items")
        .update({ last_synced_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", item.id)

      results.push({
        institution:      item.institution_name,
        total_from_plaid: allTxs.length,
        imported:         inserted,
        filtered:         allTxs.length - rows.length,
      })
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const e = err as any
      const detail = e?.response?.data?.error_message
                   || e?.response?.data?.error_code
                   || e?.message
                   || "Error"
      results.push({
        institution:      item.institution_name,
        total_from_plaid: 0,
        imported:         0,
        filtered:         0,
        error:            detail,
      })
    }
  }

  return NextResponse.json({ ok: true, results })
}
