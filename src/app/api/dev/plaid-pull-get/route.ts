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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results: any[] = []

  for (const item of items) {
    try {
      // Paginate /transactions/get
      const allTxs: Transaction[] = []
      const count = 100  // antes 500 — bajamos por si Plaid Sandbox tiene cap
      let offset = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const loopLog: any[] = []
      let safety = 0
      while (safety++ < 20) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const res = await (plaid as any).transactionsGet({
          access_token: item.access_token,
          start_date:   startDate,
          end_date:     endDate,
          options:      { offset, count },
        })
        loopLog.push({
          iter:               safety,
          offset,
          received:           res.data.transactions?.length ?? 0,
          total_transactions: res.data.total_transactions,
          item_status:        res.data.item?.status?.transactions ?? null,
          accounts_count:     res.data.accounts?.length ?? 0,
        })
        const got = res.data.transactions ?? []
        allTxs.push(...got)
        if (allTxs.length >= (res.data.total_transactions ?? 0)) break
        if (got.length === 0) break
        offset += got.length
      }

      // Stats: ¿cuántas filtra cada criterio?
      const filtersBreakdown = {
        total:          allTxs.length,
        pending:        allTxs.filter(t => t.pending).length,
        zero_or_neg:    allTxs.filter(t => t.amount <= 0).length,
        passes_filter:  allTxs.filter(t => !t.pending && t.amount > 0).length,
      }

      // Sample de las 3 primeras tx (útil para entender el shape)
      const sample = allTxs.slice(0, 3).map(t => ({
        id:       t.transaction_id,
        merchant: t.merchant_name || t.name,
        amount:   t.amount,
        currency: t.iso_currency_code,
        date:     t.date,
        pending:  t.pending,
        category: t.personal_finance_category?.primary || t.category?.[0],
      }))

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

      // Insert manualmente filtrando duplicados — el partial unique index
      // sobre (uid, plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL
      // NO funciona con ON CONFLICT en Supabase, así que hacemos el dedup en JS.
      let inserted = 0
      if (rows.length > 0) {
        const txIds = rows.map(r => r.plaid_transaction_id)
        const { data: existing } = await sb
          .from("expenses")
          .select("plaid_transaction_id")
          .eq("uid", auth.uid)
          .in("plaid_transaction_id", txIds)
        const existingSet = new Set((existing ?? []).map(r => r.plaid_transaction_id as string))
        const newRows = rows.filter(r => !existingSet.has(r.plaid_transaction_id))
        if (newRows.length > 0) {
          const { error } = await sb.from("expenses").insert(newRows)
          if (error) throw error
          inserted = newRows.length
        }
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
        debug: {
          loops: loopLog,
          filtersBreakdown,
          sample,
        },
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
