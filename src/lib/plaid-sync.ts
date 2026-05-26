/**
 * plaid-sync.ts — Core transaction sync logic.
 *
 * Usa /transactions/sync (modern endpoint, cursor-based). Llamado tanto desde
 * /api/plaid/exchange (sync inicial) como del webhook (Fase 2) y un eventual
 * "Sync now" manual.
 */
import type { Transaction } from "plaid"
import { getPlaid } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase/server"

export interface SyncResult {
  added:    number
  modified: number
  removed:  number
  cursor:   string | null
}

/**
 * Mapea una transacción Plaid a una fila de `expenses`.
 * Solo importa transacciones SALIENTES (amount > 0 en Plaid = dinero saliendo).
 * Retorna `null` si la tx debe skipear (pendiente, income, etc.).
 */
function plaidTxToExpense(
  tx: Transaction,
  uid: string,
): Record<string, unknown> | null {
  // Plaid `amount`: positivo = expense, negativo = income/refund.
  // En Sandbox los amounts son siempre positivos para egresos.
  if (tx.pending) return null
  if (tx.amount <= 0) return null  // Phase 1: solo gastos

  const merchant =
    tx.merchant_name?.trim() ||
    tx.name?.trim() ||
    "Sin descripción"

  // Categoría: priorizar personal_finance_category (la nueva taxonomía),
  // fallback al array `category` deprecated, fallback a "otros".
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
 * Sync transacciones para un item de Plaid.
 * Loopea hasta que has_more=false, actualizando el cursor en DB.
 */
export async function syncTransactions(itemId: string): Promise<SyncResult> {
  const sb    = getSupabase()
  const plaid = getPlaid()

  // 1. Cargar item con su access_token y cursor actual
  const { data: item, error: itemErr } = await sb
    .from("plaid_items")
    .select("uid, access_token, cursor")
    .eq("id", itemId)
    .single()

  if (itemErr || !item) {
    throw new Error(`[plaid-sync] item ${itemId} no encontrado: ${itemErr?.message}`)
  }

  let cursor: string | null = item.cursor
  let totalAdded    = 0
  let totalModified = 0
  let totalRemoved  = 0

  // 2. Loop /transactions/sync hasta agotar
  while (true) {
    const res = await plaid.transactionsSync({
      access_token: item.access_token,
      cursor:       cursor ?? undefined,
      count:        500,
    })

    const { added, modified, removed, next_cursor, has_more } = res.data

    // ─── Added: insertar (upsert por seguridad con la unique index) ───
    if (added.length > 0) {
      const rows = added
        .map((tx) => plaidTxToExpense(tx, item.uid))
        .filter((r): r is Record<string, unknown> => r !== null)

      if (rows.length > 0) {
        const { error } = await sb
          .from("expenses")
          .upsert(rows, { onConflict: "uid,plaid_transaction_id", ignoreDuplicates: true })
        if (error) console.error("[plaid-sync] insert added failed", error)
        else totalAdded += rows.length
      }
    }

    // ─── Modified: update por plaid_transaction_id ───
    for (const tx of modified) {
      const row = plaidTxToExpense(tx, item.uid)
      if (!row) continue
      const { error } = await sb
        .from("expenses")
        .update(row)
        .eq("uid", item.uid)
        .eq("plaid_transaction_id", tx.transaction_id)
      if (error) console.error("[plaid-sync] update modified failed", error)
      else totalModified++
    }

    // ─── Removed: borrar el expense correspondiente ───
    if (removed.length > 0) {
      const ids = removed.map((r) => r.transaction_id).filter(Boolean) as string[]
      if (ids.length > 0) {
        const { error } = await sb
          .from("expenses")
          .delete()
          .eq("uid", item.uid)
          .in("plaid_transaction_id", ids)
        if (error) console.error("[plaid-sync] delete removed failed", error)
        else totalRemoved += ids.length
      }
    }

    cursor = next_cursor
    if (!has_more) break
  }

  // 3. Persistir el cursor y la marca de tiempo
  await sb
    .from("plaid_items")
    .update({
      cursor,
      last_synced_at: new Date().toISOString(),
      status:         "active",
      error_code:     null,
      error_message:  null,
      updated_at:     new Date().toISOString(),
    })
    .eq("id", itemId)

  return { added: totalAdded, modified: totalModified, removed: totalRemoved, cursor }
}
