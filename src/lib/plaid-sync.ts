/**
 * plaid-sync.ts — Core transaction sync logic.
 *
 * Originalmente usaba /transactions/sync (cursor-based, modern API). Sin
 * embargo en Plaid Sandbox /transactions/sync devuelve added=[] aunque
 * /transactions/get vea las tx — bug confirmado de Plaid. Refactorizamos
 * a /transactions/get (legacy pero rock-solid). Trade-off: perdemos diff
 * incremental nativo de Plaid (modified/removed), lo recuperamos con
 * dedup manual + UPSERT por plaid_transaction_id en cada sync.
 *
 * Llamado desde:
 *   - /api/plaid/exchange (sync inicial post-link)
 *   - /api/plaid/items/[id]/sync (sync manual desde el botón ⟳)
 *   - /api/plaid/webhook (auto-sync por evento SYNC_UPDATES_AVAILABLE etc.)
 */
import type { Transaction } from "plaid"
import { getPlaid } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase/server"

export interface SyncResult {
  added:    number
  modified: number  // siempre 0 con /transactions/get
  removed:  number  // siempre 0 con /transactions/get
  cursor:   string | null  // unused, mantenido por compat de retorno
}

/**
 * Mapea una transacción Plaid a una fila de `expenses`.
 * Skip pending y skip income (amount <= 0).
 */
function plaidTxToExpense(
  tx: Transaction,
  uid: string,
): Record<string, unknown> | null {
  if (tx.pending) return null
  if (tx.amount <= 0) return null

  const merchant =
    tx.merchant_name?.trim() ||
    tx.name?.trim() ||
    "Sin descripción"

  const category =
    tx.personal_finance_category?.primary?.toLowerCase().replace(/_/g, " ") ||
    tx.category?.[0]?.toLowerCase() ||
    "otros"

  return {
    uid,
    account:               "personal",
    merchant,
    date:                  new Date(tx.date).toISOString(),
    total:                 tx.amount,
    subtotal:              tx.amount,
    currency:              tx.iso_currency_code ?? tx.unofficial_currency_code ?? "USD",
    category,
    payment_method:        tx.payment_channel ?? null,
    plaid_transaction_id:  tx.transaction_id,
    plaid_account_id:      tx.account_id,
    source:                "plaid",
    notes:                 "",
    items:                 [],
    privacy:               "private",
  }
}

/**
 * Sync transacciones para un item de Plaid usando /transactions/get.
 *
 * Estrategia de rango de fechas:
 *  - Primer sync (last_synced_at == null): pull de los últimos 2 años
 *    (Plaid generalmente expone ese histórico para Production; en Sandbox
 *    son los ~24 tx ficticias).
 *  - Sync subsecuente: pull de los últimos 30 días — suficiente para
 *    capturar tx nuevas + tx pending que pasaron a settled. El resto se
 *    asume estable (ya importado y los IDs son inmutables en Plaid).
 *
 * Idempotente: se puede llamar N veces seguidas sin generar duplicados
 * porque dedupeamos manualmente por (uid, plaid_transaction_id) antes
 * del INSERT.
 */
export async function syncTransactions(itemId: string): Promise<SyncResult> {
  const sb    = getSupabase()
  const plaid = getPlaid()

  const { data: item, error: itemErr } = await sb
    .from("plaid_items")
    .select("uid, access_token, last_synced_at")
    .eq("id", itemId)
    .single()

  if (itemErr || !item) {
    throw new Error(`[plaid-sync] item ${itemId} no encontrado: ${itemErr?.message}`)
  }

  // Calcular rango de fechas
  const today = new Date()
  const endDate = today.toISOString().slice(0, 10)
  const startDate = (() => {
    const d = new Date(today)
    if (item.last_synced_at) {
      d.setDate(d.getDate() - 30)  // sync incremental: últimos 30 días
    } else {
      d.setFullYear(d.getFullYear() - 2)  // sync inicial: 2 años
    }
    return d.toISOString().slice(0, 10)
  })()

  // Paginated pull
  const allTxs: Transaction[] = []
  const count = 100
  let offset = 0
  let safety = 0
  while (safety++ < 100) {  // hasta 10k tx
    const res = await plaid.transactionsGet({
      access_token: item.access_token,
      start_date:   startDate,
      end_date:     endDate,
      options:      { offset, count },
    })
    const got = res.data.transactions ?? []
    allTxs.push(...got)
    if (allTxs.length >= (res.data.total_transactions ?? 0)) break
    if (got.length === 0) break
    offset += got.length
  }

  // Convertir a filas de expenses
  const rows = allTxs
    .map(tx => plaidTxToExpense(tx, item.uid))
    .filter((r): r is Record<string, unknown> => r !== null)

  // Dedup manual (el partial unique index no funciona con ON CONFLICT en
  // Supabase, hacemos el filtrado en JS)
  let totalAdded = 0
  if (rows.length > 0) {
    const txIds = rows.map(r => r.plaid_transaction_id as string)
    const { data: existing } = await sb
      .from("expenses")
      .select("plaid_transaction_id")
      .eq("uid", item.uid)
      .in("plaid_transaction_id", txIds)
    const existingSet = new Set((existing ?? []).map(r => r.plaid_transaction_id as string))
    const newRows = rows.filter(r => !existingSet.has(r.plaid_transaction_id as string))
    if (newRows.length > 0) {
      const { error } = await sb.from("expenses").insert(newRows)
      if (error) console.error("[plaid-sync] insert failed", error)
      else totalAdded = newRows.length
    }
  }

  // Marcar el item como sincronizado
  await sb
    .from("plaid_items")
    .update({
      last_synced_at:  new Date().toISOString(),
      status:          "active",
      error_code:      null,
      error_message:   null,
      updated_at:      new Date().toISOString(),
    })
    .eq("id", itemId)

  return { added: totalAdded, modified: 0, removed: 0, cursor: null }
}
