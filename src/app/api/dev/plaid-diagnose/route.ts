/**
 * POST /api/dev/plaid-diagnose
 *
 * ⚠️ DEV-ONLY — Corre una suite de pruebas contra Plaid Sandbox para
 * verificar end-to-end que el bank sync funciona antes de pasar a
 * producción real.
 *
 * Tests:
 *   A. Sandbox /transactions/create — inyecta tx ficticia, corre sync,
 *      verifica que aparece en `expenses` con source=plaid
 *   B. Sandbox /item/fire_webhook — dispara webhook SYNC_UPDATES_AVAILABLE,
 *      espera 5s, verifica que last_synced_at se actualizó (proxy para
 *      "el webhook llegó y se procesó")
 *   C. Stats — counts de items, accounts, plaid expenses, duplicados
 *
 * Gating: mismo NEXT_PUBLIC_DEV_PRO_GRANT_UID que /api/dev/grant-pro.
 */
import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getPlaid } from "@/lib/plaid"
import { getSupabase } from "@/lib/supabase/server"
import { syncTransactions } from "@/lib/plaid-sync"

interface TestResult {
  name:    string
  status:  "pass" | "fail" | "skip"
  detail:  string
  ms?:     number
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth

  const allowedUid = process.env.NEXT_PUBLIC_DEV_PRO_GRANT_UID
  if (!allowedUid || allowedUid !== auth.uid) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 })
  }

  const sb    = getSupabase()
  const plaid = getPlaid()

  // Pick the user's first plaid_item
  const { data: item } = await sb
    .from("plaid_items")
    .select("id, access_token, plaid_item_id, last_synced_at, institution_name")
    .eq("uid", auth.uid)
    .order("created_at", { ascending: true })
    .limit(1)
    .single()

  if (!item) {
    return NextResponse.json({
      error: "No tienes ningún banco conectado. Conecta uno en /banks primero.",
    }, { status: 400 })
  }

  const results: TestResult[] = []

  // ─── TEST A: /sandbox/transactions/create + sync verificado ───────────
  {
    const t0 = Date.now()
    try {
      const { count: beforeCount } = await sb
        .from("expenses")
        .select("*", { count: "exact", head: true })
        .eq("uid", auth.uid)
        .eq("source", "plaid")

      const today = new Date().toISOString().slice(0, 10)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (plaid as any).sandboxTransactionsCreate({
        access_token: item.access_token,
        transactions: [{
          amount:           42.99,
          date_posted:      today,
          date_transacted:  today,
          description:      "ReciboTrack Diagnose Test",
          iso_currency_code: "USD",
        }],
      })

      // Forzar el sync (no esperamos al webhook orgánico)
      const syncRes = await syncTransactions(item.id)

      const { count: afterCount } = await sb
        .from("expenses")
        .select("*", { count: "exact", head: true })
        .eq("uid", auth.uid)
        .eq("source", "plaid")

      const delta = (afterCount ?? 0) - (beforeCount ?? 0)
      const pass = delta >= 1 && syncRes.added >= 1

      results.push({
        name:   "A · Inyectar tx + sync la importa",
        status: pass ? "pass" : "fail",
        detail: `Antes: ${beforeCount ?? 0} · Después: ${afterCount ?? 0} · Δ ${delta} · sync.added=${syncRes.added}`,
        ms:     Date.now() - t0,
      })
    } catch (err) {
      results.push({
        name:   "A · Inyectar tx + sync la importa",
        status: "fail",
        detail: `Error: ${(err as Error).message}`,
        ms:     Date.now() - t0,
      })
    }
  }

  // ─── TEST B: fire_webhook + verificar last_synced_at se actualiza ─────
  {
    const t0 = Date.now()
    try {
      const beforeSync = item.last_synced_at
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (plaid as any).sandboxItemFireWebhook({
        access_token: item.access_token,
        webhook_code: "SYNC_UPDATES_AVAILABLE",
      })

      // Esperamos hasta 8s a que el webhook se procese asíncronamente.
      // Si Plaid + nuestro endpoint funcionan, last_synced_at cambia.
      let updated = false
      let newLastSynced: string | null = null
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const { data: check } = await sb
          .from("plaid_items")
          .select("last_synced_at")
          .eq("id", item.id)
          .single()
        if (check && check.last_synced_at !== beforeSync) {
          updated = true
          newLastSynced = check.last_synced_at
          break
        }
      }

      results.push({
        name:   "B · Webhook llega y se procesa",
        status: updated ? "pass" : "fail",
        detail: updated
          ? `last_synced_at: ${beforeSync ?? "null"} → ${newLastSynced}`
          : "last_synced_at no cambió en 8s. Posibles causas: (1) webhook URL no configurada en Plaid Dashboard, (2) JWT verification rechaza, (3) en sandbox los webhooks orgánicos son flaky — revisa Vercel → Logs",
        ms: Date.now() - t0,
      })
    } catch (err) {
      results.push({
        name:   "B · Webhook llega y se procesa",
        status: "fail",
        detail: `Error: ${(err as Error).message}`,
        ms:     Date.now() - t0,
      })
    }
  }

  // ─── TEST C: Stats + sanity checks ────────────────────────────────────
  let stats: Record<string, number | string> = {}
  {
    try {
      const { count: itemsCount }    = await sb.from("plaid_items").select("*", { count: "exact", head: true }).eq("uid", auth.uid)
      const { count: accountsCount } = await sb.from("plaid_accounts").select("*", { count: "exact", head: true }).eq("uid", auth.uid)
      const { count: plaidExpenses } = await sb.from("expenses").select("*", { count: "exact", head: true }).eq("uid", auth.uid).eq("source", "plaid")

      // Duplicados: agrupamos por plaid_transaction_id, contamos los grupos > 1.
      // Si esta consulta devuelve cualquier fila significa que se importó la
      // misma tx dos veces — eso sería un bug.
      const { data: allTxIds } = await sb
        .from("expenses")
        .select("plaid_transaction_id")
        .eq("uid", auth.uid)
        .not("plaid_transaction_id", "is", null)
      const seen = new Map<string, number>()
      for (const row of allTxIds ?? []) {
        const id = row.plaid_transaction_id as string
        seen.set(id, (seen.get(id) ?? 0) + 1)
      }
      const duplicates = [...seen.values()].filter(n => n > 1).length

      stats = {
        institution:     item.institution_name ?? "?",
        items:           itemsCount    ?? 0,
        accounts:        accountsCount ?? 0,
        plaid_expenses:  plaidExpenses ?? 0,
        duplicates,
      }

      results.push({
        name:   "C · Stats coherentes",
        status: "pass",
        detail: JSON.stringify(stats),
      })
    } catch (err) {
      results.push({
        name:   "C · Stats coherentes",
        status: "fail",
        detail: `Error: ${(err as Error).message}`,
      })
    }
  }

  const allPass = results.every(r => r.status === "pass")

  return NextResponse.json({
    ok:       allPass,
    summary:  allPass
      ? "✅ Todos los tests pasaron — la integración funciona end-to-end"
      : "⚠️ Algún test falló — revisa los detalles",
    stats,
    tests:    results,
  })
}
