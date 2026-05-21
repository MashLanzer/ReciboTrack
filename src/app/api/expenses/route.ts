/**
 * GET  /api/expenses  — Lista gastos del usuario autenticado (con filtros y paginación)
 * POST /api/expenses  — Crea un nuevo gasto
 *
 * Query params para GET:
 *   category   — filtrar por categoría
 *   account    — "personal" | "business"
 *   startDate  — ISO date string (>=)
 *   endDate    — ISO date string (<=)
 *   search     — texto libre
 *   tags       — coma-separados
 *   sort       — "date_desc" | "date_asc" | "amount_desc" | "amount_asc" | "merchant_asc" | "merchant_desc" | "category_asc"
 *   page       — número de página (default 1)
 *   limit      — tamaño de página (default 10)
 *   archived   — "true" | "false" (default "false")
 *   flagged    — "true" — solo los marcados
 *   all        — "true" — sin paginar (para exports / análisis)
 */

import { NextRequest, NextResponse } from "next/server"
import { requireAuth } from "@/lib/api-auth"
import { getSupabase } from "@/lib/supabase/server"

const PER_PAGE = 10

// ── Helpers de mapeo ──────────────────────────────────────────────────────────

/** snake_case DB row → camelCase Expense (con fechas como ISO string) */
function rowToExpense(row: Record<string, unknown>) {
  return {
    id:               row.id,
    account:          row.account,
    merchant:         row.merchant,
    date:             row.date,           // ISO string
    items:            row.items ?? [],
    subtotal:         Number(row.subtotal),
    tax:              Number(row.tax),
    total:            Number(row.total),
    paymentMethod:    row.payment_method ?? null,
    reference:        row.reference ?? null,
    category:         row.category,
    currency:         row.currency,
    notes:            row.notes ?? "",
    tags:             row.tags ?? [],
    receiptImageUrl:  row.receipt_image_url ?? null,
    project:          row.project ?? null,
    privacy:          row.privacy ?? "private",
    archived:         row.archived ?? false,
    flagged:          row.flagged ?? false,
    flaggedAt:        row.flagged_at ?? null,
    recurringId:      row.recurring_id ?? null,
    createdAt:        row.created_at,
    updatedAt:        row.updated_at,
  }
}

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  const sp = req.nextUrl.searchParams
  const category  = sp.get("category")
  const account   = sp.get("account")
  const startDate = sp.get("startDate")
  const endDate   = sp.get("endDate")
  const search    = sp.get("search")?.toLowerCase()
  const tagsRaw   = sp.get("tags")
  const sort      = sp.get("sort") ?? "date_desc"
  const page      = Math.max(1, parseInt(sp.get("page") ?? "1", 10))
  const limit     = parseInt(sp.get("limit") ?? String(PER_PAGE), 10)
  const archived  = sp.get("archived") === "true"
  const flagged   = sp.get("flagged") === "true"
  const all       = sp.get("all") === "true"

  const sb = getSupabase()
  let q = sb.from("expenses").select("*").eq("uid", uid)

  // Filtros directos en SQL
  if (category)  q = q.eq("category", category)
  if (account && account !== "all") q = q.eq("account", account)
  if (startDate) q = q.gte("date", startDate)
  if (endDate)   q = q.lte("date", endDate)
  if (archived)  q = q.eq("archived", true)
  else           q = q.eq("archived", false)
  if (flagged)   q = q.eq("flagged", true)

  // Orden SQL
  const sortMap: Record<string, { column: string; ascending: boolean }> = {
    date_desc:     { column: "date",     ascending: false },
    date_asc:      { column: "date",     ascending: true  },
    amount_desc:   { column: "total",    ascending: false },
    amount_asc:    { column: "total",    ascending: true  },
    merchant_asc:  { column: "merchant", ascending: true  },
    merchant_desc: { column: "merchant", ascending: false },
    category_asc:  { column: "category", ascending: true  },
  }
  const { column, ascending } = sortMap[sort] ?? sortMap.date_desc
  q = q.order(column, { ascending })

  const { data: rows, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  let expenses = (rows ?? []).map(rowToExpense)

  // Filtros en memoria (search y tags no se pueden hacer eficientemente en SQL sin FTS)
  if (search) {
    expenses = expenses.filter(e =>
      (e.merchant as string).toLowerCase().includes(search) ||
      ((e.reference as string | null) ?? "").toLowerCase().includes(search) ||
      ((e.notes as string) ?? "").toLowerCase().includes(search) ||
      ((e.project as string | null) ?? "").toLowerCase().includes(search) ||
      ((e.tags as string[]) ?? []).some((t: string) => t.toLowerCase().includes(search)) ||
      ((e.items as { name: string }[]) ?? []).some((it) => it.name.toLowerCase().includes(search))
    )
  }

  if (tagsRaw) {
    const ft = tagsRaw.split(",").map(t => t.toLowerCase().trim()).filter(Boolean)
    if (ft.length > 0) {
      expenses = expenses.filter(e =>
        ft.some(f => (e.tags as string[]).some((et: string) => et.toLowerCase() === f))
      )
    }
  }

  const allTags = [...new Set(expenses.flatMap(e => (e.tags as string[]) ?? []).map((t: string) => t.toLowerCase()))].sort()
  const total = expenses.length

  if (!all) {
    expenses = expenses.slice((page - 1) * limit, page * limit)
  }

  return NextResponse.json({ expenses, total, allTags })
}

// ── POST ──────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, "pay")
  if (auth instanceof NextResponse) return auth
  const { uid } = auth

  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 })
  }

  const sb = getSupabase()
  const now = new Date().toISOString()

  const { data, error } = await sb
    .from("expenses")
    .insert({
      uid,
      account:           body.account ?? "personal",
      merchant:          body.merchant,
      date:              body.date,                    // ISO string
      items:             body.items ?? [],
      subtotal:          body.subtotal ?? 0,
      tax:               body.tax ?? 0,
      total:             body.total ?? 0,
      payment_method:    body.paymentMethod ?? null,
      reference:         body.reference ?? null,
      category:          body.category ?? "",
      currency:          body.currency ?? "USD",
      notes:             body.notes ?? "",
      tags:              body.tags ?? [],
      receipt_image_url: body.receiptImageUrl ?? null,
      project:           body.project ?? null,
      privacy:           body.privacy ?? "private",
      archived:          body.archived ?? false,
      flagged:           body.flagged ?? false,
      created_at:        now,
      updated_at:        now,
    })
    .select("id")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Intentar vincular con pago recurrente activo del mismo comercio
  if (data?.id && body.merchant) {
    try {
      const merchantLower = (body.merchant as string).toLowerCase()
      const { data: recurrings } = await sb
        .from("recurring")
        .select("id")
        .eq("uid", uid)
        .eq("active", true)

      const match = (recurrings ?? []).find(
        (r: Record<string, unknown>) => (r.merchant as string).toLowerCase() === merchantLower
      )

      if (match) {
        await Promise.all([
          sb.from("expenses").update({ recurring_id: match.id }).eq("id", data.id),
          sb.from("recurring").update({
            last_linked_expense_id: data.id,
            last_linked_at: now,
          }).eq("id", match.id),
        ])
      }
    } catch { /* vincular es best-effort */ }
  }

  return NextResponse.json({ id: data?.id }, { status: 201 })
}
